import { Link } from 'react-router';
import { MAX_HEARTS, currentStreak, levelForXp, totalStars, xpToday } from '@oina/engine';
import { useProgress } from '../state/progress';
import { n } from '../lib/format';

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, value / goal);
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} stroke="var(--line)" strokeWidth="4" fill="none" />
      <circle cx="18" cy="18" r={r} stroke="var(--gold)" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" transform="rotate(-90 18 18)" />
    </svg>
  );
}

export function TopBar() {
  const p = useProgress();
  const now = new Date();
  const today = xpToday(p, now);
  const streak = currentStreak(p, now);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-1" aria-label={`هدف امروز: ${n(today)} از ${n(p.dailyGoal)} امتیاز`}>
          <GoalRing value={today} goal={p.dailyGoal} />
          <span className="text-sm font-semibold">{n(today)}/{n(p.dailyGoal)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span aria-label={`روزشمار: ${n(streak)} روز`} className={streak ? 'text-cat-trap' : 'text-muted'}>🔥 {n(streak)}</span>
          <span aria-label={`ستاره: ${n(totalStars(p))}`}>⭐ {n(totalStars(p))}</span>
          <Link to="/profile" aria-label={`سطح ${n(levelForXp(p.xp))}`} className="rounded-lg bg-primary-soft px-1.5 text-primary">سطح {n(levelForXp(p.xp))}</Link>
          {p.settings.hearts && (
            <span aria-label={`جان: ${n(p.hearts.count)} از ${n(MAX_HEARTS)}`} className="text-bad">♥ {n(p.hearts.count)}</span>
          )}
          <Link to="/review" className="rounded-xl bg-primary-soft px-3 py-1.5 text-primary" aria-label="مرور">مرور</Link>
        </div>
      </div>
    </header>
  );
}
