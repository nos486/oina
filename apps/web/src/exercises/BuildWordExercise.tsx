import { useEffect, useState } from 'react';
import type { BuildWordQuestion, Response } from '@oina/engine';
import { Cyr } from '../components/Cyr';
import { SoundButton } from '../components/SoundButton';

export function BuildWordExercise({ q, locked, onChange }: { q: BuildWordQuestion; locked: boolean; onChange: (r: Response | null) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [q.id]);

  const update = (next: string[]) => {
    setPicked(next);
    const labels = next.map((id) => q.tiles.find((t) => t.id === id)!.label);
    onChange(next.length ? { type: 'build', labels } : null);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">این کلمه را با حروف سیریلیک بساز</h2>
      <div className="flex items-center justify-center gap-4 rounded-3xl bg-surface-2 p-6">
        <span className="text-5xl font-extrabold">{q.prompt.text}</span>
        {q.prompt.audio && <SoundButton path={q.prompt.audio} />}
      </div>
      <div dir="ltr" className="flex min-h-20 flex-wrap items-center justify-center gap-2 border-b-2 border-line pb-3" aria-label="کلمه‌ی ساخته‌شده">
        {picked.map((id) => {
          const t = q.tiles.find((x) => x.id === id)!;
          return (
            <button key={id} type="button" disabled={locked} onClick={() => update(picked.filter((x) => x !== id))}
              className="min-h-14 min-w-12 rounded-xl border-2 border-b-4 border-line bg-surface px-3 text-3xl font-bold animate-pop">
              <Cyr>{t.label}</Cyr>
            </button>
          );
        })}
      </div>
      <div dir="ltr" className="flex flex-wrap justify-center gap-2">
        {q.tiles.map((t) => {
          const used = picked.includes(t.id);
          return (
            <button key={t.id} type="button" disabled={locked || used} aria-label={t.label}
              onClick={() => update([...picked, t.id])}
              className={`min-h-14 min-w-12 rounded-xl border-2 border-b-4 px-3 text-3xl font-bold transition ${used ? 'border-line bg-surface-2 opacity-0' : 'border-line bg-surface'}`}>
              <Cyr>{t.label}</Cyr>
            </button>
          );
        })}
      </div>
    </div>
  );
}
