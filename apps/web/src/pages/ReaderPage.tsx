import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { splitWords } from '@oina/engine';
import { Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { IconEye } from '../components/icons';
import { READINGS } from '../lib/readings';

/** One text of the reading room. Each word reveals its Persian form when tapped. */
export function ReaderPage() {
  const { id } = useParams();
  const r = READINGS.find((x) => x.id === id);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  if (!r) return <Navigate to="/reading" replace />;

  const toggle = (key: string) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const i = READINGS.indexOf(r);
  const nextText = READINGS[i + 1];

  return (
    <Page
      title={r.titleFa}
      subtitle={r.sourceFa}
      actions={
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-pressed={all}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${all ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted'}`}
        >
          <IconEye width={18} height={18} /> {all ? 'پنهان کن' : 'همه را نشان بده'}
        </button>
      }
    >
      <Link to="/reading" className="mb-4 inline-block font-semibold text-primary">› همه‌ی متن‌ها</Link>
      <Card className="p-5 md:p-8">
        <div className="flex flex-col gap-6">
          {r.lines.map((line, li) => {
            const cyr = splitWords(line.cyrillic);
            const fa = splitWords(line.persian);
            return (
              <p key={li} className={`flex flex-wrap gap-x-3 gap-y-2 ${r.kind === 'poem' ? 'justify-center' : ''}`} dir="ltr">
                {cyr.map((w, wi) => {
                  const key = `${li}:${wi}`;
                  const open = all || shown.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className={`flex flex-col items-center rounded-xl px-1.5 py-0.5 transition hover:bg-surface-2 ${open ? 'bg-primary-soft/50' : ''}`}
                      aria-label={open ? `${w}: ${fa[wi] ?? ''}` : w}
                    >
                      <span className={`text-base leading-6 font-semibold text-primary transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} dir="rtl">
                        {fa[wi] ?? ''}
                      </span>
                      <Cyr className="text-2xl md:text-3xl">{w}</Cyr>
                    </button>
                  );
                })}
              </p>
            );
          })}
        </div>
      </Card>
      <p className="mt-3 text-center text-sm text-muted">اول خودت بخوان، بعد روی کلمه بزن و جوابت را ببین.</p>
      {nextText && (
        <Link to={`/reading/${nextText.id}`} className="card mt-6 flex items-center justify-between rounded-3xl border-2 border-line bg-surface p-4 font-bold">
          <span>
            <span className="block text-sm font-normal text-muted">متن بعدی</span>
            {nextText.titleFa}
          </span>
          <span aria-hidden className="text-primary">←</span>
        </Link>
      )}
    </Page>
  );
}
