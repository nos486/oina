import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Ctx, Grade, Question, Response, SessionMode, SessionState } from '@oina/engine';
import { answer, applyAnswer, currentQuestion, gainHeart, loseHeart, nextHeartIn, sessionProgress, startSession } from '@oina/engine';
import { Button, ProgressBar } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { Cyr } from '../components/Cyr';
import { playAudio } from '../lib/audio';
import { fxCorrect, fxWrong } from '../lib/fx';
import { n } from '../lib/format';
import { progressStore, useProgress } from '../state/progress';
import { ChoiceExercise } from './ChoiceExercise';
import { BuildWordExercise } from './BuildWordExercise';
import { MatchExercise } from './MatchExercise';

interface Props {
  mode: SessionMode;
  questions: Question[];
  level: 1 | 2 | 3;
  ctx: Ctx;
  onComplete: (s: SessionState) => void;
}

/** Runs any session (lesson, review, mistakes, stage test): question → check → feedback → next. */
export function SessionRunner({ mode, questions, level, ctx, onComplete }: Props) {
  const navigate = useNavigate();
  const progress = useProgress();
  const [state, setState] = useState(() => startSession(mode, questions, level));
  const [response, setResponse] = useState<Response | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ grade: Grade; combo: boolean; q: Question } | null>(null);
  const shownAt = useRef(Date.now());
  // While feedback shows, keep the answered question on screen (the session may already be done).
  const q = feedback ? feedback.q : currentQuestion(state);
  const outOfHearts = mode === 'lesson' && progress.settings.hearts && progress.hearts.count <= 0 && !feedback;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [q?.id]);

  const submit = useCallback(
    (r: Response) => {
      if (!q || feedback) return;
      const now = new Date();
      const elapsedMs = Date.now() - shownAt.current;
      // Refresh retry context with the latest progress so confusions feed new distractors.
      const out = answer(state, r, { ...ctx, progress: progressStore.get() });
      progressStore.update((p) => {
        let next = p;
        for (const it of out.grade.items) next = applyAnswer(next, { itemKey: it.itemKey, correct: it.correct, elapsedMs, chosen: it.chosen }, now);
        if (!out.grade.correct && mode === 'lesson') next = loseHeart(next, now);
        if (out.grade.correct && mode !== 'lesson' && mode !== 'stageTest') next = gainHeart(next);
        return next;
      });
      if (out.grade.correct) fxCorrect(progress.settings.sound);
      else fxWrong(progress.settings.sound);
      if (q.feedbackAudio && progress.settings.sound) void playAudio(q.feedbackAudio);
      setState(out.state);
      setFeedback({ grade: out.grade, combo: out.comboActive, q });
    },
    [q, feedback, state, ctx, mode, progress.settings.sound],
  );

  const next = useCallback(() => {
    setFeedback(null);
    setResponse(null);
    setSelected(null);
    if (state.done) onComplete(state);
  }, [state, onComplete]);

  // Enter = check / continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (feedback) next();
      else if (response) submit(response);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback, response, next, submit]);

  const onChoice = useCallback((r: Response | null, id: string | null) => {
    setResponse(r);
    setSelected(id);
  }, []);

  if (outOfHearts) {
    const minutes = Math.ceil((nextHeartIn(progress, new Date()) ?? 0) / 60000);
    return (
      <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center gap-4 p-6 text-center">
        <Hoopoe size={96} mood="sad" />
        <h2 className="text-2xl font-extrabold">جانت تمام شد</h2>
        <p className="text-muted">
          جان بعدی تا {n(minutes)} دقیقه‌ی دیگر پر می‌شود. با مرور هم جان می‌گیری؛ مرور هیچ‌وقت جان کم نمی‌کند. اگر نمی‌خواهی، جان را در تنظیمات خاموش کن.
        </p>
        <Button className="w-full" onClick={() => navigate('/review')}>مرور کن و جان بگیر</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>بازگشت به مسیر</Button>
      </div>
    );
  }

  if (!q) return null;
  const checkDisabled = !response || q.type === 'match';

  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col px-4 pt-3">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" aria-label="خروج از درس" onClick={() => navigate('/')} className="text-2xl text-muted">✕</button>
        <ProgressBar value={sessionProgress(state)} />
        {mode === 'lesson' && progress.settings.hearts && <span className="font-bold whitespace-nowrap text-bad" aria-label="جان">♥ {n(progress.hearts.count)}</span>}
        {state.combo >= 5 && <span className="font-bold whitespace-nowrap text-cat-trap" aria-label="کمبو">🔥×۲</span>}
      </div>

      <div className="flex-1" key={q.id}>
        {q.type === 'match' ? (
          <MatchExercise q={q} onDone={(r) => submit(r)} />
        ) : q.type === 'buildWord' ? (
          <BuildWordExercise q={q} locked={!!feedback} onChange={(r) => setResponse(r)} />
        ) : (
          <ChoiceExercise q={q} selected={selected} locked={!!feedback} onChange={onChoice} />
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6">
        {feedback ? (
          <div role="status" aria-live="polite" className={`animate-slide-up px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${feedback.grade.correct ? 'bg-good-soft' : 'bg-bad-soft'}`}>
            <p className={`mb-1 text-xl font-extrabold ${feedback.grade.correct ? 'text-good' : 'text-bad'}`}>
              {feedback.grade.correct ? (feedback.combo ? 'عالی! کمبو 🔥' : 'درست است!') : 'جواب درست:'}
            </p>
            {!feedback.grade.correct && (
              <p className="mb-1 text-lg font-bold">
                {/[Ѐ-ӿ]/.test(feedback.grade.correctAnswer) ? <Cyr>{feedback.grade.correctAnswer}</Cyr> : feedback.grade.correctAnswer}
              </p>
            )}
            {q.tip && !feedback.grade.correct && <p className="mb-3 text-sm text-muted">{q.tip}</p>}
            <Button variant={feedback.grade.correct ? 'good' : 'bad'} className="mt-2 w-full" onClick={next} autoFocus>
              ادامه
            </Button>
          </div>
        ) : (
          <div className="border-t-2 border-line bg-bg px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button className="w-full" disabled={checkDisabled} onClick={() => response && submit(response)}>
              بررسی
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
