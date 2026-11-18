import { Link } from 'react-router';
import { BADGES, currentStreak, dayKey, effectiveStrength, letterKey, levelInfo, maxStars, totalStars, xpToday } from '@oina/engine';
import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { Card, Page, ProgressBar } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { InstallCard } from '../components/InstallCard';
import { n } from '../lib/format';

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const WEEKS = 6;
/** Day of the month in the Persian (Solar Hijri) calendar, Persian digits. */
const dayNum = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' });

/** The last few weeks, Saturday first (Iranian week), one cell per day coloured by XP. */
function PracticeCalendar() {
  const p = useProgress();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  // JS: Sunday = 0 … Saturday = 6 → column index with Saturday = 0.
  const col = (today.getDay() + 1) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - col - (WEEKS - 1) * 7);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const practised = days.filter((d) => d <= today && (p.xpByDay[dayKey(d)] ?? 0) > 0).length;

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">روزهای تمرین</h2>
        <span className="text-sm text-muted">{n(practised)} روز در {n(WEEKS)} هفته‌ی اخیر</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center" role="grid" aria-label="تقویم تمرین">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-xs text-muted">{w}</span>
        ))}
        {days.map((d) => {
          const xp = p.xpByDay[dayKey(d)] ?? 0;
          const future = d > today;
          const goal = xp >= p.dailyGoal;
          const isToday = dayKey(d) === dayKey(today);
          return (
            <span
              key={d.toISOString()}
              title={`${d.toLocaleDateString('fa-IR')}: ${n(xp)} امتیاز`}
              aria-label={`${d.toLocaleDateString('fa-IR')}: ${n(xp)} امتیاز`}
              className={`grid aspect-square place-items-center rounded-lg text-[0.65rem] font-semibold ${
                future ? 'opacity-0' : goal ? 'bg-cat-trap text-white' : xp > 0 ? 'bg-[color-mix(in_srgb,var(--cat-trap)_35%,transparent)]' : 'bg-surface-2 text-muted'
              } ${isToday ? 'ring-2 ring-primary' : ''}`}
            >
              {goal ? '🔥' : dayNum.format(d)}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">🔥 یعنی آن روز به هدف روزانه رسیدی.</p>
    </Card>
  );
}

/** Every letter of the alphabet coloured by how well the learner reads it now. */
function LetterMastery() {
  const index = useContent();
  const p = useProgress();
  const now = new Date();
  const rows = index.letters.map((l) => {
    const item = p.items[letterKey(l.id)];
    return { l, seen: !!item, s: item ? effectiveStrength(item, now) : 0 };
  });
  const strong = rows.filter((r) => r.seen && r.s >= 70).length;
  const weak = rows.filter((r) => r.seen && r.s < 40).length;
  const tone = (r: (typeof rows)[number]) =>
    !r.seen ? 'bg-surface-2 text-muted' : r.s >= 70 ? 'bg-good text-white' : r.s >= 40 ? 'bg-gold text-[#1d2a2c]' : 'bg-bad text-white';

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">تسلط بر حروف</h2>
        <span className="text-sm text-muted">{n(strong)} محکم · {n(weak)} سست</span>
      </div>
      <ul className="grid grid-cols-7 gap-1.5" dir="ltr">
        {rows.map((r) => (
          <li key={r.l.id}>
            <Link
              to="/alphabet"
              className={`grid aspect-square place-items-center rounded-xl text-lg font-bold transition active:scale-95 ${tone(r)}`}
              aria-label={`${r.l.upper}: ${r.seen ? `${n(r.s)}٪` : 'هنوز نخوانده'}`}
            >
              <Cyr>{r.l.upper}</Cyr>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-full bg-good" />محکم</span>
        <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-full bg-gold" />متوسط</span>
        <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-full bg-bad" />سست، مرورش کن</span>
        <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-full bg-surface-2" />هنوز نخوانده</span>
      </div>
      {weak > 0 && (
        <Link to="/review?mode=review" className="mt-3 block font-semibold text-primary">حروف سست را مرور کن ←</Link>
      )}
    </Card>
  );
}

/** Level, streak, stars, practice calendar, letter mastery and badges. */
export function ProfilePage() {
  const index = useContent();
  const p = useProgress();
  const now = new Date();
  const lvl = levelInfo(p.xp);
  const streak = currentStreak(p, now);
  const lessonsDone = index.lessonOrder.filter((l) => p.completedLessons.includes(l.id)).length;
  const wordsRead = Object.entries(p.items).filter(([k, v]) => k.startsWith('word:') && v.correct > 0).length;

  return (
    <Page>
      <div className="mb-4 overflow-hidden rounded-3xl bg-primary p-5 text-primary-ink shadow-[0_6px_0_0_rgb(0_0_0/0.15)]">
        <div className="flex items-center gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white/20">
            <Hoopoe size={64} mood={streak ? 'cheer' : 'happy'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-85">سطح</p>
            <p className="text-4xl leading-none font-extrabold">{n(lvl.level)}</p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lvl.fraction * 100)} aria-label="پیشرفت تا سطح بعد">
              <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${Math.max(4, lvl.fraction * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs opacity-85">{n(lvl.next - p.xp)} امتیاز تا سطح {n(lvl.level + 1)}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: n(streak), l: 'روز پیاپی', c: 'text-cat-trap', i: '🔥' },
          { v: `${n(totalStars(p))}/${n(maxStars(index))}`, l: 'ستاره', c: 'text-gold', i: '⭐' },
          { v: `${n(lessonsDone)}/${n(index.lessonOrder.length)}`, l: 'درس', c: 'text-primary', i: '📚' },
          { v: n(wordsRead), l: 'کلمه خواندی', c: 'text-cat-new', i: '📖' },
        ].map((s) => (
          <Card key={s.l} className="text-center">
            <div aria-hidden className="text-xl">{s.i}</div>
            <div className={`text-xl font-extrabold ${s.c}`}>{s.v}</div>
            <div className="text-xs text-muted">{s.l}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">هدف امروز</h2>
          <span className="text-sm text-muted">{n(xpToday(p, now))} از {n(p.dailyGoal)} امتیاز</span>
        </div>
        <ProgressBar value={Math.min(1, xpToday(p, now) / p.dailyGoal)} />
      </Card>

      <PracticeCalendar />
      <LetterMastery />

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">نشان‌ها <span className="text-sm font-normal text-muted">{n(p.badges.length)} از {n(BADGES.length)}</span></h2>
        <ul className="grid grid-cols-2 gap-2">
          {BADGES.map((b) => {
            const has = p.badges.includes(b.id);
            return (
              <li key={b.id} className={`flex items-start gap-2 rounded-2xl border-2 p-3 ${has ? 'border-gold bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]' : 'border-line opacity-50'}`}>
                <span aria-hidden className={`text-2xl ${has ? 'animate-pop' : 'grayscale'}`}>{has ? '🏅' : '🔒'}</span>
                <div className="min-w-0">
                  <p className="font-bold">{b.titleFa}</p>
                  <p className="text-xs text-muted">{b.descriptionFa}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <InstallCard />

      <Link to="/tools" className="flex min-h-14 items-center justify-between rounded-3xl border-2 border-line bg-surface px-4 font-bold">
        <span>⚙️ تنظیمات، حساب و پشتیبان</span>
        <span aria-hidden className="text-muted">‹</span>
      </Link>
    </Page>
  );
}
