import type { ItemKey } from '@oina/shared';
import type { SessionState } from '@oina/engine';
import { accuracy, addXp, awardBadges, BADGES, levelForXp, parseItemKey, xpToday } from '@oina/engine';
import type { ContentIndex } from '@oina/engine';
import { progressStore } from '../state/progress';
import { Card } from './ui';
import { Cyr } from './Cyr';
import { CountUp } from './Rewards';
import { n, pct } from '../lib/format';

export interface Rewards {
  badges: string[];
  levelUp: number | null;
  goalReached: boolean;
}

/** Adds the session's XP and new badges to progress; reports what changed for the result screen. */
export function commitRewards(index: ContentIndex, s: SessionState, extra?: Parameters<typeof progressStore.update>[0]): Rewards {
  return commitXp(index, s.xp, extra);
}

/** Adds XP (and whatever `extra` changes) plus new badges; reports what changed. */
export function commitXp(index: ContentIndex, xp: number, extra?: Parameters<typeof progressStore.update>[0]): Rewards {
  const now = new Date();
  const before = progressStore.get();
  const levelBefore = levelForXp(before.xp);
  const goalBefore = xpToday(before, now) >= before.dailyGoal;
  let badges: string[] = [];
  progressStore.update((p) => {
    const r = awardBadges(addXp(extra ? extra(p) : p, xp, now), index, now);
    badges = r.earned;
    return r.progress;
  });
  const after = progressStore.get();
  const levelAfter = levelForXp(after.xp);
  return { badges, levelUp: levelAfter > levelBefore ? levelAfter : null, goalReached: !goalBefore && xpToday(after, now) >= after.dailyGoal };
}

export function SummaryStats({ s }: { s: SessionState }) {
  return (
    <div className="my-5 grid grid-cols-3 gap-3 text-center">
      <Card className="animate-rise [animation-delay:0.1s]"><div className="text-2xl font-extrabold text-gold" dir="ltr">+<CountUp value={s.xp} /></div><div className="text-sm text-muted">امتیاز</div></Card>
      <Card className="animate-rise [animation-delay:0.2s]"><div className="text-2xl font-extrabold text-good">{pct(accuracy(s))}</div><div className="text-sm text-muted">دقت</div></Card>
      <Card className="animate-rise [animation-delay:0.3s]"><div className="text-2xl font-extrabold">{n(s.firstTry.correct)}/{n(s.firstTry.total)}</div><div className="text-sm text-muted">درست</div></Card>
    </div>
  );
}

export function NewBadges({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <Card className="animate-pop mb-4 border-gold text-center">
      <p className="text-3xl" aria-hidden>🏅</p>
      <p className="font-bold">نشان تازه: {ids.map((b) => BADGES.find((x) => x.id === b)?.titleFa).join('، ')}</p>
    </Card>
  );
}

/** What the user got wrong, with the right reading, so a test also teaches. */
export function MissedList({ index, keys, title = 'این‌ها را اشتباه زدی:' }: { index: ContentIndex; keys: ItemKey[]; title?: string }) {
  const rows = keys
    .map((k) => {
      const parsed = parseItemKey(k);
      if (!parsed) return null;
      if (parsed.kind === 'letter') {
        const l = index.letterById.get(parsed.id);
        return l ? { key: k, cyr: `${l.upper} ${l.lower}`, fa: l.persian.join(' / ') } : null;
      }
      const w = index.wordById.get(parsed.id);
      return w ? { key: k, cyr: w.cyrillic, fa: w.meaningFa ? `${w.persian} (${w.meaningFa})` : w.persian } : null;
    })
    .filter((r) => !!r);
  if (!rows.length) return null;
  return (
    <Card className="mb-4">
      <p className="mb-3 font-bold">{title}</p>
      <ul className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl bg-bad-soft px-3 py-1.5">
            <Cyr className="font-bold">{r.cyr}</Cyr> <span className="text-muted">= {r.fa}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">این‌ها به «تمرین اشتباه‌های من» در بخش مرور اضافه شدند.</p>
    </Card>
  );
}
