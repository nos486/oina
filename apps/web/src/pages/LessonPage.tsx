import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SessionState } from '@oina/engine';
import {
  accuracy, addXp, awardBadges, BADGES, completeLesson, currentStreak, levelForXp, xpToday, contextFor, createRng, generateLessonQuestions,
  letterKey, nextLevel, weakestItems,
} from '@oina/engine';
import { audioPath } from '@oina/shared';
import { useContent } from '../state/content';
import { progressStore } from '../state/progress';
import { savedSession } from '../state/savedSession';
import { SessionRunner } from '../exercises/SessionRunner';
import { LetterIntro } from '../components/LetterIntro';
import { Button, Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { Confetti } from '../components/Confetti';
import { CountUp, GoalReached, LevelUp, StarRow } from '../components/Rewards';
import { fxFinish } from '../lib/fx';
import { n, pct } from '../lib/format';

type Phase = { kind: 'intro'; i: number } | { kind: 'session' } | { kind: 'result'; s: SessionState; badges: string[]; levelUp: number | null; goalReached: boolean };

export function LessonPage() {
  const { id = '' } = useParams();
  const index = useContent();
  const navigate = useNavigate();
  const lesson = index.lessonById.get(id);
  const level = nextLevel(progressStore.get(), id);
  // A lesson left halfway resumes from the same question (read once, on mount).
  const [resume] = useState(() => savedSession.forLesson(id, level)?.state);
  // Intro cards only on the first play of a lesson.
  const [phase, setPhase] = useState<Phase>(() =>
    lesson && lesson.newLetters.length && level === 1 && !resume ? { kind: 'intro', i: 0 } : { kind: 'session' },
  );
  const setup = useMemo(() => {
    if (!lesson) return null;
    const rng = createRng();
    const progress = progressStore.get();
    return {
      ctx: contextFor(index, progress, rng, lesson.id),
      questions: generateLessonQuestions(index, lesson, progress, { rng, now: new Date(), level }),
    };
  }, [index, lesson, level]);

  if (!lesson || !setup) {
    return (
      <Page title="درس پیدا نشد">
        <Link to="/" className="text-primary">بازگشت به مسیر</Link>
      </Page>
    );
  }

  if (phase.kind === 'intro') {
    const letter = index.letterById.get(lesson.newLetters[phase.i]!)!;
    const last = phase.i >= lesson.newLetters.length - 1;
    return (
      <LetterIntro
        letter={letter}
        step={phase.i + 1}
        total={lesson.newLetters.length}
        onNext={() => setPhase(last ? { kind: 'session' } : { kind: 'intro', i: phase.i + 1 })}
        onExit={() => navigate('/')}
      />
    );
  }

  if (phase.kind === 'session') {
    return (
      <SessionRunner
        mode="lesson"
        questions={setup.questions}
        level={level}
        ctx={setup.ctx}
        initialState={resume}
        onProgress={(s) => savedSession.save(lesson.id, level, s)}
        onComplete={(s) => {
          savedSession.clear();
          const now = new Date();
          let earned: string[] = [];
          const levelBefore = levelForXp(progressStore.get().xp);
          const before = progressStore.get();
          const goalBefore = xpToday(before, now) >= before.dailyGoal;
          progressStore.update((p) => {
            let next = completeLesson(p, lesson.id, level);
            next = addXp(next, s.xp, now);
            const r = awardBadges(next, index, now);
            earned = r.earned;
            return r.progress;
          });
          fxFinish(progressStore.get().settings.sound);
          const levelAfter = levelForXp(progressStore.get().xp);
          const after = progressStore.get();
          const goalReached = !goalBefore && xpToday(after, now) >= after.dailyGoal;
          setPhase({ kind: 'result', s, badges: earned, levelUp: levelAfter > levelBefore ? levelAfter : null, goalReached });
        }}
      />
    );
  }

  const { s, badges, levelUp, goalReached } = phase;
  const now = new Date();
  const p = progressStore.get();
  const weak = weakestItems(p, [...new Set([...s.missed.filter((k) => k.startsWith('letter:')), ...lesson.newLetters.map(letterKey)])], now, 3, 50)
    .map((k) => index.letterById.get(k.slice(7))!)
    .filter(Boolean);
  const words = lesson.words.map((w) => index.wordById.get(w)!).filter(Boolean);
  const order = index.lessonOrder;
  const nextLesson = order[order.findIndex((l) => l.id === lesson.id) + 1];

  return (
    <Page>
      <Confetti />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="animate-bob"><Hoopoe size={88} mood="cheer" /></span>
        <h1 className="animate-rise text-2xl font-extrabold">{s.wrongCount === 0 ? 'بی‌نقص! درس تمام شد' : 'درس تمام شد!'}</h1>
        <StarRow value={level} />
        <p className="text-sm text-muted">سطح {n(level)} از ۳ این درس</p>
      </div>
      <div className="my-5 grid grid-cols-3 gap-3 text-center">
        <Card className="animate-rise [animation-delay:0.1s]"><div className="text-2xl font-extrabold text-gold" dir="ltr">+<CountUp value={s.xp} /></div><div className="text-sm text-muted">امتیاز</div></Card>
        <Card className="animate-rise [animation-delay:0.2s]"><div className="text-2xl font-extrabold text-good">{pct(accuracy(s))}</div><div className="text-sm text-muted">دقت</div></Card>
        <Card className="animate-rise [animation-delay:0.3s]"><div className="text-2xl font-extrabold text-cat-trap">{n(s.bestCombo)}</div><div className="text-sm text-muted">بیشترین کمبو</div></Card>
      </div>
      {goalReached && <GoalReached streak={currentStreak(p, now)} />}
      {levelUp && <LevelUp level={levelUp} />}
      {badges.length > 0 && (
        <Card className="animate-pop mb-4 border-gold text-center">
          <p className="text-3xl" aria-hidden>🏅</p>
          <p className="font-bold">نشان تازه: {badges.map((b) => BADGES.find((x) => x.id === b)?.titleFa).join('، ')}</p>
        </Card>
      )}
      {weak.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 font-bold">این حروف هنوز برایت سخت است: {weak.map((l) => <Cyr key={l.id} className="mx-1 text-xl font-bold">{l.upper}</Cyr>)}</p>
          <Link to="/review?mode=mistakes" className="font-semibold text-primary">همین الان مرور کن ←</Link>
        </Card>
      )}
      {lesson.miniReading && (
        <Card className="mb-4 text-center">
          <p className="mb-1 text-sm text-muted">خواندن کوچک</p>
          <Cyr className="text-3xl font-bold">{lesson.miniReading.cyrillic}</Cyr>
          <p className="mt-1 text-lg">{lesson.miniReading.persian}</p>
        </Card>
      )}
      <Card className="mb-6">
        <p className="mb-3 font-bold">الان این کلمه‌ها را می‌توانی بخوانی:</p>
        <ul className="flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w.id} className="rounded-xl bg-surface-2 px-3 py-1.5">
              <Cyr className="font-bold">{w.cyrillic}</Cyr> <span className="text-muted">= {w.persian}</span>
              {index.audio.has(audioPath.word(w)) && ' 🔊'}
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-col gap-3">
        {nextLesson && <Button onClick={() => navigate(`/lesson/${nextLesson.id}`)}>درس بعدی</Button>}
        {level < 3 && <Button variant="secondary" onClick={() => navigate(`/lesson/${lesson.id}?again=${Date.now()}`, { replace: true })}>سطح بعدی همین درس</Button>}
        <Button variant="ghost" onClick={() => navigate('/')}>بازگشت به مسیر</Button>
      </div>
    </Page>
  );
}
