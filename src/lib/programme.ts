import { daysUntil } from './format';

/**
 * The programme a patient is on, from their medical profile. Day 1 is `programmeStartDate`
 * (else the day they were enrolled); it runs `programmeLengthDays` (else up to surgery).
 * Returns null when there's nothing to show (no length known, or surgery has passed).
 */
export const programmeFor = ({
  startDate,
  lengthDays,
  surgeryDate,
  enrolledAt,
  now = new Date(),
}: {
  startDate: string | null | undefined;
  lengthDays: number | null | undefined;
  surgeryDate: string | null | undefined;
  enrolledAt: string | null | undefined;
  now?: Date;
}) => {
  const start = startDate ?? enrolledAt;
  if (!start) return null;
  const daysToSurgery = daysUntil(surgeryDate, now);
  if (daysToSurgery !== null && daysToSurgery < 0) return null;
  // Days since day 1 (negative while the programme hasn't started yet)
  const sinceStart = -(daysUntil(start, now) ?? 0);
  const totalDays = lengthDays ?? (daysToSurgery !== null ? daysToSurgery + sinceStart : null);
  if (!totalDays || totalDays < 1) return null;
  return { start, totalDays, currentDay: sinceStart + 1, started: sinceStart >= 0 };
};

/**
 * Where a patient is in their programme: the current day clamped to 1…totalDays,
 * the week it falls in, and how full each week's bar segment is
 * (1 for past weeks, day-in-week ÷ daysPerWeek for this week, 0 for future weeks).
 */
export const programmeProgress = (currentDay: number, totalDays: number, daysPerWeek = 7) => {
  const total = Math.max(1, Math.round(totalDays));
  const day = Math.min(Math.max(Math.round(currentDay), 1), total);
  const weeks = Math.ceil(total / daysPerWeek);
  const fills = Array.from({ length: weeks }, (_, i) => Math.min(Math.max(day - i * daysPerWeek, 0), daysPerWeek) / daysPerWeek);
  return { day, totalDays: total, week: Math.ceil(day / daysPerWeek), weeks, fills };
};
