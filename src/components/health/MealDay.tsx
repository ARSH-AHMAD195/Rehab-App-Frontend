import { CheckCircle2, Circle } from 'lucide-react';
import { biText, t } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Badge, Card } from '../ui';
import type { MealDay, MealHistoryDay } from '../../types/api';

type Slot = MealDay['slots'][number];

const Bar = ({ label, value, target, unit, percent }: { label: string; value: number; target: number; unit: string; percent: number | null }) => (
  <div>
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="font-semibold text-slate-900">{label}</span>
      <span className="text-slate-700">{t('{value} of {target} {unit}', { value: Math.round(value * 10) / 10, target, unit })}</span>
    </div>
    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
    </div>
  </div>
);

/** The day's calories and protein against the targets. */
export const IntakeBars = ({ day }: { day: MealDay }) => (
  <Card className="grid gap-4 sm:grid-cols-2">
    <Bar label={t('Calories')} value={day.totals.kcal} target={day.targets.kcal} unit="kcal" percent={day.percent.kcal} />
    <Bar label={t('Protein')} value={day.totals.proteinG} target={day.targets.proteinG} unit="g" percent={day.percent.protein} />
  </Card>
);

/**
 * Each meal slot and its foods. With `onToggle` the patient ticks what they ate; without it, read-only (doctor).
 * A slot counts its whole calories and protein once anything in it is ticked.
 */
export const MealSlots = ({ day, onToggle, busySlot }: { day: MealDay; onToggle?: (slot: Slot, code: string, ticked: boolean) => void; busySlot?: string | null }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    {day.slots.map((slot) => (
      <Card key={slot.code} className={cn(slot.eaten && 'border-teal-300')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{biText(slot.label)}</h2>
            <p className="text-sm text-slate-600">{slot.window.replace('-', '–')}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {slot.eaten && <Badge tone="emerald">{t('Eaten')}</Badge>}
            <Badge tone="teal">{t('{n} kcal', { n: slot.kcal })}</Badge>
            <Badge>{t('{n} g protein', { n: slot.proteinG })}</Badge>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {slot.options.map((o) => {
            const text = (
              <span className="min-w-0 flex-1 text-slate-900">
                {o.kind === 'ADDON' && <span className="font-semibold text-teal-800">+ </span>}
                {biText(o.label)}
              </span>
            );
            const quantity = <span className="shrink-0 text-right font-semibold text-slate-700">{t(o.quantity)}</span>;
            return (
              <li key={o.code}>
                {onToggle ? (
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-teal-700"
                      checked={o.ticked}
                      disabled={busySlot === slot.code}
                      onChange={(e) => onToggle(slot, o.code, e.target.checked)}
                    />
                    {text}
                    {quantity}
                  </label>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    {o.ticked ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-label="Eaten" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-label="Not eaten" />}
                    {text}
                    {quantity}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    ))}
  </div>
);

/** One line per day, newest first: how much of the calorie and protein targets was eaten. */
export const MealHistory = ({ days }: { days: MealHistoryDay[] }) => (
  <ul className="divide-y divide-slate-100 text-sm">
    {days.map((d) => (
      <li key={d.date} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span className="font-semibold text-slate-900">{formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        {d.logged && d.percent ? (
          <span className={cn('text-slate-700', (d.percent.kcal ?? 0) < 75 && 'font-semibold text-amber-800')}>
            {t('{kcal}% calories · {protein}% protein', { kcal: d.percent.kcal ?? 0, protein: d.percent.protein ?? 0 })}
          </span>
        ) : (
          <span className="text-slate-500">{t('Nothing ticked')}</span>
        )}
      </li>
    ))}
  </ul>
);
