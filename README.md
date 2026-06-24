# AI Girlfriend

A playful anime-waifu rizz game built with Next.js. Pick a waifu, flirt past her defenses, raise the rizz meter, and unlock a kiss-scene reward at 100%.

Live: https://waifu.repo.box (magic-link gated)

## Current App

- Tinder-style waifu picker with pass/pick controls.
- 9 waifus with 12 static emotion portraits each.
- Chat powered by an OpenAI-compatible endpoint, currently Venice `venice-uncensored-role-play`.
- Emotion-driven stage art: `neutral`, `happy`, `excited`, `blush`, `sad`, `angry`, `jealous`, `surprised`, `pleading`, `smug`, `sexy`, `playful_kiss`.
- Rizz meter tiers: `Guard up`, `Curious`, `Flustered`, `Won over`.
- 100% reward uses `sexy` on stage and `playful_kiss` in the unlock modal.
- Magic-link auth in `middleware.ts`.

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Variables:

```bash
VENICE_API_KEY=
OPENAI_BASE_URL=https://api.venice.ai/api/v1
CHAT_MODEL=venice-uncensored-role-play
ACCESS_TOKEN=
```

`ACCESS_TOKEN` enables the magic-link gate. Visit `/?token=<ACCESS_TOKEN>` once to set the auth cookie.

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
```

Do **not** use the Venice key for image generation. `scripts/gen-images.mjs` refuses default and `BACKEND=venice` runs before any image request.

For new portraits, use Codex `image_gen`, save the PNGs into `public/waifu/<id>/`, optimize them to normal web size, then restart the app because `next start` caches `public/`.

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

Expected unauthenticated response: `401`.

## Project Layout

- `app/page.tsx` — picker, chat UI, rizz meter, reward modal.
- `app/api/chat/route.ts` — chat proxy, JSON parsing, fallback handling.
- `lib/waifus.ts` — roster and emotion list.
- `lib/personality.ts` — waifu prompt and idle nudges.
- `public/waifu/` — static portrait assets.
- `scripts/gen-images.mjs` — legacy image script; Venice image spend is blocked.
