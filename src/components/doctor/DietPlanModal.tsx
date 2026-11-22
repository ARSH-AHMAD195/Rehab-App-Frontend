import { useEffect, useId, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { nutritionService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { emptyOption, kcalGap, nextKey, sumMeals, toRows, toSlots, type OptionRow, type SlotRow } from '../../lib/diet';
import { qk } from '../../lib/queryClient';
import { Alert, Button, Field, Input, Modal, ModalActions } from '../ui';
import { useToast } from '../ui/toast';
import type { DietPlan } from '../../types/api';

const MAX_SLOTS = 12;
const MAX_OPTIONS = 20;
/** The Health API refuses request bodies over 16 KB; Hindi text takes 3 bytes a letter. */
const MAX_BODY_BYTES = 16 * 1024;

/** Which meal a form key belongs to: `slots.0.kcal` (checks) or `slots[0].kcal` (DTO). -1 when it is not a meal field. */
const mealIndex = (key: string) => {
  const m = /^slots[.[](\d+)[.\]]/.exec(key);
  return m ? Number(m[1]) : -1;
};

/** The patient's own diet chart: daily targets and every meal slot with its food options. Saves replace the whole chart. */
export const DietPlanModal = ({ patientId, plan, onClose }: { patientId: string; plan: DietPlan; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const baseId = useId();
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
  const toggle = (i: number) => setOpen((o) => o.map((v, j) => (j === i ? !v : v)));
  const clearErrors = form.clearAll;
  const removeMeal = (i: number) => {
    clearErrors();
    setSlots((ss) => ss.filter((_, j) => j !== i));
    setOpen((o) => o.filter((_, j) => j !== i));
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
        options: [emptyOption()],
      },
    ]);
    setOpen((o) => [...o, true]);
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
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({
          queryKey: qk.patientPart(patientId, 'nutrition'),
        });
        return form.setFormError('Someone else changed this diet plan just now. Close this window to load their version.');
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

  return (
    <Modal title="Change diet plan" description="For this patient only. Days already logged keep the values they were logged with, so if the patient has ticked a meal today, the changes show from tomorrow." onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily calories (kcal)" error={err('targets.kcal')}>
            <Input name="targets.kcal" type="number" inputMode="numeric" min="1" max="6000" step="1" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </Field>
          <Field label="Daily protein (g)" error={err('targets.proteinG')}>
            <Input name="targets.proteinG" type="number" inputMode="decimal" min="1" max="300" step="any" required value={protein} onChange={(e) => setProtein(e.target.value)} />
          </Field>
        </div>
        <p className="text-sm text-slate-700">
          Meals add up to <strong>{totals.kcal} kcal</strong> · {totals.protein} g <span className={gap === 0 ? 'text-slate-600' : 'font-semibold text-amber-800'}>({gapText})</span>
        </p>

        <h3 className="pt-2 text-base font-bold text-slate-900">Meals</h3>
        <ol className="space-y-3">
          {slots.map((s, i) => {
            const isOpen = open[i] ?? false;
            const panelId = `${baseId}-meal-${i}`;
            const name = s.en.trim() || `Meal ${i + 1}`;
            const time = s.from && s.to ? `${s.from}–${s.to}` : '';
            const mealTotals = sumMeals([s]);
            return (
              <li key={s.key ?? i} className="rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-1 py-1 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
                    <span className="font-semibold text-slate-900">{name}</span>
                    {time && <span className="text-sm text-slate-600">{time}</span>}
                    <span className="text-sm text-slate-600">
                      {mealTotals.kcal} kcal · {mealTotals.protein} g
                    </span>
                    <span className="text-sm text-slate-600">
                      {s.options.length} {s.options.length === 1 ? 'food' : 'foods'}
                    </span>
                    {!isOpen && errorMeals.has(i) && <span className="text-sm font-semibold text-rose-700">Needs attention</span>}
                  </button>
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

                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-sm font-semibold text-slate-800">Foods</legend>
                    {err(`slots.${i}.options`) && <p className="text-sm text-rose-700">{err(`slots.${i}.options`)}</p>}
                    {s.options.map((o, k) => {
                      const at = `slots.${i}.options.${k}`;
                      return (
                        <div key={o.key ?? k} className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2">
                          <div className="grid flex-1 gap-2 sm:grid-cols-2">
                            <Field label="Food" error={err(`${at}.label.en`)}>
                              <Input
                                name={`${at}.label.en`}
                                required
                                maxLength={300}
                                value={o.en}
                                onChange={(e) =>
                                  updateOption(i, k, {
                                    en: e.target.value,
                                    hi: '',
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
              </li>
            );
          })}
        </ol>

        <Button variant="subtle" disabled={slots.length >= MAX_SLOTS} onClick={addMeal}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add meal
        </Button>

        <ModalActions onCancel={onClose} submitLabel="Save diet plan" loading={save.isPending} />
      </form>
    </Modal>
  );
};
