import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { signToken, verifyToken } from '../src/auth/token.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { createTestD1 } from './d1.js';

let env: { DB: D1Database; ALLOWED_ORIGINS: string };
beforeEach(() => {
  env = { DB: createTestD1(), ALLOWED_ORIGINS: 'https://oina.geekio.org' };
});

const req = (path: string, init: RequestInit = {}, e: object = env) => app.request(path, init, e);
const post = (path: string, body: unknown, token?: string, method = 'POST') =>
  req(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
async function login(username: string, password: string) {
  const res = await post('/api/v1/auth/login', { username, password });
  return { res, token: res.ok ? ((await res.json()) as { token: string }).token : '' };
}

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('hunter22');
    expect(await verifyPassword('hunter22', h)).toBe(true);
    expect(await verifyPassword('hunter23', h)).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
  });
});

describe('login with D1', () => {
  it('the seeded admin/admin works and is flagged as a default password', async () => {
    const { res, token } = await login('admin', 'admin');
    expect(res.status).toBe(200);
    const me = await req('/api/v1/auth/me', bearer(token));
    const body = (await me.json()) as { user: { roles: string[] }; defaultPassword: boolean };
    expect(body.user.roles).toContain('admin');
    expect(body.defaultPassword).toBe(true);
  });

  it('usernames are case-insensitive; wrong passwords fail', async () => {
    expect((await login('ADMIN', 'admin')).res.status).toBe(200);
    expect((await login('admin', 'nope')).res.status).toBe(401);
    expect((await login('ghost', 'admin')).res.status).toBe(401);
    expect((await post('/api/v1/auth/login', 'x')).status).toBe(400);
  });

  it('changing the password replaces admin/admin', async () => {
    const { token } = await login('admin', 'admin');
    expect((await post('/api/v1/auth/password', { currentPassword: 'bad', newPassword: 'newpass1' }, token)).status).toBe(403);
    expect((await post('/api/v1/auth/password', { currentPassword: 'admin', newPassword: '123' }, token)).status).toBe(400);
    expect((await post('/api/v1/auth/password', { currentPassword: 'admin', newPassword: 'newpass1' }, token)).status).toBe(200);
    expect((await login('admin', 'admin')).res.status).toBe(401);
    const again = await login('admin', 'newpass1');
    expect(again.res.status).toBe(200);
    const me = (await (await req('/api/v1/auth/me', bearer(again.token))).json()) as { defaultPassword: boolean };
    expect(me.defaultPassword).toBe(false);
  });

  it('registers regular users without admin rights', async () => {
    const res = await post('/api/v1/auth/register', { username: 'Sara', password: 'secret1' });
    expect(res.status).toBe(200);
    const { token, user } = (await res.json()) as { token: string; user: { roles: string[]; name: string } };
    expect(user.roles).toEqual(['user']);
    expect(user.name).toBe('sara');
    expect((await post('/api/v1/auth/register', { username: 'sara', password: 'secret1' })).status).toBe(409);
    expect((await post('/api/v1/auth/register', { username: 'a', password: 'secret1' })).status).toBe(400);
    expect((await req('/api/v1/admin/stats', bearer(token))).status).toBe(403);
  });

  it('keeps one signing secret in D1 so tokens work across requests', async () => {
    const { token } = await login('admin', 'admin');
    expect((await req('/api/v1/auth/me', bearer(token))).status).toBe(200);
    // A different database has a different secret.
    expect((await req('/api/v1/auth/me', bearer(token), { DB: createTestD1() })).status).toBe(401);
  });

  it('answers 503 without a D1 binding, while content still works', async () => {
    expect((await req('/api/v1/auth/login', { method: 'POST', body: '{}' }, {})).status).toBe(503);
    expect((await req('/api/v1/progress', {}, {})).status).toBe(503);
    expect((await req('/api/v1/content', {}, {})).status).toBe(200);
  });
});

