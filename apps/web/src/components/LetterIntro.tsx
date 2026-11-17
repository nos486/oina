import type { Letter } from '@oina/shared';
import { audioPath } from '@oina/shared';
import { useContent } from '../state/content';
import { Button, ProgressBar } from './ui';
import { Cyr, CyrHighlight } from './Cyr';
import { SoundButton } from './SoundButton';
import { CATEGORY } from './categories';

/** Big letter card: shape, Persian value, sound, visual hook, example words (design doc, section 7). */
export function LetterIntro({ letter, step, total, onNext, onExit }: { letter: Letter; step: number; total: number; onNext: () => void; onExit: () => void }) {
  const index = useContent();
  const cat = CATEGORY[letter.category];
  const examples = letter.examples.map((id) => index.wordById.get(id)).filter((w) => !!w);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col px-4 pt-3 pb-6">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" aria-label="خروج" onClick={onExit} className="text-2xl text-muted">✕</button>
        <ProgressBar value={(step - 1) / (total + 1)} />
      </div>
      <p className="mb-2 text-sm text-muted">حرف تازه {step} از {total}</p>
      <div className="animate-pop flex flex-1 flex-col items-center gap-5 rounded-3xl border-2 border-line bg-surface p-6 text-center">
        <span className={`rounded-full px-3 py-1 text-sm font-bold text-white ${cat.bg}`}>{cat.labelFa}</span>
        <Cyr className={`text-[6rem] leading-none font-bold ${cat.color}`}>{letter.upper} {letter.lower}</Cyr>
        <p className="text-4xl font-extrabold">= {letter.persian.join(' / ')}</p>
        <div className="flex gap-3">
          <SoundButton path={audioPath.letterSound(letter.id)} label="صدای حرف" />
          <SoundButton path={audioPath.letterSound(letter.id)} slow label="آهسته" />
          <SoundButton path={audioPath.letterName(letter.id)} label="نام حرف" />
        </div>
        <p className="text-lg">💡 {letter.mnemonicFa}</p>
        {letter.lookalike && letter.category === 'trap' && (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
            مراقب باش: شبیه <span dir="ltr">{letter.lookalike}</span> لاتین است ولی «{letter.persian[0]}» خوانده می‌شود
          </p>
        )}
        <ul className="flex flex-wrap justify-center gap-3">
          {examples.map((w) => (
            <li key={w.id} className="rounded-2xl bg-surface-2 px-4 py-2">
              <CyrHighlight text={w.cyrillic} letters={[letter.upper, letter.lower]} className="text-2xl font-bold" />
              <span className="block text-muted">{w.persian}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button className="mt-6 w-full" onClick={onNext} autoFocus>بعدی</Button>
    </div>
  );
}
