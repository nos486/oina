import { Link } from 'react-router';
import { lettersLearned, uniqueLetters } from '@oina/engine';
import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { READINGS } from '../lib/readings';
import { n } from '../lib/format';
import type { Reading } from '@oina/shared';

const KIND: Record<NonNullable<Reading['kind']>, { label: string; icon: string }> = {
  everyday: { label: 'روزمره', icon: '💬' },
  proverb: { label: 'ضرب‌المثل', icon: '🪶' },
  poem: { label: 'شعر', icon: '📜' },
};

/** How many of the letters in a text the learner has already been taught (0–1). */
export function useLetterCoverage() {
  const index = useContent();
  const { completedLessons } = useProgress();
  const known = lettersLearned(index, completedLessons);
  return (r: Reading) => {
    const ids = uniqueLetters(r.lines.map((l) => l.cyrillic).join(' '), index.letterByChar);
    return ids.length ? ids.filter((id) => known.has(id)).length / ids.length : 1;
  };
}

/** Reading room: short real texts in Cyrillic, tap a word to see it in Persian script. */
export function ReadingPage() {
  const coverage = useLetterCoverage();
  return (
    <Page title="اتاق مطالعه" subtitle="متن‌های کوتاه به خط سیریلیک. هر کلمه را که نتوانستی بخوانی، لمس کن.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {READINGS.map((r) => {
          const c = coverage(r);
          const k = KIND[r.kind ?? 'everyday'];
          return (
            <li key={r.id}>
              <Link
                to={`/reading/${r.id}`}
                className="card flex h-full flex-col gap-3 rounded-3xl border-2 border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">{k.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.titleFa}</p>
                    <p className="text-sm text-muted">
                      {k.label}
                      {r.sourceFa && ` · ${r.sourceFa}`} · سطح {n(r.level)}
                    </p>
                  </div>
                </div>
                <Cyr className="line-clamp-1 text-lg text-muted">{r.lines[0]?.cyrillic}</Cyr>
                <div className="mt-auto flex items-center gap-2 text-xs text-muted">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${c >= 1 ? 'bg-good' : 'bg-gold'}`} style={{ width: `${Math.max(4, c * 100)}%` }} />
                  </div>
                  {c >= 1 ? 'همه‌ی حروفش را بلدی' : `${n(c * 100)}٪ حروفش را بلدی`}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link to="/converter" className="card mt-4 flex items-center justify-between rounded-3xl border-2 border-dashed border-line bg-surface/70 p-4 font-semibold">
        <span>متن خودت را داری؟ با مبدل خط به فارسی ببینش</span>
        <span aria-hidden className="text-primary">←</span>
      </Link>
    </Page>
  );
}
