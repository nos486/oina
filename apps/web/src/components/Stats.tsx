import { currentStreak, levelInfo, totalStars, xpToday } from '@oina/engine';
import { useProgress } from '../state/progress';

export function GoalRing({ value, goal, size = 36 }: { value: number; goal: number; size?: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, value / goal);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} stroke="var(--line)" strokeWidth="4" fill="none" />
      <circle cx="18" cy="18" r={r} stroke="var(--gold)" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" transform="rotate(-90 18 18)" className="transition-[stroke-dashoffset] duration-700" />
      {f >= 1 && <text x="18" y="22.5" textAnchor="middle" fontSize="13">✓</text>}
    </svg>
  );
}

/** The numbers shown in the top bar (phone) and the sidebar (desktop). */
export function useStats() {
  const p = useProgress();
  const now = new Date();
  return {
    p,
    today: xpToday(p, now),
    goal: p.dailyGoal,
    streak: currentStreak(p, now),
    stars: totalStars(p),
    level: levelInfo(p.xp),
  };
}
