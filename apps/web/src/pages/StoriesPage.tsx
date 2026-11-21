import { Link } from 'react-router';
import type { Story } from '@oina/shared';
import { useProgress } from '../state/progress';
import { Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { LEVEL_FA, STORIES, storyText, storyWordCount } from '../lib/stories';
import { useLetterCoverage } from './ReadingPage';
import { n } from '../lib/format';

function Stars({ value }: { value: number }) {
  return (
    <span className="text-sm tracking-tight" aria-label={`${n(value)} ستاره از ۳`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden className={i <= value ? 'text-gold' : 'text-line'}>★</span>
      ))}
    </span>
  );
}

/** The library of short stories, grouped by difficulty. */
export function StoriesPage() {
  const p = useProgress();
  const coverage = useLetterCoverage();
  const levels = [...new Set(STORIES.map((s) => s.level))];
  const read = STORIES.filter((s) => p.storyStars[s.id]).length;

  return (
    <Page title="داستان‌های کوتاه" subtitle="داستان‌های چندبندی به تاجیکی. خودت بخوان؛ هر کلمه را نتوانستی، لمس کن یا موس را رویش نگه دار.">
      <p className="mb-5 text-sm text-muted">
        {read ? `${n(read)} از ${n(STORIES.length)} داستان را خوانده‌ای.` : 'هر چه کمتر کمک بگیری، ستاره‌ی بیشتری می‌گیری.'}
      </p>
      {levels.map((level) => (
        <section key={level} className="mb-6">
          <h2 className="mb-3 font-bold text-muted">سطح {n(level)} · {LEVEL_FA[level as Story['level']]}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STORIES.filter((s) => s.level === level).map((s) => {
              const c = coverage(storyText(s));
              const stars = p.storyStars[s.id] ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    to={`/stories/${s.id}`}
                    aria-label={`${s.titleFa} (${s.titleCyr})`}
                    className="card flex h-full flex-col gap-2 rounded-3xl border-2 border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">{s.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <Cyr className="block text-xl font-bold">{s.titleCyr}</Cyr>
                        <p className="text-sm text-muted">{s.titleFa} · {n(storyWordCount(s))} کلمه</p>
                      </div>
                      {stars > 0 && <Stars value={stars} />}
                    </div>
                    <p className="text-sm">{s.summaryFa}</p>
                    <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted">
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
        </section>
      ))}
      <Link to="/reading" className="card flex items-center justify-between rounded-3xl border-2 border-dashed border-line bg-surface/70 p-4 font-semibold">
        <span>متن‌های کوتاه‌تر، ضرب‌المثل و شعر در اتاق مطالعه</span>
        <span aria-hidden className="text-primary">←</span>
      </Link>
    </Page>
  );
}
