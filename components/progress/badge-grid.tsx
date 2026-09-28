'use client';
import { useState } from 'react';
import { Award } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatShortDate } from '@/lib/dates';
import { BadgeMedal } from './badge-medal';

/**
 * Both people's badges. Earned ones sit on a shelf as tinted medals with the date (and New on your
 * own recent ones); tap one for what it was for. The rest are plain rings with how to earn them and,
 * where it builds up, how close you are. Side by side on wide screens; one person at a time on phones.
 */
export function BadgeGrid() {
  const { data, me, stats, newBadges, ui } = useChallenge();
  // The earned badge whose description is showing, as `${person}|${badge}`.
  const [opened, setOpened] = useState('');
  const people = [...data.profiles].sort(
    (a, b) => Number(b.id === me.id) - Number(a.id === me.id),
  );
  return (
    <section className="glass progress-block badges-block" id="badges">
      <div className="row">
        <h3>
          <Award size={19} />
          Badges
        </h3>
      </div>
      <Tabs
        value={ui.badgePerson}
        onValueChange={(v) => ui.setBadgePerson(String(v))}
      >
        <TabsList className="filters badge-tabs">
          {people.map((p) => {
            const all = stats.earned[p.id] ?? [];
            return (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name} · {all.filter((b) => b.earned).length}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <div className="badge-cols">
        {people.map((p) => {
          const mine = p.id === me.id,
            all = stats.earned[p.id] ?? [],
            isNew = (id: string) => mine && newBadges.isNew(id);
          // New ones first, then in the usual order.
          const got = all
              .filter((b) => b.earned)
              .sort((a, b) => Number(isNew(b.id)) - Number(isNew(a.id))),
            rest = all.filter((b) => !b.earned);
          return (
            <div
              key={p.id}
              className={`badge-col${ui.badgePerson === p.id ? ' shown' : ''}`}
            >
              <div className="badge-col-head">
                <h4>{p.name}</h4>
                <span className="badge-count">
                  {got.length} of {all.length}
                </span>
              </div>
              <div className="badge-meter" aria-hidden="true">
                <i style={{ width: `${(got.length / all.length) * 100}%` }} />
              </div>
              {got.length ? (
                <ul className="badge-shelf">
                  {got.map((b) => {
                    const key = `${p.id}|${b.id}`,
                      open = opened === key;
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          className="badge-card"
                          aria-expanded={open}
                          title={b.how}
                          onClick={() => setOpened(open ? '' : key)}
                        >
                          <BadgeMedal id={b.id} earned size={52} />
                          <b>{b.title}</b>
                          {open && <span className="badge-how">{b.how}</span>}
                          <span className="badge-when">
                            {isNew(b.id) && (
                              <>
                                <em className="badge-new">New</em> ·{' '}
                              </>
                            )}
                            {b.date ? (
                              <time
                                dateTime={b.date}
                                title={formatDate(b.date)}
                              >
                                {formatShortDate(b.date)}
                              </time>
                            ) : (
                              'Earned'
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted badge-empty">
                  {mine
                    ? 'None yet. A day with nothing missed earns the first one.'
                    : `${p.name} hasn’t earned one yet.`}
                </p>
              )}
              {rest.length > 0 && (
                <>
                  <p className="eyebrow badge-sub">Still to earn</p>
                  <ul className="badge-locked">
                    {rest.map((b) => (
                      <li key={b.id}>
                        <BadgeMedal id={b.id} earned={false} size={34} />
                        <span className="badge-locked-text">
                          <b>{b.title}</b>
                          <small>{b.how}</small>
                          {b.progress?.note && <em>{b.progress.note}</em>}
                        </span>
                        {b.progress && (
                          <span
                            className="badge-progress"
                            title={`${b.progress.have} of ${b.progress.need} ${b.progress.unit}`}
                          >
                            <span className="sr-only">
                              {b.progress.have} of {b.progress.need}{' '}
                              {b.progress.unit}
                            </span>
                            <span aria-hidden="true">
                              {b.progress.have}/{b.progress.need}
                            </span>
                            <span className="badge-progress-bar">
                              <i
                                style={{
                                  width: `${(b.progress.have / b.progress.need) * 100}%`,
                                }}
                              />
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
