import { useEffect, useState } from 'react';
import { Card } from './ui';
import { n } from '../lib/format';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 up to `to` over `ms`. */
export function useCountUp(to: number, ms = 900): number {
  const [v, setV] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced()) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

export function CountUp({ value }: { value: number }) {
  return <>{n(useCountUp(value))}</>;
}

/** Three stars that pop in one after another; `value` of them are filled. */
export function StarRow({ value, size = 'text-5xl' }: { value: number; size?: string }) {
  return (
    <div className={`flex justify-center gap-2 ${size}`} aria-label={`${n(value)} ستاره از ۳`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`inline-block ${i <= value ? 'animate-star text-gold drop-shadow-[0_3px_0_rgb(0_0_0/0.15)]' : 'text-line'}`}
          style={{ animationDelay: `${0.25 + i * 0.22}s` }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/** Shown on a result screen when this session pushed today's XP past the daily goal. */
export function GoalReached({ streak }: { streak: number }) {
  return (
    <Card className="animate-pop mb-4 border-cat-trap bg-[color-mix(in_srgb,var(--cat-trap)_12%,transparent)] text-center">
      <p className="text-3xl" aria-hidden>🔥</p>
      <p className="text-lg font-extrabold text-cat-trap">هدف امروز کامل شد!</p>
      <p className="text-sm text-muted">{streak > 1 ? `${n(streak)} روز پشت سر هم. فردا هم بیا!` : 'فردا هم بیا تا روزشمارت شروع شود.'}</p>
    </Card>
  );
}

export function LevelUp({ level }: { level: number }) {
  return (
    <Card className="animate-pop mb-4 border-primary bg-primary-soft text-center">
      <p className="text-3xl" aria-hidden>🎉</p>
      <p className="text-lg font-extrabold text-primary">رسیدی به سطح {n(level)}!</p>
    </Card>
  );
}
