import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { signToken, verifyToken } from '../src/auth/token.js';

const req = (path: string, init: RequestInit = {}, env: Record<string, string> = {}) => app.request(path, init, env);
const login = (username: string, password: string, env: Record<string, string> = {}) =>
  req('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }, env);

describe('auth', () => {
  it('logs in with the default admin and reads /me', async () => {
    const res = await login('admin', 'admin');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { roles: string[] } };
    expect(body.user.roles).toEqual(['admin']);
    const me = await req('/api/v1/auth/me', { headers: { Authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { defaultPassword: boolean }).defaultPassword).toBe(true);
  });

  it('uses configured secrets instead of the defaults', async () => {
    const env = { ADMIN_USERNAME: 'sina', ADMIN_PASSWORD: 's3cret', AUTH_SECRET: 'x'.repeat(32) };
    expect((await login('admin', 'admin', env)).status).toBe(401);
    const res = await login('Sina', 's3cret', env);
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    // A token signed with another secret is rejected.
    expect((await req('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
    expect((await req('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }, env)).status).toBe(200);
  });

  it('rejects wrong passwords, bad bodies and missing tokens', async () => {
    expect((await login('admin', 'nope')).status).toBe(401);
    expect((await req('/api/v1/auth/login', { method: 'POST', body: 'x' })).status).toBe(400);
    expect((await req('/api/v1/auth/me')).status).toBe(401);
    expect((await req('/api/v1/admin/stats')).status).toBe(401);
  });

  it('protects admin routes by role', async () => {
    const userToken = await signToken({ id: 'u', name: 'u', roles: ['user'], provider: 'google', exp: 9e9 }, 'oina-dev:admin:admin');
    expect((await req('/api/v1/admin/stats', { headers: { Authorization: `Bearer ${userToken}` } })).status).toBe(403);
    const { token } = (await (await login('admin', 'admin')).json()) as { token: string };
    const stats = await req('/api/v1/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
    expect(stats.status).toBe(200);
    const body = (await stats.json()) as { letters: number; needsReview: unknown[] };
    expect(body.letters).toBe(35);
    expect(body.needsReview.length).toBeGreaterThan(0);
  });

  it('expires tokens and detects tampering', async () => {
    const t = await signToken({ id: 'a', name: 'a', roles: ['admin'], provider: 'password', exp: 100 }, 'k');
    expect(await verifyToken(t, 'k', 99)).not.toBeNull();
    expect(await verifyToken(t, 'k', 101)).toBeNull();
    const [body, sig] = t.split('.');
    expect(await verifyToken(`${body}x.${sig}`, 'k', 99)).toBeNull();
  });

  it('allows the Authorization header in CORS preflight', async () => {
    const res = await req('/api/v1/auth/me', {
      method: 'OPTIONS',
      headers: { Origin: 'https://oina.geekio.org', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    }, { ALLOWED_ORIGINS: 'https://oina.geekio.org' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization');
  });
});
