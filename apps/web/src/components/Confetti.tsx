import { useMemo } from 'react';

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        color: ['#0f9b97', '#f2b01e', '#e8590c', '#7048e8', '#2f9e44'][i % 5],
      })),
    [count],
  );
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 h-3 w-2 rounded-sm"
          style={{ left: `${p.left}%`, background: p.color, animation: `fall ${p.duration}s ${p.delay}s ease-in forwards` }}
        />
      ))}
    </div>
  );
}
