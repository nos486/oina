import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SessionState } from '@oina/engine';
import { accuracy, addXp, completeStageTest, contextFor, createRng, generateStageTest, STAGE_TEST_PASS, starsForScore } from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore } from '../state/progress';
import { SessionRunner } from '../exercises/SessionRunner';
import { Button, Page } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { StarRow } from '../components/Rewards';
import { Confetti } from '../components/Confetti';
import { n, pct } from '../lib/format';

/** 15 random questions from the whole stage; 80% passes (and can be used to skip the stage). */
export function StageTestPage() {
  const { stageId = '' } = useParams();
  const id = Number(stageId);
  const index = useContent();
  const navigate = useNavigate();
  const stage = index.stageById.get(id);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<SessionState | null>(null);
  const setup = useMemo(() => {
    const rng = createRng();
    const p = progressStore.get();
    const last = stage?.lessons.at(-1);
    return last ? { ctx: contextFor(index, p, rng, last), questions: generateStageTest(index, id, p, rng, 15) } : null;
  }, [index, id, stage]);

  if (!stage || !setup) return <Page title="آزمون پیدا نشد"><Link to="/" className="text-primary">بازگشت</Link></Page>;

  if (started && !result) {
    return (
      <SessionRunner
        mode="stageTest"
        questions={setup.questions}
        level={2}
        ctx={setup.ctx}
        onComplete={(s) => {
          const t = new Date();
          progressStore.update((p) => addXp(completeStageTest(p, index, id, accuracy(s)), s.xp, t));
          setResult(s);
        }}
      />
    );
  }

  if (result) {
    const score = accuracy(result);
    const stars = starsForScore(score);
    return (
      <Page>
        {stars > 0 && <Confetti />}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className={stars ? 'animate-bob' : ''}><Hoopoe size={88} mood={stars ? 'cheer' : 'sad'} /></span>
          <h1 className="text-2xl font-extrabold">{stars ? 'قبول شدی!' : 'این بار نشد'}</h1>
          <StarRow value={stars} />
          <p className="text-muted">نمره: {pct(score)} (قبولی از {pct(STAGE_TEST_PASS)})</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/')}>بازگشت به مسیر</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page title={`آزمون مرحله‌ی ${n(id)}: ${stage.titleFa}`}>
      <p className="mb-6 text-muted">
        {n(setup.questions.length)} سؤال تصادفی از کل مرحله. با ۸۰٪ قبول می‌شوی و ستاره می‌گیری؛ اگر درس‌ها را نخوانده‌ای، قبولی همه‌ی درس‌های این مرحله را باز می‌کند.
      </p>
      <Button className="w-full" onClick={() => setStarted(true)}>شروع آزمون</Button>
    </Page>
  );
}
