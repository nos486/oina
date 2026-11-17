import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { SessionState } from '@oina/engine';
import { accuracy, addXp, awardBadges, contextFor, createRng, dueItems, generateReviewQuestions, pickDailyReview, pickMistakes } from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore, useProgress } from '../state/progress';
import { SessionRunner } from '../exercises/SessionRunner';
import { Button, Card, Page } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { n, pct } from '../lib/format';

type Mode = 'review' | 'mistakes';

export function ReviewPage() {
  const index = useContent();
  const p = useProgress();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<SessionState | null>(null);
  const now = new Date();
  const due = dueItems(p, now).length;
  const mode = params.get('mode') as Mode | null;

  const session = useMemo(() => {
    if (!mode) return null;
    const progress = progressStore.get();
    const rng = createRng();
    const keys = mode === 'mistakes' ? pickMistakes(progress, 10) : pickDailyReview(progress, new Date(), 10);
    return { ctx: contextFor(index, progress, rng), questions: generateReviewQuestions(index, progress, keys, rng) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, params.get('t')]);

  if (session && session.questions.length && !result) {
    return (
      <SessionRunner
        mode={mode!}
        questions={session.questions}
        level={1}
        ctx={session.ctx}
        onComplete={(s) => {
          const t = new Date();
          progressStore.update((x) => awardBadges(addXp(x, s.xp, t), index, t).progress);
          setResult(s);
        }}
      />
    );
  }

  return (
    <Page title="مرور">
      {result && (
        <Card className="mb-4 text-center">
          <Hoopoe size={64} mood="cheer" />
          <p className="text-lg font-bold">مرور تمام شد! {n(result.xp)} امتیاز، دقت {pct(accuracy(result))}</p>
          <Button variant="ghost" onClick={() => { setResult(null); setParams({}); }}>باشه</Button>
        </Card>
      )}
      <Card className="mb-4">
        <h2 className="text-lg font-bold">مرور روزانه</h2>
        <p className="mb-3 text-muted">{due ? `${n(due)} کارت امروز نوبتشان است.` : 'امروز کارتی برای مرور نداری. درس تازه بخوان!'}</p>
        <Button className="w-full" disabled={!due} onClick={() => { setResult(null); setParams({ mode: 'review', t: String(Date.now()) }); }}>
          شروع مرور ({n(Math.min(10, due))})
        </Button>
      </Card>
      <Card className="mb-4">
        <h2 className="text-lg font-bold">تمرین اشتباه‌های من</h2>
        <p className="mb-3 text-muted">{p.recentMistakes.length ? `${n(p.recentMistakes.length)} مورد از اشتباه‌های اخیر.` : 'اشتباهی ثبت نشده.'}</p>
        <Button variant="secondary" className="w-full" disabled={!p.recentMistakes.length} onClick={() => { setResult(null); setParams({ mode: 'mistakes', t: String(Date.now()) }); }}>
          تمرین اشتباه‌ها
        </Button>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">مسابقه‌ی سرعت</h2>
        <p className="text-muted">به‌زودی (نسخه‌ی ۱٫۱)</p>
      </Card>
      <p className="mt-4 text-sm text-muted">مرور هیچ‌وقت جان کم نمی‌کند؛ هر جواب درست در مرور یک جان برمی‌گرداند.</p>
    </Page>
  );
}
