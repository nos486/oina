import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { SessionMode, SessionState } from '@oina/engine';
import {
  accuracy, bestExam, contextFor, createRng, currentStreak, dueItems, generatePractice, generateReviewQuestions, learnedKeys,
  learnedLessons, pickDailyReview, pickMistakes, strengthSummary, type PracticeKind,
} from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore, useProgress } from '../state/progress';
import { SessionRunner } from '../exercises/SessionRunner';
import { Button, Card, Page } from '../components/ui';
import { Hoopoe } from '../components/Hoopoe';
import { Cyr } from '../components/Cyr';
import { GoalReached, LevelUp } from '../components/Rewards';
import { commitRewards, MissedList, NewBadges, type Rewards, SummaryStats } from '../components/SessionSummary';
import { n, pct } from '../lib/format';

type Mode = 'review' | 'mistakes' | PracticeKind;

const TITLES: Record<Mode, string> = {
  review: 'مرور روزانه',
  mistakes: 'تمرین اشتباه‌ها',
  letters: 'مرور حروف',
  words: 'مرور کلمه‌ها',
  stage: 'مرور مرحله',
  mix: 'مرور همه‌چیز',
};

function StrengthBar({ strong, medium, weak, total }: { strong: number; medium: number; weak: number; total: number }) {
  if (!total) return null;
  const w = (x: number) => `${(x / total) * 100}%`;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="bg-good" style={{ width: w(strong) }} />
        <span className="bg-gold" style={{ width: w(medium) }} />
        <span className="bg-bad" style={{ width: w(weak) }} />
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
        <span><span className="text-good">●</span> محکم {n(strong)}</span>
        <span><span className="text-gold">●</span> متوسط {n(medium)}</span>
        <span><span className="text-bad">●</span> ضعیف {n(weak)}</span>
      </p>
    </div>
  );
}

function PracticeCard({ icon, title, text, disabled, onStart, cta }: { icon: string; title: string; text: string; disabled?: boolean; onStart: () => void; cta: string }) {
  return (
    <Card className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-2xl">{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <p className="mb-3 flex-1 text-sm text-muted">{text}</p>
      <Button variant="secondary" className="w-full" disabled={disabled} onClick={onStart}>{cta}</Button>
    </Card>
  );
}

