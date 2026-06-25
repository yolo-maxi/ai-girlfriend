# AI Girlfriend

attestWaifu, the first ai girlfriend that won't cheat on you by sharing your data.

Live: https://waifu.repo.box (password gated)

## Current App

- Tinder-style waifu picker with pass/pick controls.
- 9 waifus with 12 static emotion portraits each.
- Chat powered by an OpenAI-compatible endpoint.
- Emotion-driven stage art: `neutral`, `happy`, `excited`, `blush`, `sad`, `angry`, `jealous`, `surprised`, `pleading`, `smug`, `sexy`, `playful_kiss`.
- Rizz meter tiers: `Guard up`, `Curious`, `Flustered`, `Won over`.
- 100% reward uses `sexy` on stage and `playful_kiss` in the unlock modal.
- Password auth in `middleware.ts`, `/login`, and `/api/login`.

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Variables:

```bash
OPENAI_COMPATIBLE_KEY=
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
AUTH_PASSWORD=
AUTH_SESSION_SECRET=
```

`OPENAI_COMPATIBLE_KEY` is the server-side chat API key. `AUTH_PASSWORD` is the shared login password. `AUTH_SESSION_SECRET` is an opaque random cookie secret; generate a long random value and do not commit it.

## Run Locally

```bash
pnpm install
pnpm build
pnpm start
```

The app serves on port `3016`.

## Images

Portraits live in:

```text
public/waifu/<waifu-id>/<emotion>.png
public/waifu/<waifu-id>/<emotion>.webp
```

The app serves WebP first with PNG fallback. For new portraits, use Codex `image_gen`, save the PNGs into `public/waifu/<id>/`, generate matching WebP files, then restart the app because `next start` caches `public/`.

## Deployment

PM2 process:

```bash
pm2 restart ai-girlfriend --update-env
```

Public route:

```text
waifu.repo.box -> Hetzner port 3016
```

Before sharing, verify:

```bash
curl -s -o /dev/null -w '%{http_code}' https://waifu.repo.box/
```

Expected unauthenticated response: `307` redirect to `/login`. API routes return `401` without a session cookie.

## Project Layout

- `app/page.tsx` — picker, chat UI, rizz meter, reward modal.
- `app/api/chat/route.ts` — chat proxy, JSON parsing, fallback handling.
- `lib/waifus.ts` — roster and emotion list.
- `lib/personality.ts` — waifu prompt and idle nudges.
- `public/waifu/` — static portrait assets.
