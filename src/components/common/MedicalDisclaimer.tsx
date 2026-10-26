import { ChevronDown, ShieldAlert } from 'lucide-react';

/** One line by default; expands on demand. */
export const MedicalDisclaimer = () => (
  <details className="group mb-4 rounded-xl border border-teal-200 bg-teal-50 text-sm text-slate-800">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
      <ShieldAlert className="h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
      <span className="flex-1">
        <strong className="text-teal-950">Not for emergencies.</strong> Call your local emergency number if you feel unwell.
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-teal-800 transition-transform group-open:rotate-180" aria-hidden="true" />
      <span className="sr-only">Show safety information</span>
    </summary>
    <p className="border-t border-teal-200 px-3.5 py-3 leading-relaxed">
      Fit for Surgery supports prehabilitation supervised by your clinical team. It does not replace medical advice or emergency care. Stop exercising
      immediately if you feel pain, severe dizziness, chest tightness or shortness of breath.
    </p>
  </details>
);
