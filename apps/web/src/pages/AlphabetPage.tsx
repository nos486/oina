import { useState } from 'react';
import type { Letter } from '@oina/shared';
import { effectiveStrength, letterKey, lettersLearned } from '@oina/engine';
import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { CATEGORY } from '../components/categories';
import { n } from '../lib/format';

/** The alphabet hall: all 35 letters coloured by category; unlearned ones are faded. */
export function AlphabetPage() {
  const index = useContent();
  const p = useProgress();
  const learned = lettersLearned(index, p.completedLessons);
  const [open, setOpen] = useState<Letter | null>(null);
  const now = new Date();
  const letters = index.letters.filter((l) => l.tracks.includes('tg'));

  return (
    <Page title="تالار الفبا">
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(['friend', 'trap', 'new', 'tajik'] as const).map((c) => (
          <span key={c} className={`rounded-full px-2 py-1 font-bold text-white ${CATEGORY[c].bg}`}>{CATEGORY[c].labelFa}</span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2" dir="ltr">
        {letters.map((l) => {
          const strength = effectiveStrength(p.items[letterKey(l.id)], now);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setOpen(l)}
              aria-label={`${l.upper}، ${l.persian[0]}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-b-4 border-line bg-surface ${learned.has(l.id) ? '' : 'opacity-40'}`}
            >
              <Cyr className={`text-2xl font-bold ${CATEGORY[l.category].color}`}>{l.upper}{l.lower}</Cyr>
              <span className="text-sm" dir="rtl">{l.persian[0]}</span>
              <span className="mt-1 h-1 w-8 overflow-hidden rounded bg-surface-2"><span className="block h-full bg-good" style={{ width: `${strength}%` }} /></span>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setOpen(null)}>
          <Card className="animate-slide-up w-full max-w-[720px] rounded-b-none md:rounded-b-3xl">
            <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3 text-center">
              <Cyr className={`text-7xl font-bold ${CATEGORY[open.category].color}`}>{open.upper} {open.lower}</Cyr>
              <p className="text-3xl font-extrabold">= {open.persian.join(' / ')}</p>
              <p className="text-sm text-muted">{CATEGORY[open.category].labelFa} · <span dir="ltr">/{open.ipa}/</span></p>
              <p>💡 {open.mnemonicFa}</p>
              {open.russianNote && <p className="text-sm text-muted">در تابلوهای روسی: {open.russianNote}</p>}
              <ul className="flex flex-wrap justify-center gap-2">
                {open.examples.map((id) => index.wordById.get(id)).filter((w) => !!w).map((w) => (
                  <li key={w.id} className="rounded-xl bg-surface-2 px-3 py-1"><Cyr className="font-bold">{w.cyrillic}</Cyr> = {w.persian}</li>
                ))}
              </ul>
              <p className="text-xs text-muted">قدرت: {n(effectiveStrength(p.items[letterKey(open.id)], now))} از ۱۰۰</p>
              <button type="button" className="font-semibold text-primary" onClick={() => setOpen(null)}>بستن</button>
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
