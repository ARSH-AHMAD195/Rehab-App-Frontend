import { Play, ShieldAlert } from 'lucide-react';
import { Badge, Button, Modal } from '../ui';
import { labelize } from '../../lib/format';
import type { Exercise } from '../../types/api';

const YOUTUBE_ID = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;

const embedUrl = (url: string) => {
  const id = url.match(YOUTUBE_ID)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
};

export const ExerciseDetailModal = ({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) => {
  const embed = exercise.videoUrl ? embedUrl(exercise.videoUrl) : null;

  return (
    <Modal title={exercise.title} onClose={onClose} size="xl">
      <Badge tone="teal">{labelize(exercise.category)}</Badge>
      <p className="mt-2 text-base leading-relaxed text-slate-700">{exercise.description}</p>

      {exercise.videoUrl &&
        (embed ? (
          <div className="my-4 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <iframe
              src={embed}
              title={`${exercise.title} demonstration video`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="my-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700">
                <Play className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-bold">Approved demonstration video</p>
            </div>
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-teal-50"
            >
              Watch video<span className="sr-only"> (opens in a new tab)</span> ↗
            </a>
          </div>
        ))}

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
          Safety & precautions
        </h3>
        <p className="text-sm leading-relaxed text-amber-950">{exercise.safetyNotes}</p>
        {exercise.contraindications.length > 0 && (
          <div className="border-t border-amber-200 pt-2">
            <span className="block text-xs font-bold uppercase text-amber-900">Do not do this exercise if you have</span>
            <ul className="mt-1 list-inside list-disc text-sm text-amber-950">
              {exercise.contraindications.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
        <Button variant="subtle" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
