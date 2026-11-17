import { describe, expect, it } from 'vitest';
import { app, originAllowed } from '../src/app.js';

const env = { ALLOWED_ORIGINS: 'https://oina.app' };
const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers }, env);

describe('api', () => {
  it('serves the whole content bundle with an ETag', async () => {
    const res = await get('/api/v1/content');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { letters: unknown[]; lessons: unknown[]; version: string };
    expect(body.letters).toHaveLength(35);
    expect(body.lessons.length).toBeGreaterThan(20);
    const etag = res.headers.get('ETag')!;
    expect(etag).toContain(body.version);
    const again = await get('/api/v1/content', { 'If-None-Match': etag });
    expect(again.status).toBe(304);
  });

  it('serves one lesson with its letters and words', async () => {
    const res = await get('/api/v1/lessons/s1-l1');
    const body = (await res.json()) as { letters: { id: string }[]; wordItems: { id: string }[] };
    expect(body.letters.map((l) => l.id)).toEqual(['o', 'm', 'n']);
    expect(body.wordItems.map((w) => w.id)).toContain('non');
    expect((await get('/api/v1/lessons/nope')).status).toBe(404);
  });

  it('filters letters and words', async () => {
    const tg = (await (await get('/api/v1/letters?track=tg')).json()) as unknown[];
    expect(tg).toHaveLength(35);
    const names = (await (await get('/api/v1/words?tag=' + encodeURIComponent('نام خاص'))).json()) as { cyrillic: string }[];
    expect(names.some((w) => w.cyrillic === 'Тоҷикистон')).toBe(true);
  });

  it('only allows configured origins and localhost', async () => {
    const ok = await get('/api/v1/stages', { Origin: 'https://oina.app' });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://oina.app');
    const dev = await get('/api/v1/stages', { Origin: 'http://localhost:5173' });
    expect(dev.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    const bad = await get('/api/v1/stages', { Origin: 'https://evil.example' });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns JSON 404s and reserves v2 routes', async () => {
    expect((await get('/nope')).status).toBe(404);
    expect((await get('/api/v1/progress')).status).toBe(501);
    expect((await get('/audio/tg/words/non.mp3')).status).toBe(404);
  });
});

describe('origin allowlist', () => {
  const rules = ['https://oina.geekio.org', 'https://oina.pages.dev', 'https://*.oina.pages.dev'];
  it('allows the production and preview origins', () => {
    expect(originAllowed('https://oina.geekio.org', rules)).toBe(true);
    expect(originAllowed('https://oina.pages.dev', rules)).toBe(true);
    expect(originAllowed('https://abc123.oina.pages.dev', rules)).toBe(true);
    expect(originAllowed('http://localhost:5173', rules)).toBe(true);
  });
  it('rejects look-alikes', () => {
    expect(originAllowed('https://evil.dev', rules)).toBe(false);
    expect(originAllowed('https://eviloina.pages.dev', rules)).toBe(false);
    expect(originAllowed('http://oina.geekio.org', rules)).toBe(false);
    expect(originAllowed('https://oina.geekio.org.evil.dev', rules)).toBe(false);
  });
});
