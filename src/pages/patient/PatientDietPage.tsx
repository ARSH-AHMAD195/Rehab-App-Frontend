import { DIET_CHART, DIET_DAILY_KCAL, DIET_DAILY_PROTEIN_G } from '../../lib/dietChart';
import { t, useLang } from '../../lib/i18n';
import { Alert, Badge, Card, PageHeader } from '../../components/ui';

/** The hospital's diet chart, meal by meal. Read-only: nothing here is saved. */
export const PatientDietPage = () => {
  useLang();

  return (
    <div className="space-y-6">
      <PageHeader
        title="High-calorie, High-protein Diet for Cancer Patients"
        description={t('About {kcal} kcal and {protein} g protein a day', { kcal: DIET_DAILY_KCAL, protein: DIET_DAILY_PROTEIN_G })}
      />

      <Alert>If your care team has given you a different diet, follow their advice. Calories and protein are approximate, for the whole meal.</Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {DIET_CHART.map((slot) => (
          <Card key={slot.name}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t(slot.name)}</h2>
                <p className="text-sm text-slate-600">{t(slot.time)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="teal">{t('{n} kcal', { n: slot.kcal })}</Badge>
                <Badge>{t('{n} g protein', { n: slot.proteinG })}</Badge>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {slot.options.map((o) => (
                <li key={o.food} className="flex items-start justify-between gap-4 py-2">
                  <span className="min-w-0 text-slate-900">
                    {o.join === 'or' && <span className="font-semibold text-slate-600">{t('or')} </span>}
                    {o.join === 'plus' && <span className="font-semibold text-teal-800">+ </span>}
                    {t(o.food)}
                  </span>
                  <span className="shrink-0 text-right font-semibold text-slate-700">{t(o.quantity)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
};
