import { useEffect } from 'react';
import type { ChoiceQuestion, Response } from '@oina/engine';
import { Cyr } from '../components/Cyr';

const TITLES: Record<ChoiceQuestion['type'], string> = {
  letterToSound: 'این حرف کدام حرف فارسی است؟',
  soundToLetter: 'این حرف فارسی در سیریلیک کدام است؟',
  readWord: 'این کلمه را بخوان',
  spotTrap: 'فریبکار را بگیر! این حرف کدام است؟',
};

export function ChoiceExercise({
  q, selected, locked, onChange,
}: { q: ChoiceQuestion; selected: string | null; locked: boolean; onChange: (r: Response | null, id: string | null) => void }) {
  // Keys 1–4 choose an option (Latin or Persian digits, so a Persian keyboard works too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = Math.max('1234'.indexOf(e.key), '۱۲۳۴'.indexOf(e.key), '١٢٣٤'.indexOf(e.key));
      const opt = q.options[i];
      if (opt) onChange({ type: 'choice', optionId: opt.id }, opt.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, locked, onChange]);

  const big = q.type === 'letterToSound' || q.type === 'spotTrap';
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">{TITLES[q.type]}</h2>
      <div className="flex min-h-36 items-center justify-center gap-4 rounded-3xl bg-surface-2 p-6">
        {q.prompt.script === 'cyr' ? (
          <Cyr className={`${big ? 'text-8xl' : 'text-5xl'} font-bold`}>{q.prompt.text}</Cyr>
        ) : (
          <span className="text-6xl font-extrabold">{q.prompt.text}</span>
        )}
      </div>
      <div className={`grid gap-3 ${q.options.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`} role="radiogroup">
        {q.options.map((o, i) => {
          const isSel = selected === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={locked}
              onClick={() => onChange({ type: 'choice', optionId: o.id }, o.id)}
              className={`relative min-h-16 rounded-2xl border-2 border-b-4 px-3 py-3 text-center transition active:translate-y-0.5 ${
                locked && o.id === q.correctId
                  ? `border-good bg-good-soft ${isSel ? 'animate-bounce-in' : ''}`
                  : locked && isSel
                    ? 'animate-shake border-bad bg-bad-soft'
                    : isSel
                      ? 'border-primary bg-primary-soft'
                      : 'border-line bg-surface'
              }`}
            >
              <span className="absolute top-1.5 right-2 text-xs text-muted">{i + 1}</span>
              {o.script === 'cyr' ? <Cyr className="text-3xl font-bold">{o.label}</Cyr> : <span className="text-2xl font-bold">{o.label}</span>}
              {o.note && <span className="mt-1 block text-xs text-muted">{o.note}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
