import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContentBundle } from '@oina/shared';
import { buildIndex, type ContentIndex } from '@oina/engine';
import { cachedContent, fetchContent } from '../lib/api';

const Ctx = createContext<ContentIndex | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<ContentBundle | null>(() => cachedContent());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchContent()
      .then((b) => alive && setBundle((cur) => (cur?.version === b.version ? cur : b)))
      .catch((e: unknown) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (bundle ? buildIndex(bundle) : null), [bundle]);

  if (!index) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        {error ? (
          <div>
            <p className="mb-3 text-lg font-semibold">محتوا بارگیری نشد</p>
            <p className="mb-4 text-sm text-muted">اتصال اینترنت را بررسی کن و دوباره امتحان کن.</p>
            <button className="rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-ink" onClick={() => location.reload()}>
              دوباره
            </button>
          </div>
        ) : (
          <p className="text-muted">در حال بارگیری…</p>
        )}
      </div>
    );
  }
  return <Ctx.Provider value={index}>{children}</Ctx.Provider>;
}

export function useContent(): ContentIndex {
  const v = useContext(Ctx);
  if (!v) throw new Error('useContent outside ContentProvider');
  return v;
}
