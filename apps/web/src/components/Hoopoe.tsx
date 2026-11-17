/** Ҳудҳуд, the guide (a nod to Attar's Conference of the Birds). Simple inline SVG. */
export function Hoopoe({ size = 64, mood = 'happy' }: { size?: number; mood?: 'happy' | 'cheer' | 'sad' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="هدهد">
      <path d="M22 18 L18 4 L26 14 L28 2 L32 14 L37 4 L36 17 Z" fill="#e8590c" />
      <path d="M22 9 L24 13 M30 6 L31 12 M35 8 L34 13" stroke="#1d2a2c" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="32" cy="40" rx="18" ry="17" fill="#f4a261" />
      <path d="M18 42 Q32 62 48 44 L46 52 Q32 64 20 52 Z" fill="#1d2a2c" opacity="0.85" />
      <path d="M22 46 L44 46 M24 51 L42 51" stroke="#faf6ee" strokeWidth="2.5" />
      <circle cx="36" cy="32" r={mood === 'sad' ? 2.5 : 3.5} fill="#1d2a2c" />
      <path d="M45 33 Q56 36 60 42" stroke="#1d2a2c" strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood === 'cheer' && <path d="M8 28 l4 -4 M6 36 h6 M10 44 l4 2" stroke="#f2b01e" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}
