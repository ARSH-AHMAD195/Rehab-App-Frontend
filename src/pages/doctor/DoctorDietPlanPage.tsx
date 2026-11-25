import { useEffect, useId, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { nutritionService, patientService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { usePatientDietPlan } from '../../lib/hooks';
import { emptyOption, kcalGap, nextKey, nutrientText, sumMeals, toRows, toSlots, type OptionRow, type SlotRow } from '../../lib/diet';
import { FOOD_REFERENCE, findFood } from '../../lib/foodReference';
import { MEAL_ADVICE } from '../../lib/features';
import { qk } from '../../lib/queryClient';
import { Alert, Button, buttonClass, Card, ErrorState, Field, Input, PageHeader, PageLoader, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import type { DietPlan } from '../../types/api';

const MAX_SLOTS = 12;
const MAX_OPTIONS = 20;
/** The Health API refuses request bodies over 16 KB; Hindi text takes 3 bytes a letter. */
const MAX_BODY_BYTES = 16 * 1024;
const MAX_RESULTS = 8;

/** Which meal a form key belongs to: `slots.0.kcal` (checks) or `slots[0].kcal` (DTO). -1 when it is not a meal field. */
const mealIndex = (key: string) => {
  const m = /^slots[.[](\d+)[.\]]/.exec(key);
  return m ? Number(m[1]) : -1;
};

/** The patient's own diet chart: daily targets and every meal slot with its food options. Saves replace the whole chart. */
const DietPlanForm = ({ patientId, plan }: { patientId: string; plan: DietPlan }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const baseId = useId();
  const foodListId = `${baseId}-foods`;
  const backTo = `/doctor/patient/${patientId}?tab=nutrition`;
  const [kcal, setKcal] = useState(String(plan.targets.kcal));
  const [protein, setProtein] = useState(String(plan.targets.proteinG));
  const [slots, setSlots] = useState<SlotRow[]>(() => toRows(plan.slots));
  // The version and name the edits started from: a refetch mustn't swap them in under the doctor's changes
  const [{ version, dietLabel }] = useState(() => ({
    version: plan.version,
    dietLabel: plan.dietLabel,
  }));
  // Meal cards open or collapsed, one per slot and kept in step with `slots` by index
  const [open, setOpen] = useState<boolean[]>(() => plan.slots.map(() => false));
  // The meal the food reference adds to: the last one opened with Edit or added
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  // Checks (slots[0].kcal) and DTO validation (slots.0.kcal) name fields differently
  const err = (path: string) => form.errors[path] ?? form.errors[path.replace(/\.(\d+)/g, '[$1]')];
  const errorMeals = new Set(Object.keys(form.errors).map(mealIndex));
  const updateSlot = (i: number, patch: Partial<SlotRow>) => setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updateOption = (i: number, k: number, patch: Partial<OptionRow>) =>
    setSlots((ss) =>
      ss.map((s, j) =>
        j === i
          ? {
              ...s,
              options: s.options.map((o, l) => (l === k ? { ...o, ...patch } : o)),
            }
          : s,
      ),
    );
  const toggle = (i: number) => {
    if (!open[i]) setActive(i);
    setOpen((o) => o.map((v, j) => (j === i ? !v : v)));
  };
  const clearErrors = form.clearAll;
  const removeMeal = (i: number) => {
    clearErrors();
    setSlots((ss) => ss.filter((_, j) => j !== i));
    setOpen((o) => o.filter((_, j) => j !== i));
    setActive((a) => (a === null || a === i ? null : a > i ? a - 1 : a));
  };
  const addMeal = () => {
    setSlots((ss) => [
      ...ss,
      {
        key: nextKey(),
        code: '',
        en: '',
        hi: '',
        from: '',
        to: '',
        kcal: '',
        protein: '',
        advice: '',
        options: [emptyOption()],
      },
    ]);
    setOpen((o) => [...o, true]);
    setActive(slots.length);
  };
  /** Adds a reference food to the active meal. Only the food: the meal's kcal and protein stay as typed. */
  const addFood = (food: (typeof FOOD_REFERENCE)[number]) => {
    if (active === null) return;
    updateSlot(active, { options: [...slots[active]!.options, { ...emptyOption(), en: food.name, quantity: food.serving }] });
    setOpen((o) => o.map((v, j) => v || j === active));
  };

  // A failed check or a server 400 opens every meal that has an error, so the doctor can see it
  useEffect(() => {
    const withErrors = Object.keys(form.errors).map(mealIndex);
    setOpen((o) => o.map((v, i) => v || withErrors.includes(i)));
  }, [form.errors]);

  const body = () => ({ version, dietLabel, targets: { kcal: Number(kcal), proteinG: Number(protein) }, slots: toSlots(slots) });

  const save = useMutation({
    mutationFn: () => nutritionService.updatePatientPlan(patientId, body()),
    onSuccess: () => {
      toast.success('Diet plan saved.');
      void queryClient.invalidateQueries({
        queryKey: qk.patientPart(patientId, 'nutrition'),
      });
      void navigate(backTo, { replace: true });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({
          queryKey: qk.patientPart(patientId, 'nutrition'),
        });
        return form.setFormError('Someone else changed this diet plan just now. Reload this page to load their version (your changes here will be lost).');
      }
      form.fromApiError(e, 'Could not save the diet plan.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (slots.length === 0) return form.setFormError('Add at least one meal.');
    // Open meals with invalid fields first, so validate() can focus the first one
    const invalid = Array.from(e.currentTarget.elements as HTMLCollectionOf<HTMLInputElement>)
      .filter((el) => el.name && el.willValidate && !el.validity.valid)
      .map((el) => mealIndex(el.name));
    if (invalid.length) flushSync(() => setOpen((o) => o.map((v, i) => v || invalid.includes(i))));
    if (!form.validate(e.currentTarget)) return;
    // A window may run up to midnight ("22:00-00:00")
    const backwards = slots.findIndex((s) => s.to <= s.from && s.to !== '00:00');
    if (backwards >= 0) {
      flushSync(() => setOpen((o) => o.map((v, i) => v || i === backwards)));
      form.setFieldError(`slots.${backwards}.windowTo`, 'Must be later than the start time.');
      return form.setFormError('Please correct the highlighted fields.');
    }
    if (new Blob([JSON.stringify(body())]).size > MAX_BODY_BYTES) {
      return form.setFormError('This diet plan is too long to save. Remove some meals or food options, or shorten their names.');
    }
    save.mutate();
  };

  const totals = sumMeals(slots);
  const gap = kcalGap(slots, kcal);
  const gapText = gap < 0 ? `${-gap} kcal short` : gap > 0 ? `${gap} kcal over` : 'matches the target';

  const q = query.trim().toLowerCase();
  const results = q ? FOOD_REFERENCE.filter((f) => f.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS) : [];
  const activeSlot = active === null ? undefined : slots[active];
  const activeName = activeSlot ? activeSlot.en.trim() || `Meal ${active! + 1}` : '';
  const activeFull = !!activeSlot && activeSlot.options.length >= MAX_OPTIONS;

  return (
    <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      <datalist id={foodListId}>
        {FOOD_REFERENCE.map((f) => (
          <option key={f.name} value={f.name} />
        ))}
      </datalist>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <ol className="space-y-3">
            {slots.map((s, i) => {
              const isOpen = open[i] ?? false;
              const panelId = `${baseId}-meal-${i}`;
              const name = s.en.trim() || `Meal ${i + 1}`;
              const time = s.from && s.to ? `${s.from}–${s.to}` : '';
              const mealTotals = sumMeals([s]);
              const mealNutrients = nutrientText(mealTotals.kcal, mealTotals.protein);
              const foods = s.options
                .filter((o) => o.en.trim())
                .map((o) => [o.en.trim(), o.quantity.trim()].filter(Boolean).join(', '))
                .join(' · ');
              return (
                <li key={s.key ?? i} className="flex gap-3">
                  <span className="w-14 shrink-0 pt-4 text-right text-sm font-semibold text-slate-700">{s.from}</span>
                  <div className="min-w-0 flex-1 border-l-2 border-teal-600 pl-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="flex items-start gap-2 p-3">
                        <div className="min-w-0 flex-1 px-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="font-semibold text-slate-900">{name}</span>
                            {time && <span className="text-sm text-slate-600">{time}</span>}
                            {mealNutrients && <span className="text-sm text-slate-600">{mealNutrients}</span>}
                            {!isOpen && errorMeals.has(i) && <span className="text-sm font-semibold text-rose-700">Needs attention</span>}
                          </div>
                          {MEAL_ADVICE && !isOpen && s.advice.trim() && <p className="mt-1 line-clamp-1 text-sm italic text-slate-600">{s.advice.trim()}</p>}
                          {!isOpen && foods && <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{foods}</p>}
                        </div>
                        <Button variant="subtle" size="sm" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(i)}>
                          {isOpen ? 'Done' : 'Edit'}
                          <span className="sr-only"> {isOpen ? `with ${name}` : name}</span>
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Remove meal ${s.en || i + 1}`} onClick={() => removeMeal(i)}>
                          <Trash2 className="h-4 w-4 text-rose-700" aria-hidden="true" />
                        </Button>
                      </div>

                      {/* Collapsed meals stay in the DOM (hidden, not unmounted) so form validation still sees their fields */}
                      <div id={panelId} hidden={!isOpen} className="space-y-3 border-t border-slate-200 p-4">
                        <Field label="Name" error={err(`slots.${i}.label.en`)}>
                          <Input name={`slots.${i}.label.en`} required maxLength={300} value={s.en} onChange={(e) => updateSlot(i, { en: e.target.value, hi: '' })} placeholder="e.g. Lunch" />
                        </Field>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Field label="From" error={err(`slots.${i}.window`)}>
                            <Input name={`slots.${i}.window`} type="time" required value={s.from} onChange={(e) => updateSlot(i, { from: e.target.value })} />
                          </Field>
                          <Field label="To" error={err(`slots.${i}.windowTo`)}>
                            <Input name={`slots.${i}.windowTo`} type="time" required value={s.to} onChange={(e) => updateSlot(i, { to: e.target.value })} />
                          </Field>
                          <Field label="kcal" error={err(`slots.${i}.kcal`)}>
                            <Input name={`slots.${i}.kcal`} type="number" inputMode="numeric" min="0" max="3000" step="any" required value={s.kcal} onChange={(e) => updateSlot(i, { kcal: e.target.value })} />
                          </Field>
                          <Field label="Protein (g)" error={err(`slots.${i}.proteinG`)}>
                            <Input
                              name={`slots.${i}.proteinG`}
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="200"
                              step="any"
                              required
                              value={s.protein}
                              onChange={(e) => updateSlot(i, { protein: e.target.value })}
                            />
                          </Field>
                        </div>
                        {MEAL_ADVICE && (
                          <Field label="Advice for this meal (optional)" hint="The patient sees this under the meal." error={err(`slots.${i}.advice`)}>
                            <Textarea
                              name={`slots.${i}.advice`}
                              rows={2}
                              maxLength={500}
                              value={s.advice}
                              onChange={(e) => updateSlot(i, { advice: e.target.value })}
                              placeholder="e.g. Eat slowly; take with warm water"
                            />
                          </Field>
                        )}

                        <fieldset className="space-y-2">
                          <legend className="mb-1 text-sm font-semibold text-slate-800">Foods</legend>
                          {err(`slots.${i}.options`) && <p className="text-sm text-rose-700">{err(`slots.${i}.options`)}</p>}
                          {s.options.map((o, k) => {
                            const at = `slots.${i}.options.${k}`;
                            const ref = findFood(o.en);
                            const hint = ref && nutrientText(ref.kcal, ref.proteinG);
                            return (
                              <div key={o.key ?? k} className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2">
                                <div className="flex-1 space-y-1">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <Field label="Food" error={err(`${at}.label.en`)}>
                                      <Input
                                        name={`${at}.label.en`}
                                        required
                                        maxLength={300}
                                        list={foodListId}
                                        value={o.en}
                                        onChange={(e) =>
                                          updateOption(i, k, {
                                            en: e.target.value,
                                            hi: '',
                                            // A reference food fills an empty quantity, or replaces the serving it filled for the previous
                                            // food; a quantity the doctor typed is never overwritten
                                            ...((!o.quantity.trim() || o.quantity === ref?.serving) && { quantity: findFood(e.target.value)?.serving ?? '' }),
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Quantity" error={err(`${at}.quantity`)}>
                                      <Input
                                        name={`${at}.quantity`}
                                        required
                                        maxLength={100}
                                        value={o.quantity}
                                        onChange={(e) =>
                                          updateOption(i, k, {
                                            quantity: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. 1 katori"
                                      />
                                    </Field>
                                  </div>
                                  {ref && hint && (
                                    <p className="text-xs text-slate-600">
                                      Reference: {hint} per {ref.serving}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Remove ${o.en || `food ${k + 1}`}`}
                                  disabled={s.options.length === 1}
                                  onClick={() => {
                                    clearErrors();
                                    updateSlot(i, {
                                      options: s.options.filter((_, l) => l !== k),
                                    });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-700" aria-hidden="true" />
                                </Button>
                              </div>
                            );
                          })}
                          <Button variant="subtle" size="sm" disabled={s.options.length >= MAX_OPTIONS} onClick={() => updateSlot(i, { options: [...s.options, emptyOption()] })}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add food
                          </Button>
                        </fieldset>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <Button variant="subtle" disabled={slots.length >= MAX_SLOTS} onClick={addMeal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add meal
          </Button>
        </div>

        {/* On phones the targets and Save come first, not below every meal */}
        <aside className="order-first space-y-4 lg:sticky lg:top-4 lg:order-none">
          <Card className="space-y-4 sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Daily targets</h2>
            <Field label="Daily calories (kcal)" error={err('targets.kcal')}>
              <Input name="targets.kcal" type="number" inputMode="numeric" min="1" max="6000" step="1" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </Field>
            <Field label="Daily protein (g)" error={err('targets.proteinG')}>
              <Input name="targets.proteinG" type="number" inputMode="decimal" min="1" max="300" step="any" required value={protein} onChange={(e) => setProtein(e.target.value)} />
            </Field>
            <p className="text-sm text-slate-700">
              Meals add up to <strong>{totals.kcal} kcal</strong> · {totals.protein} g <span className={gap === 0 ? 'text-slate-600' : 'font-semibold text-amber-800'}>({gapText})</span>
            </p>
            <div className="flex gap-3 pt-1">
              <Link to={backTo} replace className={buttonClass('secondary', 'md', 'flex-1')}>
                Cancel
              </Link>
              <Button type="submit" className="flex-1" loading={save.isPending}>
                Save diet plan
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Food reference</h2>
            {/* No name: it is not a form field, so validation and error clearing ignore it. Enter must not save the plan. */}
            <Field label="Search foods">
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
            </Field>
            {!q ? (
              <p className="text-sm text-slate-600">Type to search the AIIMS Bhopal list</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-slate-600">No foods match.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((f) => (
                  <li key={f.name} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-slate-900">{f.name}</p>
                      <p className="text-xs text-slate-600">{[f.serving, nutrientText(f.kcal, f.proteinG)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Button
                      variant="subtle"
                      size="sm"
                      className="shrink-0"
                      disabled={!activeSlot || activeFull}
                      onClick={() => addFood(f)}
                    >
                      {activeSlot ? `Add to ${activeName}` : 'Add'}
                      <span className="sr-only"> ({f.name})</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {!activeSlot && <p className="text-xs text-slate-600">Open a meal to add foods</p>}
            <p className="text-xs text-slate-600">AIIMS Bhopal diet reference, approximate standard home servings. Adds the food only; the meal’s kcal and protein stay as you set them.</p>
          </Card>
        </aside>
      </div>
    </form>
  );
};

export const DoctorDietPlanPage = () => {
  const { id: patientId = '' } = useParams();
  const plan = usePatientDietPlan(patientId);
  const patient = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.get(patientId) });

  return (
    <div className="space-y-4">
      <Link to={`/doctor/patient/${patientId}?tab=nutrition`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-800">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {patient.data?.name ?? 'patient'} · Nutrition
      </Link>
      <PageHeader
        title="Edit diet plan"
        description="For this patient only. Days already logged keep the values they were logged with, so if the patient has ticked a meal today, the changes show from tomorrow."
      />
      {plan.isPending ? (
        <PageLoader label="Loading the diet plan…" />
      ) : plan.isError ? (
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} title="The diet plan could not be loaded" />
      ) : (
        <DietPlanForm patientId={patientId} plan={plan.data} />
      )}
    </div>
  );
};
