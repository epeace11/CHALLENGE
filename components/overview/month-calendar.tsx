'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { END, START, dayOfWeek, days, formatDate } from '@/lib/dates';
import { dayTone, entriesOn, notesOf } from '@/lib/selectors';

/** Leading blanks so the first day sits under its weekday, then every day. */
const CELLS: (string | null)[] = [
  ...Array<null>(dayOfWeek(START)).fill(null),
  ...days(START, END),
];

/** Each person's month, coloured by day. Tapping a day opens it, or, for one of your own empty days, starts logging it. */
export function MonthCalendar() {
  const { data, me, today, maxDate, go, log, dialogs } = useChallenge();
  const open = (uid: string, d: string) => {
    if (
      uid !== me.id ||
      entriesOn(data, me.id, d).length ||
      notesOf(data, me.id, d).length
    )
      dialogs.openDay(d, uid);
    else {
      log.changeDate(d);
      go('Log');
    }
  };
  return (
    <section className="glass month">
      <div className="row">
        <h3>Month at a glance</h3>
        <span className="legend">
          <i className="good" />
          clean <i className="wait" />
          reviewing <i className="bad" />
          miss <i className="open" />
          open
        </span>
      </div>
      <div className="cal-people">
        {data.profiles.map((p) => (
          <div key={p.id} className="cal-person">
            <p className="eyebrow">{p.name}</p>
            <div className="cal">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="dow">
                  {d}
                </span>
              ))}
              {CELLS.map((d, i) =>
                d ? (
                  <button
                    key={d}
                    type="button"
                    className={`cell ${dayTone(data, p.id, p.name, d, maxDate)}${d === today ? ' today' : ''}`}
                    disabled={d > maxDate}
                    title={formatDate(d)}
                    onClick={() => open(p.id, d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                ) : (
                  <span key={`b${i}`} className="cell blank" />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
