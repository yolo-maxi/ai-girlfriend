# AI Girlfriend 💕 (she keeps NO secrets)

A silly, funny anime-waifu chat app. The girlfriend insists "you can trust me, I can keep a secret~" while shamelessly prying for your darkest secrets — and nudges you unprompted when you go quiet.

Live: https://waifu.repo.box (magic-link gated)

## Stack
- NextJS 14 (app router) + TypeScript, one process serves UI + API.
- **Chat brain:** any OpenAI-compatible endpoint. Defaults to Venice `venice-uncensored-role-play`. Key is server-side only.
- **Images:** `gpt-image-1-5` (OpenAI's image model, proxied via Venice). 12 waifus × 10 emotions.
- **Auth:** magic-link token gate in `middleware.ts`.

## Env (`.env.local`)
```
VENICE_API_KEY=...            # or OPENAI_API_KEY
OPENAI_BASE_URL=https://api.venice.ai/api/v1
CHAT_MODEL=venice-uncensored-role-play
ACCESS_TOKEN=...              # magic-link token; unset = open (dev only)
```

## Run
```
pnpm install
pnpm build
pnpm start            # port 3016
```

## Generate waifu images
```
# Resumable: only makes files that don't exist yet. --force to redo.
BACKEND=venice VENICE_IMAGE_MODEL=gpt-image-1-5 VENICE_API_KEY=... node scripts/gen-images.mjs [waifuId...]
# or real OpenAI:
BACKEND=openai OPENAI_API_KEY=... node scripts/gen-images.mjs
```
**After generating, restart the server** (`next start` caches `public/` at boot).

## Layout
- `lib/waifus.ts` — 12-waifu roster + 10 emotions
- `lib/personality.ts` — system prompt (the secret-prying bit) + unprompted nudges
- `app/api/chat/route.ts` — OpenAI-compatible chat proxy, forces JSON `{say, emotion, secretMeter}`
- `app/page.tsx` — chat UI, emotion swapping, secret meter, idle nudge timer
- `scripts/gen-images.mjs` — image generator (Venice/OpenAI backends)
