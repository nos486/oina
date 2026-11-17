import type { ReactNode } from 'react';

/** Cyrillic text inside the RTL interface: always LTR, with the right language tag. */
export function Cyr({ children, lang = 'tg', className = '' }: { children: ReactNode; lang?: 'tg' | 'ru'; className?: string }) {
  return (
    <span dir="ltr" lang={lang} className={`cyr ${className}`}>
      {children}
    </span>
  );
}

/** Highlights the given letters inside a Cyrillic word. */
export function CyrHighlight({ text, letters, className = '' }: { text: string; letters: string[]; className?: string }) {
  const set = new Set(letters.flatMap((l) => [l, l.toLowerCase(), l.toUpperCase()]));
  return (
    <Cyr className={className}>
      {[...text].map((ch, i) =>
        set.has(ch) ? (
          <mark key={i} className="rounded bg-gold/40 px-0.5 text-inherit">
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </Cyr>
  );
}
