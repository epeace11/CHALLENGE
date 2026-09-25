'use client';
import {
  CalendarCheck,
  Dumbbell,
  Flag,
  Flame,
  Heart,
  Medal,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { formatDate, formatShortDate } from '@/lib/dates';

/** Icon for each badge id in lib/progress.ts (badges). */
const BADGE_ICONS: Record<string, typeof Sparkles> = {
  first_clean: Sparkles,
  clean_week: CalendarCheck,
  streak7: Flame,
  streak14: Flame,
  streak30: Flame,
  untouchable: ShieldCheck,
  gym_regular: Dumbbell,
  halfway: Flag,
  gracious: Heart,
  hat_trick: Trophy,
  iron_week: Medal,
  strong_finish: Rocket,
};

export function BadgeGrid() {
  const { data, stats } = useChallenge();
  return (
    <section className="glass progress-block">
      <div className="row">
        <h3>Badges</h3>
      </div>
      {data.profiles.map((p) => (
        <div key={p.id} className="badge-person">
          <p className="eyebrow">{p.name}</p>
          <div className="badge-grid">
            {(stats.earned[p.id] ?? []).map((b) => {
              const Icon = BADGE_ICONS[b.id] ?? Sparkles;
              return (
                <div key={b.id} className={`badge${b.earned ? ' earned' : ''}`}>
                  <span className="badge-icon">
                    <Icon size={18} />
                  </span>
                  <b>{b.title}</b>
                  <small>{b.how}</small>
                  {b.earned && b.date && (
                    <span
                      className="badge-date"
                      title={`Earned ${formatDate(b.date)}`}
                    >
                      {formatShortDate(b.date)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