describe('progress sync', () => {
  const base = { version: 1, onboarded: true, settings: { hearts: true } };

  it('needs a signed-in user', async () => {
    expect((await req('/api/v1/progress')).status).toBe(401);
  });

  it('saves, returns and merges progress ("most progress wins")', async () => {
    const { token } = await login('admin', 'admin');
    const empty = (await (await req('/api/v1/progress', bearer(token))).json()) as { progress: unknown };
    expect(empty.progress).toBeNull();

    // Phone: lessons 1–2, 120 XP.
    const a = await post('/api/v1/progress', { ...base, completedLessons: ['s1-l1', 's1-l2'], xp: 120, lessonLevels: { 's1-l1': 2 } }, token, 'PUT');
    expect(a.status).toBe(200);
    // Laptop (older copy): lesson 3 only, 40 XP.
    const b = await post('/api/v1/progress', { ...base, completedLessons: ['s1-l3'], xp: 40, lessonLevels: { 's1-l1': 1, 's1-l3': 1 } }, token, 'PUT');
    const merged = ((await b.json()) as { progress: { completedLessons: string[]; xp: number; lessonLevels: Record<string, number> } }).progress;
    expect(merged.completedLessons.sort()).toEqual(['s1-l1', 's1-l2', 's1-l3']);
    expect(merged.xp).toBe(120);
    expect(merged.lessonLevels).toEqual({ 's1-l1': 2, 's1-l3': 1 });

    const got = (await (await req('/api/v1/progress', bearer(token))).json()) as { progress: { completedLessons: string[] }; updatedAt: string };
    expect(got.progress.completedLessons).toHaveLength(3);
    expect(got.updatedAt).toBeTruthy();

    const stats = (await (await req('/api/v1/admin/stats', bearer(token))).json()) as { users: number; recentUsers: { username: string; xp: number; lessons: number }[] };
    expect(stats.users).toBe(1);
    expect(stats.recentUsers[0]).toMatchObject({ username: 'admin', xp: 120, lessons: 3 });
  });

  it('a newer setting from the client replaces the stored one', async () => {
    const { token } = await login('admin', 'admin');
    await post('/api/v1/progress', { ...base, dailyGoal: 20, xp: 50 }, token, 'PUT');
    const r = await post('/api/v1/progress', { ...base, dailyGoal: 100, xp: 50 }, token, 'PUT');
    expect(((await r.json()) as { progress: { dailyGoal: number } }).progress.dailyGoal).toBe(100);
  });

  it('keeps each user separate and rejects bad payloads', async () => {
    const admin = (await login('admin', 'admin')).token;
    const reg = await post('/api/v1/auth/register', { username: 'sara', password: 'secret1' });
    const sara = ((await reg.json()) as { token: string }).token;
    await post('/api/v1/progress', { ...base, completedLessons: ['s2-l1'], xp: 10 }, sara, 'PUT');
    const adminP = (await (await req('/api/v1/progress', bearer(admin))).json()) as { progress: unknown };
    expect(adminP.progress).toBeNull();
    expect((await post('/api/v1/progress', 'nope', sara, 'PUT')).status).toBe(400);
    expect((await post('/api/v1/progress', { version: 2 }, sara, 'PUT')).status).toBe(400);
  });
});

describe('tokens', () => {
  it('expire and detect tampering', async () => {
    const t = await signToken({ id: 'a', name: 'a', roles: ['admin'], provider: 'password', exp: 100 }, 'k');
    expect(await verifyToken(t, 'k', 99)).not.toBeNull();
    expect(await verifyToken(t, 'k', 101)).toBeNull();
    const [b, sig] = t.split('.');
    expect(await verifyToken(`${b}x.${sig}`, 'k', 99)).toBeNull();
  });

  it('CORS preflight allows the Authorization header', async () => {
    const res = await req('/api/v1/progress', {
      method: 'OPTIONS',
      headers: { Origin: 'https://oina.geekio.org', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization');
  });
});
