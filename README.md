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

Tajik audio comes from files (browsers have no Tajik voice); Russian uses the browser voice (Web Speech, ru-RU).
A sound button is greyed out until its file is listed in `content/audio-manifest.json`.

All 245 Tajik files (35 letter names, 35 letter sounds, 175 words) are placeholders generated with
Meta's MMS model `facebook/mms-tts-tgk` (CC-BY-NC-4.0, allowed because Oina is free). Replace any
of them with a real recording at the same path.

1. Generate missing files (or `--force` to redo all). Needs Python 3.10+ and ffmpeg:
   ```sh
   python -m venv .venv && . .venv/bin/activate && pip install torch transformers numpy
   python scripts/tts/generate_tg_audio.py
   ```
   Or put recordings in `apps/web/public/audio/` using the names in `public/audio/README.md`
   (e.g. `tg/words/kafsh.mp3`, `tg/letters/sha-sound.mp3`). Format: mp3, mono, 64 kbps, about 0.15 s of silence before and 0.2 s after.
2. Run `pnpm audio:list`. It updates `content/audio-manifest.json` and writes `audio-missing.txt`.
3. Commit and redeploy both the API (it serves the manifest) and the web app (it serves the files at `/audio/`).

Later the files can move to R2: uncomment the `[[r2_buckets]]` block in `apps/api/wrangler.toml`,
upload with the same paths, and set `VITE_AUDIO_BASE` to `https://<worker>/audio/`.

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

`public/_redirects` makes client-side routes work; `public/_headers` sets long caching for hashed assets and audio.

## What's in the MVP

- Stages 1–6 (all 35 Tajik letters), 23 lessons, 175 words, mini readings.
- Six exercise types: letter → sound, sound → letter, read the word, build the word, match pairs, spot the trap.
- Lesson flow: letter intro cards, ~10 questions easy → hard, results with weak letters and "words you can read now".
- Three levels per lesson (stars), stage tests (80% passes and can skip a stage).
- Smart review: wrong answers come back at the end of the lesson in another form; item strength with decay;
  Leitner boxes (1, 2, 4, 7, 14 days); confusion pairs feed the wrong options; 30% review in new lessons;
  daily review by priority; "my mistakes" practice.
- XP, combo, daily goal, streak, hearts (can be turned off), levels from XP, stars, badges (no currency: the app is free).
- Alphabet hall, settings, progress export/import as JSON.

Next (v1.1): stages 7–8, exercises 7–10, reading room, Cyrillic → Persian converter, offline service worker.
Then (v2): reading Russian signs, Google sign-in, shareable certificate.
