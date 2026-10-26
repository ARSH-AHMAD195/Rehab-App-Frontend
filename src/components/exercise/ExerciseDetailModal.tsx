import { ShieldAlert } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { labelize } from '../../lib/format';
import type { PlanExercise } from '../../types/api';

/** Steps and the demonstration video. Videos are Unlisted/Public YouTube links the API has checked can be embedded. */
export const ExerciseDetailModal = ({ exercise, notes, onClose }: { exercise: PlanExercise; notes?: string | null; onClose: () => void }) => (
  <Modal title={exercise.name} onClose={onClose} size="xl">
    <Badge tone="teal">{labelize(exercise.category)}</Badge>
    {exercise.description && <p className="mt-2 text-base leading-relaxed text-slate-700">{exercise.description}</p>}

    {exercise.video ? (
      <div className="my-4 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${exercise.video.videoId}?rel=0&modestbranding=1`}
          title={`${exercise.name} demonstration video`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full"
        />
      </div>
    ) : (
      <p className="my-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">A demonstration video will be added by your care team.</p>
    )}

    {exercise.instructions.length > 0 && (
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-800">How to do it</h3>
        <ol className="space-y-2.5">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-slate-800">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-900">{i + 1}</span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    )}

    <div className="mt-6 space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950">
        <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
        Safety
      </h3>
      {notes && (
        <p className="text-sm leading-relaxed text-amber-950">
          <strong>Your doctor’s note:</strong> {notes}
        </p>
      )}
      <p className="text-sm leading-relaxed text-amber-950">Stop straight away if you feel severe pain, chest pain, dizziness or unusual shortness of breath, and contact your care team.</p>
    </div>

    <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
      <Button variant="subtle" onClick={onClose}>
        Close
      </Button>
    </div>
  </Modal>
);
