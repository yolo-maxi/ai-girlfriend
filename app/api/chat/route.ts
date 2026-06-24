import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/personality';
import { getWaifu, isEmotion, Emotion } from '@/lib/waifus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OpenAI-compatible backend. Defaults to Venice but works with any
// OpenAI-compatible endpoint via env.
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.venice.ai/api/v1';
const API_KEY = process.env.OPENAI_API_KEY || process.env.VENICE_API_KEY || '';
const MODEL = process.env.CHAT_MODEL || 'venice-uncensored-role-play';

type Msg = { role: 'user' | 'assistant'; content: string };

type Reply = { say: string; emotion: Emotion; secretMeter: number };

const EMO_FALLBACK: Emotion = 'happy';

function clamp(n: unknown): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

// The model sometimes narrates the schema fields INTO its own message, e.g.
// "...boba! (secretMeter: 0)" or "emotion: happy". Strip those echoes so the
// user only ever sees clean dialogue.
function sanitizeSay(s: string): string {
  return s
    .replace(/[([{]?\s*"?secret\s*meter"?\s*[:=]\s*\d+\s*[)\]}]?/gi, '')
    .replace(/[([{]?\s*"?emotion"?\s*[:=]\s*"?[a-z]+"?\s*[)\]}]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalize(o: any): Reply {
  const emotion: Emotion = isEmotion(o?.emotion) ? o.emotion : EMO_FALLBACK;
  const sayRaw = typeof o?.say === 'string' ? o.say.trim() : '';
  const say = sanitizeSay(sayRaw) || '...';
  return { say, emotion, secretMeter: clamp(o?.secretMeter) };
}

// Last-resort scrub: strip any JSON scaffolding / schema field tags so the raw
// structure (especially "emotion"/"secretMeter") can NEVER leak into the bubble.
function stripArtifacts(s: string): string {
  return s
    .replace(/"?\bsay\b"?\s*:/gi, '')
    .replace(/[,{]\s*"?emotion"?\s*:\s*"?[a-z]*"?/gi, '')
    .replace(/[,{]\s*"?secretMeter"?\s*:\s*\d*/gi, '')
    .replace(/[{}]/g, '')
    .replace(/^[\s",]+|[\s",]+$/g, '')
    .trim();
}

// Tolerant parser. The role-play model often emits emoji/kaomoji, inner quotes,
// or stray prose that breaks strict JSON — so we degrade gracefully and, above
// all, never surface the schema tags to the user.
function safeParse(raw: string): Reply {
  const txt = (raw || '').trim();
  if (!txt) return { say: 'ehe~ say that again? 🥺', emotion: 'surprised', secretMeter: 0 };

  // Prefer the outermost {...} block; fall back to the whole string.
  const s = txt.indexOf('{');
  const e = txt.lastIndexOf('}');
  const block = s !== -1 && e > s ? txt.slice(s, e + 1) : txt;

  // 1) Strict parse, then a light repair pass (smart quotes, trailing commas).
  const repaired = block
    .replace(/[“”]/g, '"')
    .replace(/,\s*([}\]])/g, '$1');
  for (const cand of [block, repaired]) {
    try {
      const o = JSON.parse(cand);
      if (o && typeof o === 'object') return normalize(o);
    } catch {
      /* fall through */
    }
  }

  // 2) Field-level extraction — survives broken JSON when the fields exist.
  const emoM = block.match(/"emotion"\s*:\s*"([a-zA-Z]+)"/);
  const meterM = block.match(/"secretMeter"\s*:\s*(\d+)/);
  const sayM = block.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const emotion: Emotion = isEmotion(emoM?.[1] || '') ? (emoM![1] as Emotion) : EMO_FALLBACK;
  const secretMeter = meterM ? clamp(meterM[1]) : 0;
  if (sayM) {
    const say = sanitizeSay(
      sayM[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\').trim(),
    );
    if (say) return { say, emotion, secretMeter };
  }

  // 3) Nothing parseable — show scrubbed prose, never the raw tags.
  const cleaned = stripArtifacts(txt).slice(0, 400);
  return { say: cleaned || 'ehe~ my brain glitched, say that again? 🥺', emotion, secretMeter };
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'No API key configured on the server.' },
      { status: 500 },
    );
  }

  let body: { waifuId?: string; messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const waifu = getWaifu(body.waifuId);
  const history = (body.messages || []).slice(-16); // keep it light

  const payload = {
    model: MODEL,
    temperature: 0.8,
    top_p: 0.9,
    frequency_penalty: 0.3,
    max_tokens: 300,
    messages: [
      { role: 'system', content: buildSystemPrompt(waifu) },
      ...history,
    ],
    // Many OpenAI-compatible servers honor this; harmless if ignored.
    response_format: { type: 'json_object' as const },
  };

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json(
        { error: `upstream ${res.status}`, detail: t.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json(safeParse(raw));
  } catch (e: any) {
    return NextResponse.json(
      { error: 'fetch failed', detail: String(e?.message || e) },
      { status: 502 },
    );
  }
}
