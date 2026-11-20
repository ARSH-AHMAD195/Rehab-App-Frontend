import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { nutritionService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { newCode } from '../../lib/diet';
import { qk } from '../../lib/queryClient';
import { Alert, Button, Field, Input, Modal, ModalActions, Select } from '../ui';
import { useToast } from '../ui/toast';
import type { DietPlan, FoodOption, MealSlot } from '../../types/api';

/** Form rows: numbers as typed, and an empty code for anything added here (made on save). */
type OptionRow = { code: string; en: string; hi: string; quantity: string; kind: FoodOption['kind'] };
type SlotRow = { code: string; en: string; hi: string; from: string; to: string; kcal: string; protein: string; options: OptionRow[] };

const MAX_SLOTS = 12;
const MAX_OPTIONS = 20;
const EMPTY_OPTION: OptionRow = { code: '', en: '', hi: '', quantity: '', kind: 'OPTION' };

const toRows = (slots: MealSlot[]): SlotRow[] =>
  slots.map((s) => {
    const [from = '', to = ''] = s.window.split('-');
    return {
      code: s.code,
      en: s.label.en,
      hi: s.label.hi ?? '',
      from,
      to,
      kcal: String(s.kcal),
      protein: String(s.proteinG),
      options: s.options.map((o) => ({ code: o.code, en: o.label.en, hi: o.label.hi ?? '', quantity: o.quantity, kind: o.kind })),
    };
  });

const text = (en: string, hi: string) => ({ en: en.trim(), hi: hi.trim() || null });

const toSlots = (rows: SlotRow[]): MealSlot[] => {
  const slotCodes = rows.map((r) => r.code).filter(Boolean);
  return rows.map((r) => {
    const code = r.code || newCode(r.en, slotCodes);
    if (!r.code) slotCodes.push(code);
    const optionCodes = r.options.map((o) => o.code).filter(Boolean);
    return {
      code,
      label: text(r.en, r.hi),
      window: `${r.from}-${r.to}`,
      kcal: Number(r.kcal),
      proteinG: Number(r.protein),
      options: r.options.map((o) => {
        const optionCode = o.code || newCode(o.en, optionCodes);
        if (!o.code) optionCodes.push(optionCode);
        return { code: optionCode, label: text(o.en, o.hi), quantity: o.quantity.trim(), kind: o.kind };
      }),
    };
  });
};

/** The patient's own diet chart: name, daily targets, and every meal slot with its food options. Saves replace the whole chart. */
export const DietPlanModal = ({ patientId, plan, onClose }: { patientId: string; plan: DietPlan; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [kcal, setKcal] = useState(String(plan.targets.kcal));
  const [protein, setProtein] = useState(String(plan.targets.proteinG));
  const [nameEn, setNameEn] = useState(plan.dietLabel.en);
  const [nameHi, setNameHi] = useState(plan.dietLabel.hi ?? '');
  const [slots, setSlots] = useState<SlotRow[]>(() => toRows(plan.slots));

  // Checks (slots[0].kcal) and DTO validation (slots.0.kcal) name fields differently
  const err = (path: string) => form.errors[path] ?? form.errors[path.replace(/\.(\d+)/g, '[$1]')];
  const updateSlot = (i: number, patch: Partial<SlotRow>) => setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updateOption = (i: number, k: number, patch: Partial<OptionRow>) =>
    setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, options: s.options.map((o, l) => (l === k ? { ...o, ...patch } : o)) } : s)));

  const save = useMutation({
    mutationFn: () =>
      nutritionService.updatePatientPlan(patientId, {
        version: plan.version,
        dietLabel: text(nameEn, nameHi),
        targets: { kcal: Number(kcal), proteinG: Number(protein) },
        slots: toSlots(slots),
      }),
    onSuccess: () => {
      toast.success('Diet plan saved.');
      void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'nutrition') });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'nutrition') });
        return form.setFormError('Someone else changed this diet plan just now. Close this window to load their version.');
      }
      form.fromApiError(e, 'Could not save the diet plan.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (slots.length === 0) return form.setFormError('Add at least one meal.');
    const noMain = slots.findIndex((s) => !s.options.some((o) => o.kind === 'OPTION'));
    if (noMain >= 0) return form.setFormError(`${slots[noMain]!.en || `Meal ${noMain + 1}`} needs at least one main option, not only add-ons.`);
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title="Change diet plan" description="For this patient only. Days already logged keep the values they were logged with." onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Diet name" error={err('dietLabel.en')}>
            <Input name="dietLabel.en" required maxLength={300} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <Field label="Diet name in Hindi (optional)" error={err('dietLabel.hi')}>
            <Input name="dietLabel.hi" lang="hi" maxLength={300} value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
          </Field>
          <Field label="Daily calories (kcal)" error={err('targets.kcal')}>
            <Input name="targets.kcal" type="number" inputMode="numeric" min="500" max="6000" step="1" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </Field>
          <Field label="Daily protein (g)" error={err('targets.proteinG')}>
            <Input name="targets.proteinG" type="number" inputMode="decimal" min="10" max="300" step="any" required value={protein} onChange={(e) => setProtein(e.target.value)} />
          </Field>
        </div>

        <h3 className="pt-2 text-base font-bold text-slate-900">Meals</h3>
        <ol className="space-y-3">
          {slots.map((s, i) => (
            <li key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-end gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field label={`Meal ${i + 1}`} error={err(`slots.${i}.label.en`)}>
                    <Input name={`slots.${i}.label.en`} required maxLength={300} value={s.en} onChange={(e) => updateSlot(i, { en: e.target.value })} placeholder="e.g. Lunch" />
                  </Field>
                  <Field label="In Hindi (optional)" error={err(`slots.${i}.label.hi`)}>
                    <Input name={`slots.${i}.label.hi`} lang="hi" maxLength={300} value={s.hi} onChange={(e) => updateSlot(i, { hi: e.target.value })} />
                  </Field>
                </div>
                <Button variant="ghost" size="sm" aria-label={`Remove meal ${s.en || i + 1}`} onClick={() => setSlots((ss) => ss.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-rose-700" aria-hidden="true" />
                </Button>
              </div>
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
                  <Input name={`slots.${i}.proteinG`} type="number" inputMode="decimal" min="0" max="200" step="any" required value={s.protein} onChange={(e) => updateSlot(i, { protein: e.target.value })} />
                </Field>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold text-slate-800">Food options</legend>
                {err(`slots.${i}.options`) && <p className="text-sm text-rose-700">{err(`slots.${i}.options`)}</p>}
                {s.options.map((o, k) => {
                  const at = `slots.${i}.options.${k}`;
                  return (
                    <div key={k} className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="grid flex-1 gap-2 sm:grid-cols-4">
                        <Field label="Food" error={err(`${at}.label.en`)}>
                          <Input name={`${at}.label.en`} required maxLength={300} value={o.en} onChange={(e) => updateOption(i, k, { en: e.target.value })} />
                        </Field>
                        <Field label="In Hindi" error={err(`${at}.label.hi`)}>
                          <Input name={`${at}.label.hi`} lang="hi" maxLength={300} value={o.hi} onChange={(e) => updateOption(i, k, { hi: e.target.value })} />
                        </Field>
                        <Field label="Quantity" error={err(`${at}.quantity`)}>
                          <Input name={`${at}.quantity`} required maxLength={100} value={o.quantity} onChange={(e) => updateOption(i, k, { quantity: e.target.value })} placeholder="e.g. 1 katori" />
                        </Field>
                        <Field label="Type" error={err(`${at}.kind`)}>
                          <Select name={`${at}.kind`} value={o.kind} onChange={(e) => updateOption(i, k, { kind: e.target.value as OptionRow['kind'] })}>
                            <option value="OPTION">Main option</option>
                            <option value="ADDON">Add-on</option>
                          </Select>
                        </Field>
                      </div>
                      <Button variant="ghost" size="sm" aria-label={`Remove ${o.en || `food ${k + 1}`}`} onClick={() => updateSlot(i, { options: s.options.filter((_, l) => l !== k) })}>
                        <Trash2 className="h-4 w-4 text-rose-700" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
                <Button variant="subtle" size="sm" disabled={s.options.length >= MAX_OPTIONS} onClick={() => updateSlot(i, { options: [...s.options, EMPTY_OPTION] })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add food
                </Button>
              </fieldset>
            </li>
          ))}
        </ol>

        <Button
          variant="subtle"
          disabled={slots.length >= MAX_SLOTS}
          onClick={() => setSlots((ss) => [...ss, { code: '', en: '', hi: '', from: '', to: '', kcal: '', protein: '', options: [EMPTY_OPTION] }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add meal
        </Button>

        <ModalActions onCancel={onClose} submitLabel="Save diet plan" loading={save.isPending} />
      </form>
    </Modal>
  );
};
