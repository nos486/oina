import { Link, useLocation } from 'react-router';
import { nextLesson } from '@oina/engine';
import { useContent } from '../state/content';
import { n } from '../lib/format';
import { NAV, isActive } from './nav';
import { GoalRing, useStats } from './Stats';

/** Desktop navigation: brand, the learner's numbers, the sections and a continue button. */
export function Sidebar() {
  const { pathname } = useLocation();
  const index = useContent();
  const { p, today, goal, streak, stars, level } = useStats();
  const next = nextLesson(index, p.completedLessons);

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-e border-line bg-surface/80 px-4 py-5 backdrop-blur md:flex">
      <Link to="/" className="flex items-center gap-3 px-2">
        <img src="/icon.svg" alt="" width={40} height={40} className="rounded-xl shadow-sm" />
        <span className="leading-tight">
          <span className="block text-xl font-extrabold">آینه</span>
          <span className="cyr block text-xs text-muted" dir="ltr">Оина</span>
        </span>
      </Link>

      <Link to="/profile" className="rounded-2xl border border-line bg-bg/70 p-3 transition hover:border-primary/40">
        <div className="flex items-center gap-3">
          <GoalRing value={today} goal={goal} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">هدف امروز</p>
            <p className="font-bold tabular-nums">{n(today)} از {n(goal)} امتیاز</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 text-center text-sm font-bold">
          <span className={`rounded-xl bg-surface py-1 ${streak ? 'text-cat-trap' : 'text-muted'}`} title="روزهای پیاپی">🔥 {n(streak)}</span>
          <span className="rounded-xl bg-surface py-1" title="ستاره‌ها">⭐ {n(stars)}</span>
          <span className="rounded-xl bg-primary-soft py-1 text-primary" title="سطح">سطح {n(level.level)}</span>
        </div>
      </Link>

      <nav aria-label="ناوبری اصلی">
        <ul className="flex flex-col gap-1">
          {NAV.map((t) => {
            const active = isActive(t, pathname, true);
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 font-semibold transition ${
                    active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  <t.Icon width={20} height={20} strokeWidth={active ? 2.4 : 2} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {next && (
          <Link
            to={`/lesson/${next.id}`}
            className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-b-4 border-black/15 bg-primary px-4 font-bold text-primary-ink transition hover:brightness-105 active:translate-y-0.5 active:border-b-2"
          >
            ادامه: {next.titleFa}
          </Link>
        )}
        <p className="px-2 text-xs leading-relaxed text-muted">
          در تمرین‌ها با کلیدهای <kbd className="kbd">۱</kbd> تا <kbd className="kbd">۴</kbd> جواب بده و با <kbd className="kbd">Enter</kbd> ادامه بده.
        </p>
      </div>
    </aside>
  );
}
