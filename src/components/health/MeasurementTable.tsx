import { formatDateTime, formatMeasurementValue, labelize } from '../../lib/format';
import { measurementType } from '../../lib/constants';
import type { HealthMeasurement } from '../../types/api';

export const MeasurementTable = ({ measurements, emptyMessage = 'No measurements recorded yet.' }: { measurements: HealthMeasurement[]; emptyMessage?: string }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600">
          <th scope="col" className="pb-3 pr-4">Date & time</th>
          <th scope="col" className="pb-3 pr-4">Measurement</th>
          <th scope="col" className="pb-3 pr-4">Value</th>
          <th scope="col" className="pb-3 pr-4">Unit</th>
          <th scope="col" className="pb-3">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {measurements.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-8 text-center text-slate-600">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          measurements.map((m) => (
            <tr key={m._id}>
              <td className="whitespace-nowrap py-3 pr-4 text-slate-900">{formatDateTime(m.measuredAt)}</td>
              <td className="py-3 pr-4 font-semibold text-slate-900">{measurementType(m.type)?.label ?? labelize(m.type)}</td>
              <td className="py-3 pr-4 font-bold text-teal-900">{formatMeasurementValue(m)}</td>
              <td className="py-3 pr-4 text-slate-700">{m.unit}</td>
              <td className="py-3 text-slate-700">{m.notes || '—'}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
