import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiError, StageSummary } from '@oina/shared';
import { allReadings, bundle, CONTENT_VERSION } from './content.js';

export interface Env {
  ALLOWED_ORIGINS?: string;
  AUDIO?: R2Bucket;
}

const DAY = 86400;

const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const allowed = (c.env?.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (origin && (isLocal(origin) || allowed.includes(origin)) ? origin : null),
    allowMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST'],
    maxAge: DAY,
  })(c, next);
});

/** JSON with cache headers and ETag (content only changes on deploy). */
function cached(c: { req: { header: (n: string) => string | undefined }; body: (b: null, s: 304, h: Record<string, string>) => Response; json: (d: unknown, s?: 200, h?: Record<string, string>) => Response }, data: unknown, maxAge = DAY) {
  const etag = `W/"${CONTENT_VERSION}"`;
  const headers = { 'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge}`, ETag: etag };
  if (c.req.header('If-None-Match') === etag) return c.body(null, 304, headers);
  return c.json(data, 200, headers);
}

const notFound = (what: string): ApiError => ({ error: `${what} not found` });

const api = new Hono<{ Bindings: Env }>();

api.get('/health', (c) => c.json({ ok: true, version: CONTENT_VERSION }));

/** Everything the client needs in one request (used by the web app and cached for offline). */
api.get('/content', (c) => cached(c, bundle));

api.get('/stages', (c) => {
  const stages: StageSummary[] = bundle.stages.map((s) => ({
    ...s,
    lessons: s.lessons.map((id) => {
      const l = bundle.lessons.find((x) => x.id === id)!;
      return { id: l.id, titleFa: l.titleFa, newLetters: l.newLetters };
    }),
  }));
  return cached(c, stages);
});

api.get('/lessons/:id', (c) => {
  const lesson = bundle.lessons.find((l) => l.id === c.req.param('id'));
  if (!lesson) return c.json(notFound('lesson'), 404);
  return cached(c, {
    ...lesson,
    letters: bundle.letters.filter((l) => lesson.newLetters.includes(l.id)),
    wordItems: bundle.words.filter((w) => lesson.words.includes(w.id)),
  });
});

api.get('/letters', (c) => {
  const track = c.req.query('track');
  return cached(c, track ? bundle.letters.filter((l) => l.tracks.includes(track as 'tg' | 'ru')) : bundle.letters);
});

api.get('/words', (c) => {
  const tag = c.req.query('tag');
  const lang = c.req.query('lang');
  return cached(c, bundle.words.filter((w) => (!tag || w.tags.includes(tag)) && (!lang || w.lang === lang)));
});

api.get('/readings', (c) => cached(c, allReadings.map(({ lines: _lines, ...r }) => r)));
api.get('/readings/:id', (c) => {
  const r = allReadings.find((x) => x.id === c.req.param('id'));
  return r ? cached(c, r) : c.json(notFound('reading'), 404);
});

/** Small dictionary for the script converter (v1.1): Cyrillic → correct Persian spelling. */
api.get('/dictionary', (c) =>
  cached(c, Object.fromEntries(bundle.words.map((w) => [w.cyrillic.toLowerCase(), w.persian])), 7 * DAY),
);

// v2 (accounts and sync) — reserved so the client contract is clear.
api.all('/auth/*', (c) => c.json({ error: 'not implemented yet' }, 501));
api.all('/progress', (c) => c.json({ error: 'not implemented yet' }, 501));

app.route('/api/v1', api);

/** Audio from R2, if the bucket is bound. Otherwise the web app serves /audio from Pages. */
app.get('/audio/*', async (c) => {
  if (!c.env?.AUDIO) return c.json(notFound('audio'), 404);
  const key = c.req.path.replace(/^\/audio\//, '');
  const obj = await c.env.AUDIO.get(key);
  if (!obj) return c.json(notFound('audio'), 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=2592000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(obj.body, { headers });
});

app.notFound((c) => c.json({ error: 'not found' } satisfies ApiError, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' } satisfies ApiError, 500);
});
