#!/usr/bin/env node
// Generate waifu portraits: every waifu x every emotion, kept in style.
//
// Backends (set BACKEND=openai):
//   openai  -> gpt-image-1  (needs OPENAI_API_KEY)            [best consistency]
//
// IMPORTANT: Venice image generation is intentionally disabled. The Venice key
// is for chat/testing only; do not spend it on image generation again.
//
// Usage:
//   BACKEND=openai OPENAI_API_KEY=... node scripts/gen-images.mjs
//
// Only generates files that don't already exist (resumable). Pass --force to redo.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'waifu');

const BACKEND = (process.env.BACKEND || 'disabled').toLowerCase();
const FORCE = process.argv.includes('--force');
const onlyIds = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// --- mirror lib/waifus.ts (kept in sync manually) ---
const EMOTIONS = ['neutral','happy','excited','blush','sad','angry','jealous','surprised','pleading','smug','sexy','playful_kiss'];
const EMOTION_FACE = {
  neutral: 'calm neutral expression, relaxed',
  happy: 'warm happy smile, sparkling eyes',
  excited: 'thrilled excited expression, wide starry eyes, open mouth grin',
  blush: 'shy heavy blush, bashful look, hands near face',
  sad: 'teary puppy eyes, trembling pout, on the verge of crying',
  angry: 'pouty angry puffed cheeks, furrowed brows, comedic mad',
  jealous: 'sulking jealous side-eye, unimpressed pout',
  surprised: 'shocked surprised face, raised eyebrows, mouth agape',
  pleading: 'pleading begging puppy-dog eyes, hands clasped, kawaii',
  smug: 'mischievous smug smirk, half-lidded knowing eyes, devious',
  sexy: 'tasteful flirty expression, confident alluring smile, half-lidded eyes, romantic tension, SFW',
  playful_kiss: 'cute teasing blowing-a-kiss pose, wink, puckered lips, playful romantic energy, SFW',
};
const WAIFUS = [
  { id:'yumi', desc:'cute anime girl with long pink twin-tails, oversized pastel sweater, schoolgirl' },
  { id:'rei', desc:'cute anime girl with short ice-blue bob, lab coat over school uniform, calm mysterious' },
  { id:'akari', desc:'cute anime tomboy with messy orange ponytail, hoodie and fingerless gloves' },
  { id:'momo', desc:'cute anime gyaru girl, tanned skin, curly platinum-blonde hair, heart hairpins' },
  { id:'shizuku', desc:'cute anime gothic-lolita girl, long straight black hair, lace dress, parasol' },
  { id:'hina', desc:'cute sleepy anime girl, fluffy lavender hair, wrapped in a hoodie blanket' },
  { id:'kaede', desc:'cute anime student-council girl, neat green bob, round glasses, ribbon tie' },
  { id:'luna', desc:'cute anime pop-idol girl, pastel-blue long curls, sparkly idol stage outfit, microphone' },
  { id:'tsumugi', desc:'cute anime shrine maiden, long crimson hair, red-and-white miko outfit, paper charms' },
  { id:'nova', desc:'cute anime cyberpunk hacker girl, neon-magenta undercut hair, neon visor, choker' },
  { id:'sora', desc:'cute anime angel girl, pale gold wavy hair, tiny halo, small white feather wings' },
  { id:'mei', desc:'cute anime cat-ear maid girl, chocolate brown hair with cat ears, frilly maid apron' },
];

const STYLE = 'high quality anime illustration, clean cel-shading, vibrant colors, soft lighting, ' +
  'centered head-and-shoulders portrait, simple soft gradient background, consistent character design, ' +
  'visual-novel sprite style, single character';

function prompt(w, emotion) {
  return `${w.desc}. ${EMOTION_FACE[emotion]}. ${STYLE}.`;
}

// hash an id to a stable seed
function seedFor(id) {
  let h = 2166136261;
  for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 2_000_000_000;
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function genVenice(p, seed) {
  throw new Error('Venice image generation is disabled for this project. Use Codex image_gen or a non-Venice backend.');
  // Venice proxies OpenAI's gpt-image models, so this uses OpenAI image-gen
  // via the Venice key. gpt-image ignores SD-only params, so keep it minimal.
  const key = process.env.VENICE_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.VENICE_IMAGE_MODEL || 'gpt-image-1-5';
  const isGpt = model.startsWith('gpt-image');
  const body = isGpt
    ? { model, prompt: p, width: 1024, height: 1024 }
    : { model, prompt: p, width: 1024, height: 1024, steps: 25, cfg_scale: 5,
        style_preset: 'Anime', seed, safe_mode: false, hide_watermark: true };
  const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`venice ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.images?.[0] || data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('venice: no image in response');
  return Buffer.from(b64, 'base64');
}

async function genOpenAI(p) {
  const key = process.env.OPENAI_API_KEY;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: p,
      size: '1024x1024',
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai: no image in response');
  return Buffer.from(b64, 'base64');
}

async function main() {
  if (BACKEND === 'venice' || BACKEND === 'disabled') {
    throw new Error('Remote Venice image generation is disabled for this project. Use Codex image_gen for new portraits; keep the Venice key for chat only.');
  }
  if (BACKEND !== 'openai') {
    throw new Error(`Unsupported image backend "${BACKEND}". Venice is disabled; only BACKEND=openai is supported by this legacy script.`);
  }

  const list = onlyIds.length ? WAIFUS.filter((w) => onlyIds.includes(w.id)) : WAIFUS;
  let done = 0, skipped = 0, failed = 0;
  const total = list.length * EMOTIONS.length;
  console.log(`backend=${BACKEND}  waifus=${list.length}  emotions=${EMOTIONS.length}  total=${total}`);

  for (const w of list) {
    await mkdir(join(OUT, w.id), { recursive: true });
    for (const emo of EMOTIONS) {
      const out = join(OUT, w.id, `${emo}.png`);
      if (!FORCE && (await exists(out))) { skipped++; continue; }
      const p = prompt(w, emo);
      try {
        const buf = BACKEND === 'openai' ? await genOpenAI(p) : await genVenice(p, seedFor(w.id));
        await writeFile(out, buf);
        done++;
        console.log(`✓ ${w.id}/${emo}  (${done + skipped}/${total})`);
      } catch (e) {
        failed++;
        console.error(`✗ ${w.id}/${emo}: ${e.message}`);
      }
    }
  }
  console.log(`\nDONE  generated=${done}  skipped=${skipped}  failed=${failed}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
