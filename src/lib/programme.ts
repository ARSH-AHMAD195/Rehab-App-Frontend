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
