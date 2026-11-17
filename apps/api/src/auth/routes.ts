import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { AdminStats, AuthUser, LoginRequest, LoginResponse, Role } from '@oina/shared';
import { bundle, CONTENT_VERSION } from '../content.js';
import { type AuthEnv, passwordLogin, signingSecret, usingDefaultPassword } from './providers.js';
import { signToken, verifyToken } from './token.js';

export const SESSION_DAYS = 30;

type Vars = { user: AuthUser };
type AuthContext = Context<{ Bindings: AuthEnv; Variables: Vars }>;

async function userFrom(c: AuthContext): Promise<AuthUser | null> {
  const h = c.req.header('Authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const p = await verifyToken(token, signingSecret(c.env ?? {}));
  return p ? { id: p.id, name: p.name, roles: p.roles, provider: p.provider } : null;
}

export function requireRole(role?: Role): MiddlewareHandler<{ Bindings: AuthEnv; Variables: Vars }> {
  return async (c, next) => {
    const user = await userFrom(c);
    if (!user) return c.json({ error: 'not signed in' }, 401);
    if (role && !user.roles.includes(role)) return c.json({ error: 'forbidden' }, 403);
    c.set('user', user);
    await next();
  };
}

export const auth = new Hono<{ Bindings: AuthEnv; Variables: Vars }>();

auth.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<LoginRequest> | null;
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return c.json({ error: 'username and password are required' }, 400);
  }
  const env = c.env ?? {};
  const user = await passwordLogin(env, body.username, body.password);
  if (!user) return c.json({ error: 'wrong username or password' }, 401);
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const token = await signToken({ ...user, exp }, signingSecret(env));
  return c.json({ token, expiresAt: new Date(exp * 1000).toISOString(), user } satisfies LoginResponse, 200, { 'Cache-Control': 'no-store' });
});

auth.get('/me', requireRole(), (c) => c.json({ user: c.get('user'), defaultPassword: usingDefaultPassword(c.env ?? {}) }, 200, { 'Cache-Control': 'no-store' }));

// Tokens are stateless; the client forgets its token. Kept for a future server-side session store.
auth.post('/logout', (c) => c.json({ ok: true }));

// Reserved for Google sign-in: POST { idToken } → LoginResponse.
auth.post('/google', (c) => c.json({ error: 'Google sign-in is not set up yet' }, 501));

export const admin = new Hono<{ Bindings: AuthEnv; Variables: Vars }>();
admin.use('*', requireRole('admin'));
admin.get('/stats', (c) =>
  c.json(
    {
      contentVersion: CONTENT_VERSION,
      letters: bundle.letters.length,
      words: bundle.words.length,
      lessons: bundle.lessons.length,
      audioFiles: bundle.audio.length,
      needsReview: bundle.words.filter((w) => w.needsReview).map(({ id, cyrillic, persian }) => ({ id, cyrillic, persian })),
    } satisfies AdminStats,
    200,
    { 'Cache-Control': 'no-store' },
  ),
);
