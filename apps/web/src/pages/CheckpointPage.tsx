import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SessionState } from '@oina/engine';
import { accuracy, checkpoints, checkpointStars, completeCheckpoint, createRng, currentStreak, generateCheckpoint } from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore } from '../state/progress';
import { SessionRunner } from '../exercises/SessionRunner';
import { Button, Card, Page } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { Cyr } from '../components/Cyr';
import { Confetti } from '../components/Confetti';
import { GoalReached, LevelUp, StarRow } from '../components/Rewards';
import { commitRewards, MissedList, NewBadges, type Rewards, SummaryStats } from '../components/SessionSummary';
import { n } from '../lib/format';

/** A review node on the path: questions from the last two lessons and, mostly, from older ones. */
export function CheckpointPage() {
  const { id = '' } = useParams();
  const index = useContent();
  const navigate = useNavigate();
  const cp = useMemo(() => checkpoints(index).find((c) => c.id === id), [index, id]);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ s: SessionState; rewards: Rewards } | null>(null);
  const setup = useMemo(
    () => (cp && run ? generateCheckpoint(index, progressStore.get(), cp, createRng(), new Date()) : null),
    [index, cp, run],
  );

  if (!cp) return <Page title="مرور پیدا نشد"><Link to="/" className="text-primary">بازگشت به مسیر</Link></Page>;

  const recent = cp.recentLessonIds.map((l) => index.lessonById.get(l)!).filter(Boolean);
  const order = index.lessonOrder;
  const nextLesson = order[order.findIndex((l) => l.id === cp.afterLessonId) + 1];
  const letters = [...recent, ...cp.olderLessonIds.map((l) => index.lessonById.get(l)!)].flatMap((l) => l?.newLetters ?? []);

  if (setup && !result) {
    return (
      <SessionRunner
        key={run}
        mode="checkpoint"
        questions={setup.questions}
        level={2}
        ctx={setup.ctx}
        onComplete={(s) => {
          const rewards = commitRewards(index, s, (p) => completeCheckpoint(p, cp.id, accuracy(s)));
          setResult({ s, rewards });
        }}
      />
    );
  }

  if (result) {
    const { s, rewards } = result;
    const stars = checkpointStars(accuracy(s));
    const p = progressStore.get();
    return (
      <Page>
        {stars > 0 && <Confetti />}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className={stars ? 'animate-bob' : ''}><Hoopoe size={88} mood={stars ? 'cheer' : 'sad'} /></span>
          <h1 className="text-2xl font-extrabold">{stars === 3 ? 'همه را یادت هست!' : stars ? 'مرور تمام شد!' : 'چند چیز یادت رفته بود'}</h1>
          <StarRow value={stars} />
          <p className="text-sm text-muted">{stars ? 'ستاره‌ها روی مسیر ثبت شد.' : 'با ۶۰٪ ستاره می‌گیری. یک بار دیگر امتحان کن.'}</p>
        </div>
        <SummaryStats s={s} />
        {rewards.goalReached && <GoalReached streak={currentStreak(p, new Date())} />}
        {rewards.levelUp && <LevelUp level={rewards.levelUp} />}
        <NewBadges ids={rewards.badges} />
        <MissedList index={index} keys={s.missed} />
        <div className="flex flex-col gap-3">
          {nextLesson && <Button onClick={() => navigate(`/lesson/${nextLesson.id}`)}>درس بعدی</Button>}
          {stars < 3 && <Button variant="secondary" onClick={() => { setResult(null); setRun((r) => r + 1); }}>دوباره مرور کن</Button>}
          <Button variant="ghost" onClick={() => navigate('/')}>بازگشت به مسیر</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page title={`مرور ${n(cp.n)} مرحله‌ی ${n(cp.stageId)}`}>
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <span className="shrink-0"><Hoopoe size={56} /></span>
          <p>
            قبل از رفتن جلو، ببینیم چقدر یادت مانده. سؤال‌ها از دو درس آخر (
            {recent.map((l) => `«${l.titleFa}»`).join(' و ')}
            ){cp.olderLessonIds.length ? <> و بیشترشان از <b>{n(cp.olderLessonIds.length)} درس قبلی</b> است.</> : ' است.'}
          </p>
        </div>
      </Card>
      <Card className="mb-6">
        <p className="mb-2 text-sm text-muted">حروفی که در این مرور می‌آیند</p>
        <Cyr className="text-2xl leading-relaxed font-bold tracking-wider">{letters.map((l) => index.letterById.get(l)?.upper).join(' ')}</Cyr>
      </Card>
      <p className="mb-4 text-sm text-muted">اشتباه‌ها دوباره پرسیده می‌شوند و جان کم نمی‌کنند. با ۶۰٪ جواب درست در بار اول ستاره می‌گیری.</p>
      <Button className="w-full" onClick={() => setRun(1)}>شروع مرور</Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate('/')}>بازگشت به مسیر</Button>
    </Page>
  );
}
