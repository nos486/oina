import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { Stage } from '@oina/shared';
import { averageStrength, letterKey, nextLesson, sessionProgress, WEAK_THRESHOLD } from '@oina/engine';
import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { useSavedSession } from '../state/savedSession';
import { Page, ProgressBar } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { TodayCard } from '../components/TodayCard';
import { n, pct } from '../lib/format';

/** Height of one step on the path; the connector line is drawn through the node centres. */
const ROW = 128;
const NODE = 80;
const OFFSETS = [0, 52, 76, 52, 0, -52, -76, -52];

const accent = (stageId: number): CSSProperties => ({ '--accent': `var(--stage-${((stageId - 1) % 6) + 1})` }) as CSSProperties;

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex gap-0.5 text-sm leading-none" aria-label={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden className={i <= value ? 'text-gold' : 'text-line'}>★</span>
      ))}
    </span>
  );
}

/** The card on top: resume a lesson left halfway, or start the next one. */
function ContinueCard() {
  const index = useContent();
  const p = useProgress();
  const saved = useSavedSession();
  const savedLesson = saved && index.lessonById.get(saved.lessonId);
  const next = nextLesson(index, p.completedLessons);
  const total = index.lessonOrder.length;
  const done = index.lessonOrder.filter((l) => p.completedLessons.includes(l.id)).length;

  const lesson = savedLesson || next;
  if (!lesson) {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-3xl border-2 border-line bg-surface p-4">
        <Hoopoe size={56} mood="cheer" />
        <div>
          <p className="font-extrabold">همه‌ی درس‌ها را تمام کردی!</p>
          <p className="text-sm text-muted">برای ستاره‌های بیشتر درس‌ها را در سطح بالاتر تکرار کن، یا از بخش مرور کمک بگیر.</p>
        </div>
      </div>
    );
  }
  const stage = index.stages.find((s) => s.lessons.includes(lesson.id));
  const letters = lesson.newLetters.map((l) => index.letterById.get(l)!.upper).join(' ');
  return (
    <div className="mb-3 overflow-hidden rounded-3xl border-2 border-line bg-surface">
      <div className="flex items-center gap-4 p-4">
        <div style={accent(stage?.id ?? 1)} className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-bold text-white">
          <Cyr>{letters || '★'}</Cyr>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{savedLesson ? 'درس نیمه‌کاره' : done ? 'درس بعدی' : 'اولین درس'}</p>
          <p className="truncate text-lg font-extrabold">{lesson.titleFa}</p>
          {saved && savedLesson ? (
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar value={sessionProgress(saved.state)} className="h-2.5" />
              <span className="text-xs whitespace-nowrap text-muted">{pct(sessionProgress(saved.state))}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">{n(done)} از {n(total)} درس تمام شده</p>
          )}
        </div>
      </div>
      <Link
        to={`/lesson/${lesson.id}`}
        className="block border-t-2 border-line bg-primary py-3 text-center font-bold text-primary-ink transition active:opacity-80"
      >
        {savedLesson ? 'ادامه بده' : 'شروع کن'}
      </Link>
    </div>
  );
}

