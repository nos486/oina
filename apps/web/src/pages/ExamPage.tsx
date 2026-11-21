import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionState } from '@oina/engine';
import { accuracy, bestExam, createRng, currentStreak, EXAM_QUESTIONS, examGrade, generateExam, learnedKeys, recordExam } from '@oina/engine';
import type { Question } from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore, useProgress } from '../state/progress';
import { SessionRunner } from '../exercises/SessionRunner';
import { Button, Card, Page } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { Confetti } from '../components/Confetti';
import { GoalReached, LevelUp } from '../components/Rewards';
import { commitRewards, MissedList, NewBadges, type Rewards, SummaryStats } from '../components/SessionSummary';
import { n, pct } from '../lib/format';

const dateFa = new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric' });

/** Share of first answers that were right, for letter questions and for word questions. */
function breakdown(questions: Question[], missed: string[]) {
  const part = (kind: 'letter:' | 'word:') => {
    const qs = questions.filter((q) => q.itemKey.startsWith(kind));
    const wrong = qs.filter((q) => missed.includes(q.itemKey)).length;
    return { total: qs.length, correct: qs.length - wrong };
  };
  return { letters: part('letter:'), words: part('word:') };
}

/** The general exam: questions from every finished stage, no retries, a score and the mistakes at the end. */
export function ExamPage() {
  const index = useContent();
  const navigate = useNavigate();
  const p = useProgress();
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ s: SessionState; rewards: Rewards } | null>(null);
  const setup = useMemo(() => (run ? generateExam(index, progressStore.get(), createRng()) : null), [index, run]);
  const keys = learnedKeys(index, p);
  const letters = keys.filter((k) => k.startsWith('letter:')).length;
  const words = keys.length - letters;
  const best = bestExam(p);

  if (setup && setup.questions.length && !result) {
    return (
      <SessionRunner
        key={run}
        mode="exam"
        questions={setup.questions}
        level={2}
        ctx={setup.ctx}
        onComplete={(s) => {
          const at = new Date().toISOString();
          const rewards = commitRewards(index, s, (x) => recordExam(x, { at, correct: s.firstTry.correct, total: s.firstTry.total }));
          setResult({ s, rewards });
        }}
      />
    );
  }

  if (result && setup) {
    const { s, rewards } = result;
    const score = accuracy(s);
    const grade = examGrade(score);
    const b = breakdown(setup.questions, s.missed);
    return (
      <Page>
        {score >= 0.8 && <Confetti />}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className={score >= 0.6 ? 'animate-bob' : ''}><Hoopoe size={88} mood={score >= 0.6 ? 'cheer' : 'sad'} /></span>
          <p className="text-5xl" aria-hidden>{grade.emoji}</p>
          <h1 className="text-2xl font-extrabold">نمره‌ی تو: {pct(score)}</h1>
          <p className="text-lg font-bold text-primary">{grade.labelFa}</p>
        </div>
        <SummaryStats s={s} />
        <div className="mb-4 grid grid-cols-2 gap-3 text-center">
          {b.letters.total > 0 && (
            <Card><div className="text-xl font-extrabold">{n(b.letters.correct)}/{n(b.letters.total)}</div><div className="text-sm text-muted">سؤال حرف</div></Card>
          )}
          {b.words.total > 0 && (
            <Card><div className="text-xl font-extrabold">{n(b.words.correct)}/{n(b.words.total)}</div><div className="text-sm text-muted">سؤال کلمه</div></Card>
          )}
        </div>
        {rewards.goalReached && <GoalReached streak={currentStreak(p, new Date())} />}
        {rewards.levelUp && <LevelUp level={rewards.levelUp} />}
        <NewBadges ids={rewards.badges} />
        <MissedList index={index} keys={s.missed} />
        <div className="flex flex-col gap-3">
          {s.missed.length > 0 && <Button onClick={() => navigate('/review?mode=mistakes&t=' + Date.now())}>تمرین همین اشتباه‌ها</Button>}
          <Button variant="secondary" onClick={() => { setResult(null); setRun((r) => r + 1); }}>امتحان دوباره</Button>
          <Button variant="ghost" onClick={() => navigate('/review')}>بازگشت به مرور</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page title="امتحان کلی" subtitle="از همه‌ی چیزهایی که تا الان یاد گرفتی">
      {keys.length === 0 ? (
        <Card className="text-center">
          <Hoopoe size={64} />
          <p className="my-3">هنوز درسی تمام نکرده‌ای. اول یک درس بخوان، بعد خودت را امتحان کن.</p>
          <Link to="/" className="font-semibold text-primary">رفتن به مسیر</Link>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <p className="mb-3">
              {n(EXAM_QUESTIONS)} سؤال از همه‌ی مرحله‌هایی که خوانده‌ای: <b>{n(letters)} حرف</b> و <b>{n(words)} کلمه</b>.
              هر سؤال یک بار پرسیده می‌شود و در آخر نمره و اشتباه‌هایت را می‌بینی.
            </p>
            <Button className="w-full" onClick={() => setRun((r) => r + 1)}>شروع امتحان</Button>
          </Card>
          {p.exams.length > 0 && (
            <Card>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold">امتحان‌های قبلی</h2>
                {best && <span className="text-sm text-muted">بهترین نمره: <b className="text-gold">{pct(best.correct / best.total)}</b></span>}
              </div>
              <ul className="flex flex-col gap-2">
                {p.exams.slice(0, 8).map((e) => (
                  <li key={e.at} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-muted">{dateFa.format(new Date(e.at))}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-good" style={{ width: `${(e.correct / e.total) * 100}%` }} />
                    </span>
                    <span className="w-12 text-left text-sm font-bold">{pct(e.correct / e.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate('/review')}>بازگشت به مرور</Button>
    </Page>
  );
}
