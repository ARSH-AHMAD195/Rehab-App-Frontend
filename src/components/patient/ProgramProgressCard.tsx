import { CalendarDays } from 'lucide-react';
import { programmeProgress } from '../../lib/programme';
import { cn } from '../../lib/cn';

// Design: example/README.md ("Program Progress Card"). Dates read the British way: "Tue 27 October".
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
const longDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export type ProgramProgressCardProps = {
  /** 1-based day of the programme; clamped to 1…totalDays */
  currentDay: number;
  totalDays: number;
  /** Hidden when not set yet */
  surgeryDate?: Date | null;
  daysPerWeek?: number;
  onPress?: () => void;
};

/** "Week 2 of 4 · Day 12 of 28", a segment per week, and the surgery date. */
export const ProgramProgressCard = ({ currentDay, totalDays, surgeryDate, daysPerWeek = 7, onPress }: ProgramProgressCardProps) => {
  const { day, totalDays: total, week, weeks, fills } = programmeProgress(currentDay, totalDays, daysPerWeek);
  // Screen readers get one sentence; the bar and icon are decorative
  const label = `Week ${week} of ${weeks}, day ${day} of ${total}.${surgeryDate ? ` Surgery planned for ${longDate(surgeryDate)}.` : ''}`;
  const Root = onPress ? 'button' : 'section';

  return (
    <Root
      // A button is named by its label; a plain card reads the sentence below instead
      aria-label={onPress ? label : undefined}
      onClick={onPress}
      {...(onPress && { type: 'button' as const })}
      className={cn(
        'block w-full rounded-2xl border border-ffs-border bg-ffs-surface p-[18px] text-left text-ffs-ink',
        onPress && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ffs-primary focus-visible:ring-offset-2'
      )}
    >
      {!onPress && <span className="sr-only">{label}</span>}
      <div aria-hidden="true">
        {/* Wraps instead of truncating when the system font is scaled up */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xl font-bold leading-tight">
            Week {week} of {weeks}
          </span>
          <span className="text-[17px] leading-tight text-ffs-ink-muted">
            Day {day} of {total}
          </span>
        </div>

        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {fills.map((fill, i) => (
            <span key={i} className="h-2 overflow-hidden rounded bg-ffs-track">
              <span className="block h-full rounded bg-ffs-primary" style={{ width: `${fill * 100}%` }} />
            </span>
          ))}
        </div>

        {surgeryDate && (
          <p className="mt-3.5 flex items-center gap-2 text-[17px] leading-snug text-ffs-ink-muted">
            <CalendarDays className="h-[22px] w-[22px] shrink-0 text-ffs-primary" />
            <span>Surgery planned for {shortDate(surgeryDate)}</span>
          </p>
        )}
      </div>
    </Root>
  );
};
