# آینه · Оина

Free, no-signup web app that teaches Persian speakers to read the Tajik Cyrillic script, Duolingo style.
It teaches reading the script only, not a new language (a later path covers reading Russian signs, still reading only).
«فارسی را با خطی دیگر بخوان»

Persian, right-to-left, mobile-first, dark mode. Progress lives in the browser (`localStorage`, key `progress:v1`).
A lesson left halfway is kept on the device (`session:v1`, up to 3 days) and resumes from the same question.
The app is a PWA: `public/sw.js` (registered in production builds) caches the app shell and build files
so it opens offline and can be added to the home screen. Bump `VERSION` in `sw.js` to drop old caches.
An Android app can be built later from the same web app.

## Layout

```
apps/web         React + Vite + TypeScript + Tailwind → Cloudflare Pages
apps/api         Cloudflare Worker (Hono) → serves content and sync (D1)
packages/shared  Types shared by web, api and scripts (content model, Progress, API)
packages/engine  Pure learning logic, no React: exercises, sessions, smart review, XP/streak/hearts
content/         All learning content as JSON (letters, words, lessons, stages, readings)
scripts/         validate-content, sync-word-letters
```

The web app loads everything with one request, `GET /api/v1/content`, and keeps a copy for fast start and offline use.

## Develop

Needs Node 20+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # API on :8787 and web on :5173 (Vite proxies /api to the Worker)
pnpm test           # engine + API unit tests (Vitest)
pnpm test:e2e       # Playwright: a full first lesson on a 390px phone (API is mocked)
pnpm typecheck
pnpm content:validate --verbose
```

## Content

Adding a word or a lesson is a JSON edit, no code:

1. Add the word to `content/words.json` (`id` is ascii, `cyrillic`, `persian`, optional `distractors`, `meaningFa`, `needsReview`).
2. Add its id to a lesson's `words` in `content/lessons.json`.
3. `pnpm content:sync` fills in each word's `letters`.
4. `pnpm content:validate` fails if a lesson uses a letter that has not been taught yet, or if a word
   contains Latin lookalikes (e.g. Latin `o` instead of Cyrillic `о`).

`"exercises": []` on a lesson means questions are generated automatically from its letters and words.
Words marked `"needsReview": true` need a Tajik speaker to confirm the spelling before release.

## No sound

The app has no audio at all: no recordings, no sound buttons, no listening exercises and no effect tones
(only a short vibration on phones). Machine Tajik voices were too inaccurate and there is no Tajik speaker to
record, so sound stays out until a real solution exists. Letter exercises compare the Cyrillic letter with
its Persian letter instead.

## Review, checkpoints and the exam

- **Review checkpoints on the path**: after every second lesson of a stage (unless the stage test comes next)
  there is a 🔁 node. It asks 12 questions plus a match board: about 60% from all older lessons, the rest from
  the two lessons just before it, half weak items and half random. Stars at 60/80/95% first-try accuracy
  (`Progress.reviewStars`). When one is due, the path's top card offers it before the next lesson.
- **Review tab**: daily review, the general exam, letters / words / mixed practice, mistakes, practice by
  stage, a strength summary and the newest words.
- **General exam** (`/exam`): 20 questions spread round-robin over every finished stage, no retries, score with
  letter/word breakdown and the mistakes at the end. History in `Progress.exams` (last 20).
- Logic lives in `packages/engine/src/practice.ts`.

## Accounts and saved progress (D1)

Signing in is optional; without it progress stays in the browser only. With an account, progress
(lessons, stars, XP, streak, item strengths, review boxes, mistakes) is saved to Cloudflare D1:
merged in on sign-in and app start, and pushed ~1.5 s after every change. `localStorage` stays the
working copy, so the app keeps working offline. Merging is "most progress wins" (lessons and badges are
unioned, XP and stars take the max, each item keeps its most recent state).

- Default admin from the first migration: **admin / admin**. Change it in the app: Tools → Account → Change password.
- Anyone can create a normal account (Tools → Sign in → Create account).
- The session signing key is generated on first use and stored in D1 (`config` table); no secrets to set.
  (Optional override: `npx wrangler secret put AUTH_SECRET`.)

### Database migrations: automatic

The Worker migrates its own D1 database. Migrations live in `apps/api/src/db/migrations.ts`; on the
first request after a deploy, each Worker instance applies any that are pending (tracked in the
`_oina_migrations` table) and remembers it. So a plain `wrangler deploy` is all that is needed, including
the very first deploy on an empty database. To change the schema, append a migration with the next id,
keep its statements safe to run twice (`IF NOT EXISTS`, `INSERT OR IGNORE`), and deploy.

The D1 binding is `DB` in `apps/api/wrangler.toml` (database `oina`).

API: `POST /api/v1/auth/login` and `/auth/register` → `{ token, expiresAt, user }`; send `Authorization: Bearer <token>`.
`GET /auth/me`, `POST /auth/password`, `GET|PUT /progress`, `GET /admin/stats` (admin only).
Tables: `users`, `identities` (for Google later), `progress`, `config`. Google sign-in will verify a Google ID token
behind the reserved `POST /auth/google`, link it in `identities`, and issue the same token.

## Deploy (manual)

### API (Worker)

```bash
cd apps/api
npx wrangler login          # once
npx wrangler deploy         # or from the root: pnpm deploy:api
```

Set `ALLOWED_ORIGINS` in `apps/api/wrangler.toml` to your Pages domain(s), comma separated; `https://*.oina.pages.dev` covers preview deploys
(localhost is always allowed). Check it with `https://oina-api.<you>.workers.dev/api/v1/health`.

### Web (Pages)

In the Cloudflare dashboard: Workers & Pages → Create → Pages → connect the GitHub repo, then:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @oina/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | (leave empty) |
| Environment variable | `VITE_API_BASE` = `https://oina-api.geekio.org` (the `/api/v1` suffix is optional) |
| Environment variable | `NODE_VERSION` = `22` |

Or build locally and upload: `pnpm build:web && npx wrangler pages deploy apps/web/dist --project-name oina`.

`public/_redirects` makes client-side routes work; `public/_headers` sets long caching for hashed assets.

## What's in the MVP

- Stages 1–6 (all 35 Tajik letters), 23 lessons, 475 words, mini readings.
- Six exercise types: letter → Persian letter, Persian letter → Cyrillic, read the word, build the word, match pairs, spot the trap.
- Lesson flow: letter intro cards, ~10 questions easy → hard, results with weak letters and "words you can read now".
- Three levels per lesson (stars), stage tests (80% passes and can skip a stage).
- Smart review: wrong answers come back at the end of the lesson in another form; item strength with decay;
  Leitner boxes (1, 2, 4, 7, 14 days); confusion pairs feed the wrong options; 30% review in new lessons;
  daily review by priority; "my mistakes" practice.
- XP, combo, daily goal, streak, hearts (can be turned off), levels from XP, stars, badges (no currency: the app is free).
- Alphabet hall, settings, progress export/import as JSON.

Next (v1.1): stages 7–8, exercises 7–10, reading room, Cyrillic → Persian converter, offline service worker.
Then (v2): reading Russian signs, Google sign-in, shareable certificate.
