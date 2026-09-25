'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { challengeRange } from '@/lib/dates';
import { rules, weeklyLabel } from '@/lib/rules';
import { targetFor } from '@/lib/weeks';

export function RulesPage() {
  const { data } = useChallenge();
  return (
    <>
      <div className="page-heading">
        <h1>The rules.</h1>
        <span className="eyebrow">{challengeRange}</span>
      </div>
      <section className="glass rule-list">
        {rules.map((r) => (
          <div className="rule-row" key={r.id}>
            <h3>{r.fullTitle ?? r.title}</h3>
            <p>
              <span>
                {r.person ? `${r.person} · ` : ''}
                {r.days}.
              </span>{' '}
              {r.description}
            </p>
          </div>
        ))}
      </section>
      <section className="glass compact rules-process">
        <h3>Logging & review</h3>
        <p>
          Record each habit by 11:59 pm the next day, Toronto time. Missing
          answers become provisional misses. You can log or correct them later;
          your partner approves late changes before points are removed.
        </p>
        <p>
          Your partner can approve or dispute completed habits. Unreviewed
          entries confirm after 48 hours. Editing an approved entry sends it
          back for review.
        </p>
        <h3>Forgiveness</h3>
        <p>
          Missed a habit for a reason? Request forgiveness while logging, or
          from its history. Your partner decides. Approved points stay in
          history but do not count.
        </p>
        <h3>Weekly habits</h3>
        <p>
          Gym and Kazzy’s 10,000-step days are counted per Monday–Sunday week.
          Sunday is the last day, so you can log it until Monday at 11:59 pm,
          when the week is assessed; the last week is assessed the day after the
          challenge ends.
        </p>
        <ul className="week-targets">
          {data.weeks.map((x) => (
            <li key={x.start}>
              <span>
                {x.start.slice(5)} – {x.end.slice(5)}
              </span>
              <span>
                {rules
                  .filter((r) => r.weekly && targetFor(x, r.id) > 0)
                  .map(
                    (r) =>
                      `${r.person ? `${r.person}’s ` : ''}${weeklyLabel[r.id] ?? r.title} ${targetFor(x, r.id)}`,
                  )
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
        <h3>The gifts</h3>
        <p>
          Each missed daily habit adds one penalty point. Each missing gym visit
          or step day adds one at week close. Your first point adds $1 to the
          gift you buy, your second adds $2, and so on. Gift amounts are
          separate. Both of you finalize after October 15 at 11:59 pm and all
          reviews are resolved.
        </p>
      </section>
    </>
  );
}
