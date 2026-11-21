import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { completeStory, currentStreak, STORY_XP_AGAIN, STORY_XP_FIRST, storyStars, storyWords, type StoryWord } from '@oina/engine';
import type { Story } from '@oina/shared';
import { useContent } from '../state/content';
import { progressStore, useProgress } from '../state/progress';
import { Button, Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { Confetti } from '../components/Confetti';
import { CountUp, GoalReached, LevelUp, StarRow } from '../components/Rewards';
import { commitXp, NewBadges, type Rewards } from '../components/SessionSummary';
import { LetterBreakdown } from '../components/LetterBreakdown';
import { IconEye, IconX } from '../components/icons';
import { LEVEL_FA, STORIES, storyWordCount } from '../lib/stories';
import { n } from '../lib/format';

/** Mouse users get help by resting the pointer on a word this long. */
const HOVER_MS = 350;
const POPOVER_W = 248;

interface Active {
  /** "paragraph:line:word" */
  key: string;
  /** Opened by a tap/click (stays) rather than a hover (goes when the pointer leaves). */
  pinned: boolean;
  /** Where the word is, relative to the story text box. */
  x: number;
  top: number;
  bottom: number;
  below: boolean;
}

/** One story, word by word. A tap (or a resting mouse) on a word shows it in Persian script. */
export function StoryPage() {
  const { id } = useParams();
  const story = STORIES.find((s) => s.id === id);
  if (!story) return <Navigate to="/stories" replace />;
  // A fresh reader per story, so moving to the next story starts clean.
  return <StoryReader key={story.id} story={story} />;
}

function StoryReader({ story }: { story: Story }) {
  const index = useContent();
  const p = useProgress();
  const box = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<Active | null>(null);
  const [helped, setHelped] = useState<Set<string>>(new Set());
  const [openParas, setOpenParas] = useState<Set<number>>(new Set());
  const [letters, setLetters] = useState(false);
  const [result, setResult] = useState<{ stars: 1 | 2 | 3; xp: number; rewards: Rewards; best: number } | null>(null);

  const paras = useMemo(() => story.paragraphs.map((para) => para.map((line) => storyWords(line))), [story]);
  const wordAt = (key: string): StoryWord | undefined => {
    const [a, b, c] = key.split(':').map(Number);
    return paras[a!]?.[b!]?.[c!];
  };
  const total = storyWordCount(story);
  const meanings = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of index.words) if (w.meaningFa) m.set(w.cyrillic.toLowerCase(), w.meaningFa);
    return m;
  }, [index]);

  const markHelped = (keys: string[]) =>
    setHelped((s) => {
      if (keys.every((k) => s.has(k))) return s;
      const next = new Set(s);
      keys.forEach((k) => next.add(k));
      return next;
    });

  const open = (key: string, el: HTMLElement, pinned: boolean) => {
    const container = box.current;
    if (!container) return;
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    setActive({ key, pinned, x: r.left + r.width / 2 - c.left, top: r.top - c.top, bottom: r.bottom - c.top, below: r.top < 170 });
    setLetters(false);
    markHelped([key]);
  };

  // Close on Escape and on a tap anywhere outside a word or the bubble.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setActive(null);
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-word]') && !t.closest('[data-bubble]')) setActive(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [active]);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const onWordClick = (key: string, el: HTMLElement) => {
    if (active?.key === key && active.pinned) setActive(null);
    else open(key, el, true);
  };
  const onWordKey = (e: KeyboardEvent<HTMLSpanElement>, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onWordClick(key, e.currentTarget);
    }
  };
  const onEnter = (e: PointerEvent<HTMLSpanElement>, key: string) => {
    if (e.pointerType !== 'mouse' || active?.pinned) return;
    const el = e.currentTarget;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => open(key, el, false), HOVER_MS);
  };
  const onLeave = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer.current);
    setActive((a) => (a && !a.pinned ? null : a));
  };

  const togglePara = (pi: number) => {
    setOpenParas((s) => {
      const next = new Set(s);
      if (next.has(pi)) next.delete(pi);
      else next.add(pi);
      return next;
    });
    if (!openParas.has(pi)) markHelped(paras[pi]!.flatMap((line, li) => line.map((_, wi) => `${pi}:${li}:${wi}`)));
  };

  const finish = () => {
    const stars = storyStars(helped.size, total);
    const first = !progressStore.get().storyStars[story.id];
    const xp = first ? STORY_XP_FIRST : STORY_XP_AGAIN;
    const rewards = commitXp(index, xp, (pr) => completeStory(pr, story.id, helped.size, total));
    setActive(null);
    setResult({ stars, xp, rewards, best: progressStore.get().storyStars[story.id] ?? stars });
    window.scrollTo({ top: 0 });
  };

  const i = STORIES.indexOf(story);
  const nextStory = STORIES[i + 1];

  if (result) {
    const lookedUp = [...helped].map(wordAt).filter((w): w is StoryWord => !!w);
    const unique = [...new Map(lookedUp.map((w) => [w.key, w])).values()];
    return (
      <Page>
        <Confetti />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="animate-bob"><Hoopoe size={88} mood="cheer" /></span>
          <h1 className="text-2xl font-extrabold">{result.stars === 3 ? 'آفرین! تقریباً همه را خودت خواندی' : 'داستان را تا آخر خواندی!'}</h1>
          <Cyr className="text-lg text-muted">{story.titleCyr}</Cyr>
          <StarRow value={result.stars} />
        </div>
        <div className="my-5 grid grid-cols-2 gap-3 text-center">
          <Card><div className="text-2xl font-extrabold text-gold" dir="ltr">+<CountUp value={result.xp} /></div><div className="text-sm text-muted">امتیاز</div></Card>
          <Card><div className="text-2xl font-extrabold">{n(helped.size)}/{n(total)}</div><div className="text-sm text-muted">کلمه با کمک</div></Card>
        </div>
        {result.rewards.goalReached && <GoalReached streak={currentStreak(progressStore.get(), new Date())} />}
        {result.rewards.levelUp && <LevelUp level={result.rewards.levelUp} />}
        <NewBadges ids={result.rewards.badges} />
        {unique.length > 0 && (
          <Card className="mb-4">
            <p className="mb-3 font-bold">کلمه‌هایی که کمک گرفتی:</p>
            <ul className="flex flex-wrap gap-2">
              {unique.map((w) => (
                <li key={w.key} className="rounded-xl bg-surface-2 px-3 py-1.5">
                  <Cyr className="font-bold">{stripPunct(w.cyr)}</Cyr> <span className="text-muted">= {stripPunct(w.fa)}</span>
                </li>
              ))}
            </ul>
            {result.stars < 3 && <p className="mt-3 text-sm text-muted">یک بار دیگر بخوان؛ اگر بیشترشان را بدون کمک خواندی، ستاره‌ی بیشتری می‌گیری.</p>}
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {nextStory && (
            <Link to={`/stories/${nextStory.id}`} className="block">
              <Button className="w-full">داستان بعدی: {nextStory.titleFa}</Button>
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setHelped(new Set());
              setOpenParas(new Set());
            }}
          >
            دوباره بخوان
          </Button>
          <Link to="/stories" className="block text-center font-bold text-primary">همه‌ی داستان‌ها</Link>
        </div>
      </Page>
    );
  }

  const activeWord = active ? wordAt(active.key) : undefined;
  const meaning = activeWord ? (story.glossary[activeWord.key] ?? meanings.get(activeWord.key)) : undefined;
  const best = p.storyStars[story.id] ?? 0;
  const boxW = box.current?.clientWidth ?? 320;
  const bubbleW = Math.min(POPOVER_W, boxW - 8);
  const bubbleLeft = active ? Math.min(Math.max(active.x - bubbleW / 2, 4), boxW - bubbleW - 4) : 0;

  return (
    <Page>
      <Link to="/stories" className="mb-4 inline-block font-semibold text-primary">› همه‌ی داستان‌ها</Link>
      <header className="mb-5 flex items-center gap-4">
        <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-surface-2 text-4xl">{story.emoji}</span>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold md:text-4xl"><Cyr>{story.titleCyr}</Cyr></h1>
          <p className="text-muted">
            {story.titleFa} · سطح {n(story.level)} ({LEVEL_FA[story.level]}) · {n(total)} کلمه
            {best > 0 && <span className="text-gold"> · {'★'.repeat(best)}</span>}
          </p>
        </div>
      </header>

      <p className="mb-3 flex items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2 text-sm text-muted">
        <span aria-hidden>👆</span>
        اول خودت بخوان. کلمه‌ای را که نتوانستی، لمس کن یا موس را رویش نگه دار تا به خط فارسی ببینی.
      </p>

      <Card className="p-5 md:p-8">
        <div ref={box} className="relative">
          <div className="flex flex-col gap-6">
            {paras.map((para, pi) => (
              <div key={pi}>
                <p dir="ltr" lang="tg" className="cyr text-[1.45rem] leading-[2.3] md:text-[1.7rem]">
                  {para.map((line, li) =>
                    line.map((w, wi) => {
                      const key = `${pi}:${li}:${wi}`;
                      const isActive = active?.key === key;
                      const wasHelped = helped.has(key);
                      return (
                        <span key={key}>
                          <span
                            data-word
                            role="button"
                            tabIndex={0}
                            aria-label={isActive || wasHelped ? `${w.cyr}: ${w.fa}` : w.cyr}
                            aria-expanded={isActive}
                            onClick={(e) => onWordClick(key, e.currentTarget)}
                            onKeyDown={(e) => onWordKey(e, key)}
                            onPointerEnter={(e) => onEnter(e, key)}
                            onPointerLeave={onLeave}
                            className={`cursor-pointer rounded-lg px-0.5 transition-colors select-none hover:bg-primary-soft/60 ${
                              isActive ? 'bg-primary-soft text-primary' : wasHelped ? 'underline decoration-gold decoration-dotted decoration-2 underline-offset-[6px]' : ''
                            }`}
                          >
                            {w.cyr}
                          </span>{' '}
                        </span>
                      );
                    }),
                  )}
                </p>
                {openParas.has(pi) && (
                  <p dir="rtl" className="animate-rise mt-2 rounded-2xl bg-primary-soft/40 px-4 py-3 text-lg leading-loose">
                    {story.paragraphs[pi]!.map((l) => l.persian.replaceAll('_', ' ')).join(' ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => togglePara(pi)}
                  aria-pressed={openParas.has(pi)}
                  className="mt-1 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted transition hover:bg-surface-2"
                >
                  <IconEye width={14} height={14} /> {openParas.has(pi) ? 'پنهان کن' : 'این بند به خط فارسی'}
                </button>
              </div>
            ))}
          </div>

          {active && activeWord && (
            <div
              data-bubble
              role="dialog"
              aria-label={`کمک برای ${activeWord.cyr}`}
              className="animate-pop absolute z-20 rounded-2xl border-2 border-primary/40 bg-surface p-3 shadow-xl"
              style={{
                width: bubbleW,
                left: bubbleLeft,
                ...(active.below ? { top: active.bottom + 6 } : { top: active.top - 6, transform: 'translateY(-100%)' }),
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-2xl leading-tight font-extrabold text-primary">{stripPunct(activeWord.fa)}</p>
                  <Cyr className="text-sm text-muted">{stripPunct(activeWord.cyr)}</Cyr>
                </div>
                {active.pinned && (
                  <button type="button" onClick={() => setActive(null)} aria-label="بستن" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <IconX width={16} height={16} />
                  </button>
                )}
              </div>
              {meaning && <p className="mt-2 text-sm"><span className="text-muted">معنی: </span>{meaning}</p>}
              {active.pinned &&
                (letters ? (
                  <div className="mt-2"><LetterBreakdown word={stripPunct(activeWord.cyr)} compact /></div>
                ) : (
                  <button type="button" onClick={() => setLetters(true)} className="mt-2 text-sm font-semibold text-primary">حرف‌به‌حرف ببین</button>
                ))}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="text-sm text-muted">{helped.size ? `تا اینجا برای ${n(helped.size)} کلمه از ${n(total)} کمک گرفتی.` : 'هنوز کمکی نگرفته‌ای.'}</p>
        <Button className="w-full max-w-sm" onClick={finish}>تمام شد، خواندم!</Button>
      </div>
    </Page>
  );
}

function stripPunct(w: string): string {
  return w.replace(/^[^\p{L}]+|[^\p{L}‌]+$/gu, '');
}
