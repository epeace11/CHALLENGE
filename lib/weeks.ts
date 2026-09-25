/** Monday–Sunday weeks and each weekly rule's target in them come from the database (challenge_weeks, challenge_weekly_targets). */
export type Week = {
  start: string;
  end: string;
  targets: Record<string, number>;
};

export const weekOf = (weeks: Week[], d: string) =>
  weeks.find((w) => d >= w.start && d <= w.end);

/** A weekly rule's target in week `w`; 0 when the rule does not apply that week. */
export const targetFor = (w: Week | undefined, rule: string) =>
  w?.targets[rule] ?? 0;

/** Builds weeks from the challenge_weeks and challenge_weekly_targets rows. */
export function toWeeks(
  rows: { start_date: string; end_date: string }[],
  targets: { rule_id: string; start_date: string; target: number }[],
): Week[] {
  return [...rows]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((r) => ({
      start: r.start_date,
      end: r.end_date,
      targets: Object.fromEntries(
        targets
          .filter((t) => t.start_date === r.start_date)
          .map((t) => [t.rule_id, t.target]),
      ),
    }));
}
