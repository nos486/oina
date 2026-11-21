import { useMemo, useRef, useState } from 'react';
import { buildTranslitDict, cyrillicToPersian, type TranslitToken } from '@oina/engine';
import { useContent } from '../state/content';
import { Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { IconCopy, IconX } from '../components/icons';
import { readingWordPairs } from '../lib/readings';
import { storyWordPairs } from '../lib/stories';
import { LetterBreakdown } from '../components/LetterBreakdown';
import { storage } from '../lib/storage';

const DRAFT_KEY = 'converter:draft';
/** Tajik letters most keyboards lack. */
const EXTRA_KEYS = ['ғ', 'ӣ', 'қ', 'ӯ', 'ҳ', 'ҷ', 'ъ'];
const EXAMPLES = [
  'Салом! Ман аз Эрон ҳастам.',
  'Бишнав аз най чун ҳикоят мекунад',
  'Қатра-қатра ҷамъ гардад, вонгаҳе дарё шавад.',
  'Душанбе пойтахти Тоҷикистон аст.',
];

/** One word, tapped: how each Cyrillic letter maps to Persian. */
function Breakdown({ token, onClose }: { token: TranslitToken; onClose: () => void }) {
  return (
    <div className="animate-rise mt-4 rounded-2xl border-2 border-primary/30 bg-primary-soft/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Cyr className="text-2xl font-bold">{token.src}</Cyr>
          <span className="mx-2 text-muted">←</span>
          <span className="text-2xl font-bold">{token.out}</span>
          <p className="mt-1 text-sm text-muted">
            {token.kind === 'dict' ? 'این کلمه در واژه‌نامه‌ی آینه هست، پس شکلش مطمئن است.' : 'این کلمه در واژه‌نامه نبود و با قاعده‌ها حدس زده شد.'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface">
          <IconX width={18} height={18} />
        </button>
      </div>
      <LetterBreakdown word={token.src} />
    </div>
  );
}

/** Tajik Cyrillic → Persian script, word by word, with the guesses marked. */
export function ConverterPage() {
  const index = useContent();
  const [text, setText] = useState(() => storage.get(DRAFT_KEY) ?? '');
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const dict = useMemo(
    () => buildTranslitDict(index.words.filter((w) => w.lang === 'tg').map((w) => [w.cyrillic, w.persian] as [string, string]), [...readingWordPairs(), ...storyWordPairs()]),
    [index],
  );
  const tokens = useMemo(() => cyrillicToPersian(text, dict), [text, dict]);
  const output = tokens.map((t) => t.out).join('');
  const words = tokens.filter((t) => t.kind !== 'other');
  const guessed = words.filter((t) => t.kind === 'rule').length;

  const update = (v: string) => {
    setText(v);
    setPicked(null);
    storage.set(DRAFT_KEY, v);
  };

  const insert = (ch: string) => {
    const el = area.current;
    if (!el) return update(text + ch);
    const { selectionStart: a, selectionEnd: b } = el;
    update(text.slice(0, a) + ch + text.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + ch.length, a + ch.length);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <Page title="مبدل خط" subtitle="متن تاجیکی (سیریلیک) را بنویس یا بچسبان تا به خط فارسی ببینی.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">سیریلیک تاجیکی</h2>
            {text && (
              <button type="button" onClick={() => update('')} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted hover:bg-surface-2">
                <IconX width={16} height={16} /> پاک کن
              </button>
            )}
          </div>
          <textarea
            ref={area}
            dir="ltr"
            lang="tg"
            value={text}
            onChange={(e) => update(e.target.value)}
            placeholder="Салом! Номи ман…"
            rows={6}
            spellCheck={false}
            className="cyr min-h-40 w-full flex-1 resize-y rounded-2xl border-2 border-line bg-bg p-3 text-xl leading-relaxed outline-none focus:border-primary focus-visible:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr" aria-label="حروف ویژه‌ی تاجیکی">
            {EXTRA_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => insert(k)} className="cyr h-10 min-w-10 rounded-xl border-2 border-b-4 border-line bg-surface px-2 text-lg font-bold transition active:translate-y-0.5 active:border-b-2">
                {k}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">خط فارسی</h2>
            {output.trim() && (
              <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-soft">
                <IconCopy width={16} height={16} /> {copied ? 'کپی شد' : 'کپی'}
              </button>
            )}
          </div>
          <div className="min-h-40 flex-1 rounded-2xl bg-surface-2/60 p-3 text-2xl leading-loose whitespace-pre-wrap" aria-live="polite">
            {tokens.length === 0 ? (
              <span className="text-lg text-muted">نتیجه اینجا نمایش داده می‌شود.</span>
            ) : (
              tokens.map((t, i) =>
                t.kind === 'other' ? (
                  <span key={i}>{t.out}</span>
                ) : (
                  // An inline span (not a <button>, which is inline-block) so a line never breaks
                  // between a word and the punctuation after it.
                  <span
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPicked(picked === i ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPicked(picked === i ? null : i);
                      }
                    }}
                    title={t.src}
                    className={`cursor-pointer rounded-md transition select-text hover:bg-primary-soft ${picked === i ? 'bg-primary-soft text-primary' : ''} ${t.kind === 'rule' ? 'underline decoration-cat-trap/70 decoration-dotted decoration-2 underline-offset-8' : ''}`}
                  >
                    {t.out}
                  </span>
                ),
              )
            )}
          </div>
          {words.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {guessed === 0 ? 'همه‌ی کلمه‌ها از واژه‌نامه آمدند.' : 'کلمه‌های نقطه‌چین حدسی‌اند (خط سیریلیک حرف‌هایی مثل ص/س/ث یا ح/ه را از هم جدا نمی‌کند).'} روی هر کلمه بزن تا حرف‌به‌حرف ببینی.
            </p>
          )}
        </Card>
      </div>

      {picked !== null && tokens[picked] && <Breakdown token={tokens[picked]} onClose={() => setPicked(null)} />}

      {!text && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold text-muted">چند نمونه</h2>
          <ul className="flex flex-col gap-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <button type="button" onClick={() => update(e)} className="w-full rounded-2xl border-2 border-line bg-surface p-3 text-start transition hover:border-primary/40" dir="ltr">
                  <Cyr className="text-lg">{e}</Cyr>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
