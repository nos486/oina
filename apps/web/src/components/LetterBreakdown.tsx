import { useContent } from '../state/content';
import { Cyr } from './Cyr';

/** A Cyrillic word letter by letter, each letter with its Persian sound(s). */
export function LetterBreakdown({ word, compact = false }: { word: string; compact?: boolean }) {
  const index = useContent();
  const parts = [...word.normalize('NFC')].map((text) => ({ text, letter: index.letterByChar.get(text) }));
  return (
    <ul className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`} dir="ltr">
      {parts.map((p, i) =>
        p.letter ? (
          <li key={i} className={`flex flex-col items-center rounded-xl bg-surface ${compact ? 'min-w-9 px-1.5 py-1' : 'min-w-14 px-2 py-1.5'}`}>
            <Cyr className={`${compact ? 'text-base' : 'text-xl'} font-bold`}>{p.text}</Cyr>
            <span className={`${compact ? 'text-xs' : 'text-sm'} text-muted`} dir="rtl">{p.letter.persian.join(' / ')}</span>
          </li>
        ) : (
          <li key={i} className="self-center text-muted">{p.text}</li>
        ),
      )}
    </ul>
  );
}
