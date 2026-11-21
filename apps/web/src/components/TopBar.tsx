import { Link } from 'react-router';
import { MAX_HEARTS } from '@oina/engine';
import { n } from '../lib/format';
import { GoalRing, useStats } from './Stats';
import { IconConvert } from './icons';

/** Phone header: daily goal, streak, stars, level. Hidden on desktop (the sidebar has the same). */
export function TopBar() {
  const { p, today, goal, streak, stars, level } = useStats();
  return (
    <header className="glass sticky top-0 z-20 border-b border-line/70 pt-[env(safe-area-inset-top)] md:hidden">
      <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between gap-2 px-4">
        <Link to="/profile" className="flex items-center gap-1.5" aria-label={`هدف امروز: ${n(today)} از ${n(goal)} امتیاز`}>
          <GoalRing value={today} goal={goal} size={32} />
          <span className="text-sm font-bold tabular-nums">{n(today)}/{n(goal)}</span>
        </Link>
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <span aria-label={`روزشمار: ${n(streak)} روز`} className={`chip ${streak ? 'text-cat-trap' : 'text-muted'}`}>🔥 {n(streak)}</span>
          <span aria-label={`ستاره: ${n(stars)}`} className="chip">⭐ {n(stars)}</span>
          {p.settings.hearts ? (
            <span aria-label={`جان: ${n(p.hearts.count)} از ${n(MAX_HEARTS)}`} className="chip text-bad">♥ {n(p.hearts.count)}</span>
          ) : (
            <Link to="/profile" aria-label={`سطح ${n(level.level)}`} className="chip bg-primary-soft text-primary">سطح {n(level.level)}</Link>
          )}
          <Link to="/converter" aria-label="مبدل خط" className="grid h-9 w-9 place-items-center rounded-full text-primary transition active:scale-90 hover:bg-primary-soft">
            <IconConvert width={20} height={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