export function ReviewPage() {
  const index = useContent();
  const p = useProgress();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<{ s: SessionState; rewards: Rewards; mode: Mode } | null>(null);
  const now = new Date();
  const due = dueItems(p, now).length;
  const mode = params.get('mode') as Mode | null;
  const stageId = Number(params.get('stage')) || undefined;

  const session = useMemo(() => {
    if (!mode || !(mode in TITLES)) return null;
    const progress = progressStore.get();
    const rng = createRng();
    const t = new Date();
    if (mode === 'review' || mode === 'mistakes') {
      const keys = mode === 'mistakes' ? pickMistakes(progress, 12) : pickDailyReview(progress, t, 12);
      return { ctx: contextFor(index, progress, rng), questions: generateReviewQuestions(index, progress, keys, rng) };
    }
    return generatePractice(index, progress, mode, rng, t, { stageId, n: mode === 'mix' ? 15 : 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, stageId, params.get('t')]);

  // Nothing to practise (or an unknown mode): drop the params so the normal page and tab bar come back.
  const empty = !!mode && (!session || !session.questions.length);
  useEffect(() => {
    if (empty) setParams({}, { replace: true });
  }, [empty, setParams]);

  if (mode && session && session.questions.length && !result) {
    const sessionMode: SessionMode = mode === 'review' || mode === 'mistakes' ? mode : 'practice';
    return (
      <SessionRunner
        key={params.get('t') ?? mode}
        mode={sessionMode}
        questions={session.questions}
        level={1}
        ctx={session.ctx}
        onComplete={(s) => {
          setResult({ s, rewards: commitRewards(index, s), mode });
          setParams({}, { replace: true });
        }}
      />
    );
  }

  const start = (m: Mode, extra: Record<string, string> = {}) => {
    setResult(null);
    setParams({ mode: m, t: String(Date.now()), ...extra });
  };

  const keys = learnedKeys(index, p);
  const letterKeys = keys.filter((k) => k.startsWith('letter:'));
  const wordKeys = keys.filter((k) => k.startsWith('word:'));
  const letterSum = strengthSummary(p, letterKeys, now);
  const wordSum = strengthSummary(p, wordKeys, now);
  const stages = index.stages.filter((s) => learnedLessons(index, p).some((l) => l.stageId === s.id));
  const best = bestExam(p);
  const recentWords = wordKeys.slice(-12).reverse().map((k) => index.wordById.get(k.slice(5))!).filter(Boolean);

  return (
    <Page title="مرور" subtitle="هر چیزی که یاد گرفتی اینجا دوباره تمرین می‌شود">
      {result && (
        <div className="mb-6">
          <Card className="animate-pop text-center">
            <span className="inline-block animate-bob"><Hoopoe size={64} mood="cheer" /></span>
            <p className="text-lg font-bold">{TITLES[result.mode]} تمام شد!</p>
            <p className="text-muted">دقت {pct(accuracy(result.s))}</p>
          </Card>
          <SummaryStats s={result.s} />
          {result.rewards.goalReached && <GoalReached streak={currentStreak(p, now)} />}
          {result.rewards.levelUp && <LevelUp level={result.rewards.levelUp} />}
          <NewBadges ids={result.rewards.badges} />
          <MissedList index={index} keys={result.s.missed} />
          <Button variant="ghost" className="w-full" onClick={() => { setResult(null); setParams({}); }}>باشه</Button>
        </div>
      )}

      {keys.length === 0 && (
        <Card className="mb-4 text-center">
          <Hoopoe size={56} />
          <p className="mt-2">هنوز درسی تمام نکرده‌ای. بعد از اولین درس، این‌جا پر از تمرین می‌شود.</p>
          <Link to="/" className="font-semibold text-primary">رفتن به مسیر</Link>
        </Card>
      )}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card className="border-primary">
          <div className="mb-2 flex items-center gap-2"><span aria-hidden className="text-2xl">🔁</span><h2 className="text-lg font-bold">مرور روزانه</h2></div>
          <p className="mb-3 text-sm text-muted">{due ? `${n(due)} کارت امروز نوبتشان است.` : 'امروز کارتی نوبتش نیست. پایین‌تر هر چیزی را که بخواهی تمرین کن.'}</p>
          <Button className="w-full" disabled={!due} onClick={() => start('review')}>شروع مرور ({n(Math.min(12, due))})</Button>
        </Card>
        <Card className="border-gold">
          <div className="mb-2 flex items-center gap-2"><span aria-hidden className="text-2xl">📝</span><h2 className="text-lg font-bold">امتحان کلی</h2></div>
          <p className="mb-3 text-sm text-muted">
            ۲۰ سؤال از همه‌ی درس‌هایی که خواندی، بدون تکرار، با نمره.
            {best ? ` بهترین نمره: ${pct(best.correct / best.total)}` : ''}
          </p>
          <Link to="/exam" className={`block rounded-2xl border-2 border-b-4 border-black/15 bg-gold px-5 py-3 text-center font-bold text-[#1d2a2c] ${keys.length ? '' : 'pointer-events-none opacity-40'}`}>
            رفتن به امتحان
          </Link>
        </Card>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-extrabold">تمرین آزاد</h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <PracticeCard
          icon="🔤" title="مرور حروف" cta="تمرین حروف" disabled={!letterKeys.length} onStart={() => start('letters')}
          text={letterKeys.length ? `${n(letterKeys.length)} حرف یاد گرفته‌ای؛ ضعیف‌ترها بیشتر می‌آیند.` : 'هنوز حرفی یاد نگرفته‌ای.'}
        />
        <PracticeCard
          icon="📖" title="مرور کلمه‌ها" cta="تمرین کلمه‌ها" disabled={!wordKeys.length} onStart={() => start('words')}
          text={wordKeys.length ? `${n(wordKeys.length)} کلمه را می‌توانی بخوانی؛ هر بار ۱۲ تا با یک جدول جفت‌کردن.` : 'هنوز کلمه‌ای یاد نگرفته‌ای.'}
        />
        <PracticeCard
          icon="🎲" title="مرور همه‌چیز" cta="تمرین ترکیبی" disabled={!keys.length} onStart={() => start('mix')}
          text="۱۵ سؤال قاطی از حرف‌ها و کلمه‌های همه‌ی درس‌ها؛ نیمی از ضعیف‌ترها و نیمی تصادفی."
        />
        <PracticeCard
          icon="❌" title="اشتباه‌های من" cta="تمرین اشتباه‌ها" disabled={!p.recentMistakes.length} onStart={() => start('mistakes')}
          text={p.recentMistakes.length ? `${n(p.recentMistakes.length)} مورد از اشتباه‌های اخیر. هر کدام بعد از دو جواب درست پشت سر هم حذف می‌شود.` : 'اشتباهی ثبت نشده.'}
        />
      </div>

      {stages.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-1 text-lg font-bold">مرور یک مرحله</h2>
          <p className="mb-3 text-sm text-muted">فقط درس‌های تمام‌شده‌ی همان مرحله.</p>
          <div className="flex flex-wrap gap-2">
            {stages.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => start('stage', { stage: String(s.id) })}
                className="rounded-2xl border-2 border-b-4 border-line bg-surface px-3 py-2 text-sm font-bold transition active:translate-y-0.5"
              >
                {n(s.id)}. {s.titleFa}
              </button>
            ))}
          </div>
        </Card>
      )}

      {keys.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-bold">چقدر یادت مانده؟</h2>
          <p className="mb-1 text-sm font-semibold">حروف ({n(letterSum.total)})</p>
          <StrengthBar {...letterSum} />
          <p className="mt-3 mb-1 text-sm font-semibold">کلمه‌ها ({n(wordSum.total)})</p>
          <StrengthBar {...wordSum} />
        </Card>
      )}

      {recentWords.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-bold">تازه‌ترین کلمه‌هایت</h2>
          <ul className="flex flex-wrap gap-2">
            {recentWords.map((w) => (
              <li key={w.id} className="rounded-xl bg-surface-2 px-3 py-1.5">
                <Cyr className="font-bold">{w.cyrillic}</Cyr> <span className="text-muted">= {w.persian}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="mt-4 text-sm text-muted">مرور هیچ‌وقت جان کم نمی‌کند؛ هر جواب درست در مرور یک جان برمی‌گرداند.</p>
    </Page>
  );
}