/** Zigzag path of lessons. Every stage is open; the next lesson is highlighted. */
export function PathPage() {
  const index = useContent();
  const p = useProgress();
  const saved = useSavedSession();
  const now = new Date();
  const next = nextLesson(index, p.completedLessons);
  const target = saved?.lessonId ?? next?.id;


  const open = index.stages.filter((s) => !s.comingSoon && s.lessons.length);
  const soon = index.stages.filter((s) => s.comingSoon || !s.lessons.length);

  const renderStage = (stage: Stage, si: number) => {
    const lessons = stage.lessons.map((id) => index.lessonById.get(id)!);
    const doneCount = lessons.filter((l) => p.completedLessons.includes(l.id)).length;
    const testStars = p.stageStars[stage.id] ?? 0;
    const stars = lessons.reduce((a, l) => a + (p.lessonLevels[l.id] ?? 0), 0) + testStars;
    const maxStars = lessons.length * 3 + 3;
    const complete = doneCount === lessons.length;
    const steps = lessons.length + 1; // lessons + stage test
    const offset = (i: number) => OFFSETS[(i + si * 3) % OFFSETS.length]!;
    const points = Array.from({ length: steps }, (_, i) => `${100 + offset(i)},${i * ROW + NODE / 2}`).join(' ');

    return (
      <section key={stage.id} style={accent(stage.id)} className="mb-12" aria-labelledby={`stage-${stage.id}`}>
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--accent)] p-4 text-white shadow-[0_6px_0_0_rgb(0_0_0/0.15)]">
          <span aria-hidden className="cyr pointer-events-none absolute -top-4 left-2 text-8xl font-bold opacity-15 select-none">
            {lessons[0] ? index.letterById.get(lessons[0].newLetters[0] ?? '')?.upper ?? '' : ''}
          </span>
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm opacity-85">مرحله‌ی {n(stage.id)}</p>
              <h2 id={`stage-${stage.id}`} className="text-xl font-extrabold">{stage.titleFa}</h2>
              <p className="text-sm opacity-90">{stage.descriptionFa}</p>
            </div>
            {complete && <span className="shrink-0 rounded-full bg-white/25 px-2.5 py-1 text-sm font-bold">✓ تمام شد</span>}
          </div>
          <div className="relative mt-3 flex items-center gap-3 text-sm font-semibold">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={doneCount} aria-label="پیشرفت مرحله">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(doneCount / lessons.length) * 100}%` }} />
            </div>
            <span className="whitespace-nowrap">{n(doneCount)}/{n(lessons.length)} درس</span>
            <span className="whitespace-nowrap" aria-label={`${n(stars)} از ${n(maxStars)} ستاره`}>★ {n(stars)}/{n(maxStars)}</span>
          </div>
        </div>

        <ol className="relative mx-auto" style={{ height: steps * ROW - (ROW - NODE - 40) }}>
          <svg aria-hidden className="pointer-events-none absolute top-0 left-1/2 -ml-[100px] overflow-visible" width="200" height={steps * ROW}>
            <polyline points={points} fill="none" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 18" />
          </svg>
          {lessons.map((lesson, i) => {
            const id = lesson.id;
            const done = p.completedLessons.includes(id);
            const isTarget = target === id;
            const level = p.lessonLevels[id] ?? 0;
            const strength = averageStrength(p, lesson.newLetters.map(letterKey), now);
            // Faded and cracked only when the user has practised these letters and they slipped
            // (a lesson skipped with a stage test has no history yet).
            const seen = lesson.newLetters.some((l) => p.items[letterKey(l)]);
            const cracked = done && seen && strength < WEAK_THRESHOLD;
            const letters = lesson.newLetters.map((l) => index.letterById.get(l)!.upper).join(' ');
            const x = offset(i);
            return (
              <li key={id} className="absolute left-1/2 flex w-40 -translate-x-1/2 flex-col items-center" style={{ top: i * ROW, marginLeft: x }}>
                <div className="relative">
                  {isTarget && (
                    <span className={`absolute top-1 animate-pop ${x > 0 ? '-left-14' : '-right-14'}`}>
                      <Hoopoe size={48} />
                    </span>
                  )}
                  <Link
                    to={`/lesson/${id}`}
                    aria-label={`درس ${lesson.titleFa}${done ? '، تمام‌شده' : ''}${cracked ? '، نیاز به مرور' : ''}${isTarget && saved ? '، نیمه‌کاره' : ''}`}
                    className={`relative grid h-20 w-20 place-items-center rounded-full border-b-8 text-xl font-bold transition active:translate-y-1 active:border-b-4 ${
                      cracked
                        ? 'border-line bg-surface-2 text-muted [background-image:repeating-linear-gradient(135deg,transparent_0_10px,var(--line)_10px_12px)]'
                        : isTarget
                          ? 'border-black/25 bg-[var(--accent)] text-white ring-8 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]'
                          : done
                            ? 'border-black/20 bg-gold text-[#1d2a2c]'
                            : 'border-line bg-surface text-ink'
                    }`}
                  >
                    <Cyr>{letters || '★'}</Cyr>
                    {done && !cracked && !isTarget && (
                      <span aria-hidden className="absolute -right-1 -bottom-1 grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-good text-sm text-white">✓</span>
                    )}
                    {cracked && <span className="absolute -top-1 -left-1 rounded-full bg-cat-trap px-1.5 text-xs text-white">مرور</span>}
                  </Link>
                </div>
                <span className="mt-1.5 flex flex-col items-center gap-0.5 rounded-xl bg-bg px-2 py-0.5">
                  <span className="text-sm font-semibold">{lesson.titleFa}</span>
                  {done && <Stars value={level} label={`سطح ${n(level)} از ۳`} />}
                </span>
              </li>
            );
          })}
          <li className="absolute left-1/2 flex w-40 -translate-x-1/2 flex-col items-center" style={{ top: lessons.length * ROW, marginLeft: offset(lessons.length) }}>
            <div className="grid h-20 place-items-center">
              <Link
                to={`/test/${stage.id}`}
                className={`grid h-16 w-16 place-items-center rounded-2xl border-b-8 text-2xl transition active:translate-y-1 active:border-b-4 ${testStars ? 'border-black/20 bg-gold' : 'border-black/25 bg-[var(--accent)]'}`}
                aria-label={`آزمون مرحله‌ی ${n(stage.id)}`}
              >
                🏆
              </Link>
            </div>
            <span className="mt-1.5 flex flex-col items-center gap-0.5 rounded-xl bg-bg px-2 py-0.5">
              <span className="text-sm font-semibold">آزمون مرحله</span>
              {testStars > 0 && <Stars value={testStars} label={`${n(testStars)} ستاره`} />}
            </span>
          </li>
        </ol>
      </section>
    );
  };

  return (
    <Page>
      <ContinueCard />
      <TodayCard />
      {open.map(renderStage)}
      {soon.length > 0 && (
        <section aria-label="به‌زودی" className="mb-6">
          <p className="mb-3 font-bold text-muted">به‌زودی</p>
          <ul className="flex flex-col gap-3">
            {soon.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-3xl border-2 border-dashed border-line p-4 text-muted">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2">🔒</span>
                <div>
                  <p className="text-sm">مرحله‌ی {n(s.id)}</p>
                  <p className="font-bold text-ink">{s.titleFa}</p>
                  <p className="text-sm">{s.descriptionFa}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
