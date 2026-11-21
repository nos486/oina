import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'good' | 'bad' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink border-black/15',
  secondary: 'bg-surface text-ink border-line',
  good: 'bg-good text-white border-black/15',
  bad: 'bg-bad text-white border-black/15',
  ghost: 'bg-transparent text-primary border-transparent',
};

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-12 rounded-2xl border-2 border-b-4 px-5 py-3 text-base font-bold transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * A screen inside the app shell. `wide` pages (path, profile) use the extra room on desktop
 * for a second column; the others stay at a comfortable reading width.
 */
export function Page({ children, title, subtitle, wide = false, actions }: { children: ReactNode; title?: string; subtitle?: string; wide?: boolean; actions?: ReactNode }) {
  return (
    <main className={`animate-rise mx-auto w-full px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12 ${wide ? 'max-w-[720px] lg:max-w-[1120px]' : 'max-w-[720px] lg:max-w-[860px]'}`}>
      {(title || actions) && (
        <header className="mb-5 flex items-end justify-between gap-3">
          <div>
            {title && <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>}
            {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </main>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-4 w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-good transition-all duration-300" style={{ width: `${Math.max(4, value * 100)}%` }} />
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card rounded-3xl border-2 border-line bg-surface p-4 ${className}`}>{children}</div>;
}
