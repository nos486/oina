import { Link } from 'react-router';
import type { Stage } from '@oina/shared';
import { averageStrength, letterKey, nextLesson, WEAK_THRESHOLD } from '@oina/engine';
import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { n } from '../lib/format';

/** Zigzag path of lessons. Every stage is open; the next lesson is highlighted. */
export function PathPage() {
  const index = useContent();
  const p = useProgress();
  const now = new Date();
  const next = nextLesson(index, p.completedLessons);
  const offsets = [0, 48, 72, 48, 0, -48, -72, -48];
  let k = 0;

  const renderStage = (stage: Stage) => (
    <section key={stage.id} className="mb-10" aria-labelledby={`stage-${stage.id}`}>
      <div className={`mb-6 rounded-3xl p-4 ${stage.comingSoon ? 'bg-surface-2 text-muted' : 'bg-primary text-primary-ink'}`}>
        <p className="text-sm opacity-80">مرحله‌ی {n(stage.id)}</p>
        <h2 id={`stage-${stage.id}`} className="text-xl font-extrabold">{stage.titleFa}</h2>
        <p className="text-sm opacity-90">{stage.descriptionFa}</p>
        {stage.comingSoon && <p className="mt-1 text-sm font-bold">به‌زودی</p>}
      </div>
      <ol className="flex flex-col items-center gap-5">
        {stage.lessons.map((id) => {
          const lesson = index.lessonById.get(id)!;
          const done = p.completedLessons.includes(id);
          const isNext = next?.id === id;
          const level = p.lessonLevels[id] ?? 0;
          const strength = averageStrength(p, lesson.newLetters.map(letterKey), now);
          // Faded and cracked only when the user has practised these letters and they slipped
          // (a lesson skipped with a stage test has no history yet).
          const seen = lesson.newLetters.some((l) => p.items[letterKey(l)]);
          const cracked = done && seen && strength < WEAK_THRESHOLD;
          const letters = lesson.newLetters.map((l) => index.letterById.get(l)!.upper).join(' ');
          const x = offsets[k++ % offsets.length]!;
          return (
            <li key={id} style={{ transform: `translateX(${x}px)` }} className="flex flex-col items-center">
              {isNext && <Hoopoe size={44} />}
              <Link
                to={`/lesson/${id}`}
                aria-label={`درس ${lesson.titleFa}${done ? '، تمام‌شده' : ''}${cracked ? '، نیاز به مرور' : ''}`}
                className={`relative grid h-20 w-20 place-items-center rounded-full border-b-8 text-xl font-bold transition active:translate-y-1 ${
                  cracked
                    ? 'border-line bg-surface-2 text-muted [background-image:repeating-linear-gradient(135deg,transparent_0_10px,var(--line)_10px_12px)]'
                    : done
                      ? 'border-black/20 bg-gold text-ink'
                      : isNext
                        ? 'border-black/20 bg-primary text-primary-ink ring-8 ring-primary-soft'
                        : 'border-line bg-surface text-ink'
                }`}
              >
                <Cyr>{letters || '★'}</Cyr>
                {cracked && <span className="absolute -top-1 -left-1 rounded-full bg-cat-trap px-1.5 text-xs text-white">مرور</span>}
              </Link>
              <span className="mt-1 text-sm font-semibold">{lesson.titleFa}</span>
              {level > 0 && <span className="text-xs" aria-label={`سطح ${level}`}>{'⭐'.repeat(level)}</span>}
            </li>
          );
        })}
        {stage.lessons.length > 0 && (
          <li className="flex flex-col items-center">
            <Link to={`/test/${stage.id}`} className="grid h-16 w-16 place-items-center rounded-2xl border-b-8 border-black/20 bg-cat-tajik text-2xl text-white" aria-label={`آزمون مرحله‌ی ${stage.id}`}>
              🏆
            </Link>
            <span className="mt-1 text-sm font-semibold">
              آزمون مرحله {p.stageStars[stage.id] ? '⭐'.repeat(p.stageStars[stage.id]!) : ''}
            </span>
          </li>
        )}
      </ol>
    </section>
  );

  return <Page>{index.stages.map(renderStage)}</Page>;
}
