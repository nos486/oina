# آینه · Оина

Free, no-signup web app that teaches Persian speakers to read the Tajik Cyrillic script, Duolingo style.
It teaches reading the script only, not a new language (a later path covers reading Russian signs, still reading only).
«فارسی را با خطی دیگر بخوان»

Persian, right-to-left, mobile-first, dark mode. Progress lives in the browser (`localStorage`, key `progress:v1`).
An Android app can be built later from the same web app.

## Layout

```
apps/web         React + Vite + TypeScript + Tailwind → Cloudflare Pages
apps/api         Cloudflare Worker (Hono) → serves content, later audio (R2) and sync (D1)
packages/shared  Types shared by web, api and scripts (content model, Progress, API)
packages/engine  Pure learning logic, no React: exercises, sessions, smart review, XP/streak/hearts
content/         All learning content as JSON (letters, words, lessons, stages, readings, audio manifest)
scripts/         validate-content, sync-word-letters, generate-audio-list
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

## Audio

Tajik audio comes from recorded files only (browsers have no Tajik voice). Until a file exists, its sound button is greyed out.

1. Put files in `apps/web/public/audio/` using the names in `public/audio/README.md`
   (e.g. `tg/words/kafsh.mp3`, `tg/letters/sha-sound.mp3`).
2. Run `pnpm audio:list`. It updates `content/audio-manifest.json` and writes `audio-missing.txt`.
3. Commit and redeploy both the API and the web app.

Later the files can move to R2: uncomment the `[[r2_buckets]]` block in `apps/api/wrangler.toml`,
upload with the same paths, and set `VITE_AUDIO_BASE` to `https://<worker>/audio/`.

## Sign-in (test login)

Signing in is optional; the app works without an account. For now there is one admin account:

- Default: `admin` / `admin`, which the admin page warns about.
- Set real values before sharing the site (from `apps/api`):
  ```bash
  npx wrangler secret put ADMIN_PASSWORD
  npx wrangler secret put AUTH_SECRET     # any long random string; signs session tokens
  npx wrangler secret put ADMIN_USERNAME  # optional, default "admin"
  ```
  Changing `AUTH_SECRET` or the password signs everyone out.
- For `wrangler dev`, copy `apps/api/.dev.vars.example` to `.dev.vars`.

API: `POST /api/v1/auth/login` → `{ token, expiresAt, user }`; send `Authorization: Bearer <token>`;
`GET /api/v1/auth/me`; `GET /api/v1/admin/stats` (admin only). Tokens are stateless HMAC-signed (30 days),
so no database is needed yet. Google sign-in will be another provider in `apps/api/src/auth/providers.ts`
behind the reserved `POST /api/v1/auth/google`, issuing the same token.

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

`public/_redirects` makes client-side routes work; `public/_headers` sets long caching for hashed assets and audio.

## What's in the MVP

- Stages 1–6 (all 35 Tajik letters), 23 lessons, 175 words, mini readings.
- Six exercise types: letter → sound, sound → letter, read the word, build the word, match pairs, spot the trap.
- Lesson flow: letter intro cards, ~10 questions easy → hard, results with weak letters and "words you can read now".
- Three levels per lesson (stars), stage tests (80% passes and can skip a stage).
- Smart review: wrong answers come back at the end of the lesson in another form; item strength with decay;
  Leitner boxes (1, 2, 4, 7, 14 days); confusion pairs feed the wrong options; 30% review in new lessons;
  daily review by priority; "my mistakes" practice.
- XP, combo, daily goal, streak with freezes, hearts (can be turned off), gems, badges.
- Alphabet hall, settings, progress export/import as JSON.

Next (v1.1): stages 7–8, exercises 7–10, reading room, Cyrillic → Persian converter, offline service worker.
Then (v2): Russian track, accounts with D1 and sync (`PUT /api/v1/progress` is reserved), shareable certificate.
