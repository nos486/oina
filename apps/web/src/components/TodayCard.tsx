import { Link } from 'react-router';
import { currentStreak, dueItems, xpToday } from '@oina/engine';
import { useProgress } from '../state/progress';
import { n } from '../lib/format';

/** Today at a glance on the path: daily goal, streak reminder and cards due for review. */
export function TodayCard() {
  const p = useProgress();
  const now = new Date();
  const today = xpToday(p, now);
  const goal = p.dailyGoal;
  const met = today >= goal;
  const streak = currentStreak(p, now);
  const due = dueItems(p, now).length;
  const f = Math.min(1, today / goal);
  const r = 22;
  const c = 2 * Math.PI * r;

  let line: string;
  if (met) line = streak > 1 ? `هدف امروز کامل شد! ${n(streak)} روز پشت سر هم 🔥` : 'هدف امروز کامل شد! فردا هم بیا تا روزشمار شروع شود.';
  else if (streak > 0) line = `${n(goal - today)} امتیاز دیگر تا هدف امروز. روزشمار ${n(streak)} روزه‌ات را نگه دار!`;
  else if (today > 0) line = `${n(goal - today)} امتیاز دیگر تا هدف امروز.`;
  else line = 'امروز هنوز تمرین نکردی. یک درس کوتاه کافی است.';

  return (
    <div className="mb-8 rounded-3xl border-2 border-line bg-surface p-4">
      <div className="flex items-center gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="shrink-0">
          <circle cx="28" cy="28" r={r} stroke="var(--line)" strokeWidth="7" fill="none" />
          <circle
            cx="28" cy="28" r={r} stroke={met ? 'var(--cat-trap)' : 'var(--gold)'} strokeWidth="7" fill="none"
            strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
          <text x="28" y="33" textAnchor="middle" fontSize="16">{met ? '🔥' : '🎯'}</text>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">امروز · {n(today)} از {n(goal)} امتیاز</p>
          <p className="font-bold">{line}</p>
        </div>
      </div>
      {due > 0 && (
        <Link
          to="/review?mode=review"
          className="mt-3 flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3 font-bold text-primary transition active:scale-[0.98]"
        >
          <span>🔁 {n(due)} کارت منتظر مرورند</span>
          <span aria-hidden>‹</span>
        </Link>
      )}
    </div>
  );
}
