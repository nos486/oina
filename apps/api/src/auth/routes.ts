import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type {
  AdminStats, AuthUser, ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse, ProgressResponse, RegisterRequest, Role,
} from '@oina/shared';
import { MIN_PASSWORD_LENGTH, USERNAME_RE } from '@oina/shared';
import { mergeProgress, normalizeProgress } from '@oina/engine';
import { bundle, CONTENT_VERSION } from '../content.js';
import { Repo, toAuthUser, type UserRow } from '../db/repo.js';
import { ensureMigrated } from '../db/migrate.js';
import { type AuthEnv, passwordLogin } from './providers.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken, verifyToken } from './token.js';

export const SESSION_DAYS = 30;
/** Largest progress JSON we accept (a heavy user is well under 200 KB). */
const MAX_PROGRESS_BYTES = 1_000_000;

type Vars = { user: AuthUser; repo: Repo };
type Env = { Bindings: AuthEnv; Variables: Vars };
type Ctx = Context<Env>;

const noStore = { 'Cache-Control': 'no-store' };

/** Every auth/progress route needs D1. Without the binding the content API still works. */
const withDb: MiddlewareHandler<Env> = async (c, next) => {
  if (!c.env?.DB) return c.json({ error: 'database not configured (D1 binding "DB" is missing)' }, 503);
  await ensureMigrated(c.env.DB);
  c.set('repo', new Repo(c.env.DB));
  await next();
};

async function secret(c: Ctx): Promise<string> {
  return c.env?.AUTH_SECRET || c.get('repo').authSecret();
}

async function issue(c: Ctx, row: UserRow): Promise<Response> {
  const user = toAuthUser(row);
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const token = await signToken({ ...user, exp }, await secret(c));
  return c.json({ token, expiresAt: new Date(exp * 1000).toISOString(), user } satisfies LoginResponse, 200, noStore);
}

export function requireRole(role?: Role): MiddlewareHandler<Env> {
  return async (c, next) => {
    const h = c.req.header('Authorization') ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    const p = token ? await verifyToken(token, await secret(c)) : null;
    if (!p) return c.json({ error: 'not signed in' }, 401);
    if (role && !p.roles.includes(role)) return c.json({ error: 'forbidden' }, 403);
    c.set('user', { id: p.id, name: p.name, roles: p.roles, provider: p.provider });
    await next();
  };
}

async function body<T>(c: Ctx): Promise<Partial<T> | null> {
  return (await c.req.json().catch(() => null)) as Partial<T> | null;
}

// ---------- /auth ----------

export const auth = new Hono<Env>();
auth.use('*', withDb);

auth.post('/login', async (c) => {
  const b = await body<LoginRequest>(c);
  if (typeof b?.username !== 'string' || typeof b.password !== 'string') return c.json({ error: 'username and password are required' }, 400);
  const row = await passwordLogin(c.get('repo'), b.username, b.password);
  if (!row) return c.json({ error: 'wrong username or password' }, 401);
  return issue(c, row);
});

auth.post('/register', async (c) => {
  const b = await body<RegisterRequest>(c);
  const username = typeof b?.username === 'string' ? b.username.trim().toLowerCase() : '';
  const password = typeof b?.password === 'string' ? b.password : '';
  if (!USERNAME_RE.test(username)) return c.json({ error: 'username: 3–32 characters, a–z 0–9 _ . -' }, 400);
  if (password.length < MIN_PASSWORD_LENGTH) return c.json({ error: `password: at least ${MIN_PASSWORD_LENGTH} characters` }, 400);
  const repo = c.get('repo');
  if (await repo.userByUsername(username)) return c.json({ error: 'username is taken' }, 409);
  const name = typeof b?.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 60) : username;
  const row = await repo.createUser({ username, name, passwordHash: await hashPassword(password) });
  return issue(c, row);
});

auth.get('/me', requireRole(), async (c) => {
  const row = await c.get('repo').userById(c.get('user').id);
  if (!row) return c.json({ error: 'not signed in' }, 401);
  return c.json({ user: toAuthUser(row, c.get('user').provider), defaultPassword: row.default_password === 1 } satisfies MeResponse, 200, noStore);
});

auth.post('/password', requireRole(), async (c) => {
  const b = await body<ChangePasswordRequest>(c);
  if (typeof b?.currentPassword !== 'string' || typeof b.newPassword !== 'string') return c.json({ error: 'currentPassword and newPassword are required' }, 400);
  if (b.newPassword.length < MIN_PASSWORD_LENGTH) return c.json({ error: `password: at least ${MIN_PASSWORD_LENGTH} characters` }, 400);
  const repo = c.get('repo');
  const row = await repo.userById(c.get('user').id);
  if (!row || !(await verifyPassword(b.currentPassword, row.password_hash))) return c.json({ error: 'current password is wrong' }, 403);
  await repo.setPassword(row.id, await hashPassword(b.newPassword));
  return c.json({ ok: true }, 200, noStore);
});

// Tokens are stateless; the client forgets its token.
auth.post('/logout', (c) => c.json({ ok: true }));

// Reserved for Google sign-in: POST { idToken } → LoginResponse.
auth.post('/google', (c) => c.json({ error: 'Google sign-in is not set up yet' }, 501));

// ---------- /progress ----------

export const progress = new Hono<Env>();
progress.use('*', withDb, requireRole());

progress.get('/', async (c) => {
  const saved = await c.get('repo').getProgress(c.get('user').id);
  return c.json({ progress: saved?.data ?? null, updatedAt: saved?.updatedAt ?? null } satisfies ProgressResponse, 200, noStore);
});

/** Saves the client's progress merged with what is stored ("most progress wins"), returns the result. */
progress.put('/', async (c) => {
  const raw = await c.req.text();
  if (raw.length > MAX_PROGRESS_BYTES) return c.json({ error: 'progress too large' }, 413);
  let incoming: unknown;
  try {
    incoming = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid JSON' }, 400);
  }
  if ((incoming as { version?: unknown })?.version !== 1) return c.json({ error: 'unsupported progress version' }, 400);
  const repo = c.get('repo');
  const userId = c.get('user').id;
  const saved = await repo.getProgress(userId);
  const client = normalizeProgress(incoming);
  // Client first: on a tie it wins the single-value fields (settings, daily goal), lists and maxima are unioned.
  const merged = saved ? mergeProgress(client, normalizeProgress(saved.data)) : client;
  const updatedAt = await repo.putProgress(userId, merged);
  return c.json({ progress: merged, updatedAt } satisfies ProgressResponse, 200, noStore);
});

// ---------- /admin ----------

export const admin = new Hono<Env>();
// Without D1 nobody can sign in, so admin routes are closed.
admin.use('*', withDb, requireRole('admin'));

admin.get('/stats', async (c) => {
  const repo = c.get('repo');
  const [users, recent] = await Promise.all([repo.countUsers(), repo.recentUsers(50)]);
  return c.json(
    {
      contentVersion: CONTENT_VERSION,
      letters: bundle.letters.length,
      words: bundle.words.length,
      lessons: bundle.lessons.length,
      audioFiles: bundle.audio.length,
      needsReview: bundle.words.filter((w) => w.needsReview).map(({ id, cyrillic, persian }) => ({ id, cyrillic, persian })),
      users,
      recentUsers: recent.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        roles: JSON.parse(u.roles) as Role[],
        createdAt: u.created_at,
        xp: u.xp ?? 0,
        lessons: u.lessons ?? 0,
        lastProgressAt: u.progress_at,
      })),
    } satisfies AdminStats,
    200,
    noStore,
  );
});
