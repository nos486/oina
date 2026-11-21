import { useEffect, useMemo, useState } from 'react';
import type { MatchQuestion, Response } from '@oina/engine';
import { shuffle, createRng } from '@oina/engine';
import { Cyr } from '../components/Cyr';
import { fxCorrect, fxWrong } from '../lib/fx';

/** Tap a Cyrillic word, then its Persian pair. Finishes by itself when all pairs are matched. */
export function MatchExercise({ q, onDone }: { q: MatchQuestion; onDone: (r: Response) => void }) {
  const right = useMemo(() => shuffle(q.pairs, createRng(q.pairs.length * 7919 + q.id.length)), [q]);
  const [left, setLeft] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<{ pairId: string; chosenFa: string }[]>([]);
  const [shake, setShake] = useState<string | null>(null);

  useEffect(() => {
    setLeft(null);
    setDone([]);
    setWrong([]);
  }, [q.id]);

  const tapRight = (pairId: string) => {
    if (!left) return;
    if (left === pairId) {
      fxCorrect();
      const next = [...done, pairId];
      setDone(next);
      setLeft(null);
      if (next.length === q.pairs.length) onDone({ type: 'match', wrongPairs: wrong });
    } else {
      fxWrong();
      const chosenFa = q.pairs.find((p) => p.id === pairId)!.fa;
      if (!wrong.some((w) => w.pairId === left)) setWrong([...wrong, { pairId: left, chosenFa }]);
      setShake(pairId);
      setTimeout(() => setShake(null), 300);
      setLeft(null);
    }
  };

  const cell = (active: boolean, isDone: boolean) =>
    `min-h-14 w-full rounded-2xl border-2 border-b-4 px-2 py-2 text-xl font-bold transition ${
      isDone ? 'border-line bg-good-soft text-good opacity-60' : active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
    }`;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">جفت‌ها را پیدا کن</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {q.pairs.map((p) => (
            <button key={p.id} type="button" disabled={done.includes(p.id)} onClick={() => setLeft(p.id)} className={cell(left === p.id, done.includes(p.id))}>
              <Cyr className="text-2xl">{p.cyr}</Cyr>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {right.map((p) => (
            <button key={p.id} type="button" disabled={done.includes(p.id)} onClick={() => tapRight(p.id)}
              className={`${cell(false, done.includes(p.id))} ${shake === p.id ? 'animate-shake border-bad' : ''}`}>
              {p.fa}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
