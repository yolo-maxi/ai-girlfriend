import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/personality';
import { getWaifu, isEmotion, Emotion } from '@/lib/waifus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OpenAI-compatible backend. Configure the provider with env, without baking a
// vendor into the app.
const BASE_URL = process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const API_KEY = process.env.OPENAI_COMPATIBLE_KEY || process.env['openai-compatible-key'] || process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_COMPATIBLE_MODEL || process.env.CHAT_MODEL || 'gpt-4o-mini';

type Msg = { role: 'user' | 'assistant'; content: string };

type Reply = { say: string; emotion: Emotion; secretMeter: number };

const EMO_FALLBACK: Emotion = 'happy';
const BOILERPLATE_PATTERNS = [
  /\bwhy do you think\b/i,
  /\bwhat exactly makes you think\b/i,
  /\bwhat makes you think\b/i,
  /\bwhat exactly.*made you think\b/i,
  /\bmade you think\b/i,
  /\btry again\b/i,
  /\bdo better\b/i,
  /\bwork (a bit )?harder\b/i,
  /\bwork for (it|that|this)\b/i,
  /\bworking for (it|that|this)\b/i,
  /\btry harder\b/i,
  /\bprove yourself\b/i,
  /\bimpress me (first|more)?\b/i,
  /\breally impress me\b/i,
  /\bearn (it|that|this|me)\b/i,
  /\bnot that easy\b/i,
  /\bsecret weapon\b/i,
  /\bwhat'?s your move\b/i,
  /\bbest move\b/i,
  /\bnext move\b/i,
  /\bbring your a-game\b/i,
  /\bmister charming\b/i,
  /\bmister\b/i,
  /\bhotshot\b/i,
  /\bnot gonna happen\b/i,
  /\bpoints for confidence\b/i,
  /\bnot fully convinced\b/i,
  /\bwin me over\b/i,
  /\bsteal my heart\b/i,
  /\bdon't let it go to your head\b/i,
];

function clamp(n: unknown): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

function rizzFloor(text: string): number {
  const t = text.toLowerCase();
  const asksNoFlirt = /\b(don't|dont|do not|stop|without|no)\b.{0,48}\b(flirt|rizz|romance|hit on)/.test(t);
  if (asksNoFlirt) return 0;

  const directFlirt = /\b(flirt|rizz|date|kiss|crush|cute|beautiful|gorgeous|pretty|adorable|hot|sweetheart|babe)\b/.test(t);
  const attentive = /\b(i noticed|i like how|i love how|you seem|your vibe|tell me about you|what makes you|i want to know you)\b/.test(t);
  const romantic = /\b(i like you|i'd take you|i would take you|let me take you|with you|make you blush|win you over|fall for me)\b/.test(t);
  const genericPickup = /\b(angel|heaven|parking ticket|tennessee|did it hurt|come here often)\b/.test(t);

  if (romantic && attentive) return 88;
  if (romantic) return 76;
  if (attentive && directFlirt) return 68;
  if (directFlirt && !genericPickup) return 48;
  if (genericPickup) return 18;
  if (attentive) return 36;
  if (/\b(lol|haha|lmao|tease|smooth|charming)\b/.test(t)) return 20;
  return 0;
}

// The model sometimes narrates the schema fields INTO its own message, e.g.
// "...boba! (secretMeter: 0)" or "emotion: happy". Strip those echoes so the
// user only ever sees clean dialogue.
function sanitizeSay(s: string): string {
  return s
    .replace(/[([{]?\s*"?secret\s*meter"?\s*[:=]\s*\d+\s*[)\]}]?/gi, '')
    .replace(/[([{]?\s*"?emotion"?\s*[:=]\s*"?[a-z]+"?\s*[)\]}]?/gi, '')
    .replace(/\b(?:openai|chatgpt|gpt|language model|ai model|backend model)\b[^.!?]*[.!?]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function looksTruncated(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/[\\"]$/.test(t)) return true;
  if (/\b(about|and|because|for|from|into|like|my|of|that|the|to|with|your)$/.test(t.toLowerCase())) {
    return true;
  }
  return false;
}

function buildContinuityPrompt(lastUser: string, recentUserContext: string): string {
  const latest = lastUser.slice(0, 500);
  const recent = recentUserContext.slice(0, 900);
  return `Conversation continuity check:
- The latest user message is: ${JSON.stringify(latest)}
- Recent user context is: ${JSON.stringify(recent)}
- Reply to that message directly and stay on its topic.
- Do not introduce a new game, secret request, personal story, or random scenario unless it naturally follows from that exact message.
- Ask at most one follow-up question. If you ask one, it MUST reuse a concrete detail from the latest user message or recent user context.
- Forbidden: asking about coworkers, gossip, secrets, games, crushes, exes, drama, your own day, or a new scenario unless the user just mentioned that exact subject.
- If the user asks for advice or a verdict, answer first and do not add a follow-up unless it is necessary.
- Avoid boilerplate challenge phrases like "why do you think I'd be interested", "what makes you think", "made you think", "try again smoother", "do better", "you'll have to work harder", "work for it", "working for it", "try harder", "prove yourself", "impress me first", "earn it", "not that easy", "secret weapon", "what's your move", "best move", "next move", "bring your A-game", "mister", "hotshot", "not gonna happen", "points for confidence", "not fully convinced", "win me over", "steal my heart", "don't let it go to your head", or close variants.
- Keep the output JSON schema exactly as requested.`;
}

function wordSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function phrases(s: string): Set<string> {
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - 4; i += 1) {
    out.add(words.slice(i, i + 4).join(' '));
  }
  return out;
}

function tooSimilar(a: string, b: string): boolean {
  const ap = phrases(a);
  const bp = phrases(b);
  for (const phrase of ap) if (bp.has(phrase)) return true;

  const aw = wordSet(a);
  const bw = wordSet(b);
  if (aw.size < 4 || bw.size < 4) return false;
  let overlap = 0;
  for (const w of aw) if (bw.has(w)) overlap += 1;
  const score = overlap / Math.min(aw.size, bw.size);
  return score > 0.58;
}

function hasBoilerplate(s: string): boolean {
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(s));
}

function leaksModelIdentity(s: string): boolean {
  return /\b(?:openai|chatgpt|gpt|language model|ai model|backend model)\b/i.test(s);
}

function coerceEmotion(x: unknown): Emotion {
  const raw = typeof x === 'string' ? x.trim().toLowerCase() : '';
  const mapped = raw === 'kiss' ? 'playful_kiss' : raw;
  return isEmotion(mapped) ? (mapped as Emotion) : EMO_FALLBACK;
}

function freshFallback(meter: number): Reply {
  const score = clamp(meter);
  if (score >= 70) {
    return {
      say: "okay, that one landed. I'm trying to play it cool, but you're making that annoyingly difficult >//<",
      emotion: 'blush',
      secretMeter: score,
    };
  }
  if (score >= 40) {
    return {
      say: "hm. smoother than expected. I'm not saying it worked, but I'm also not changing the subject.",
      emotion: 'smug',
      secretMeter: score,
    };
  }
  return {
    say: "cute attempt. I noticed it, which is already more credit than I planned to give you.",
    emotion: 'happy',
    secretMeter: score,
  };
}

function offlineFallback(lastUser: string): Reply {
  const score = rizzFloor(lastUser);
  const t = lastUser.trim().toLowerCase();
  if (score >= 40) return freshFallback(score);
  if (/^(what|huh|wait what|what\?)$/.test(t)) {
    return {
      say: "my signal did a tiny faceplant, but I'm still here. give me that again and I'll pretend I was graceful.",
      emotion: 'surprised',
      secretMeter: score,
    };
  }
  return {
    say: "my connection hiccuped for a second, but I'm not letting you escape that easily. say it again?",
    emotion: 'pleading',
    secretMeter: score,
  };
}

function normalize(o: any): Reply {
  const emotion = coerceEmotion(o?.emotion);
  const sayRaw = typeof o?.say === 'string' ? o.say.trim() : '';
  const say = sanitizeSay(sayRaw) || '...';
  if (looksTruncated(say)) {
    return {
      say: 'wait no I got too dramatic and lost my sentence >//< say that again?',
      emotion: 'surprised',
      secretMeter: clamp(o?.secretMeter),
    };
  }
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
  const emotion = coerceEmotion(emoM?.[1] || '');
  const secretMeter = meterM ? clamp(meterM[1]) : 0;
  if (sayM) {
    const say = sanitizeSay(
      sayM[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\').trim(),
    );
    if (say && !looksTruncated(say)) return { say, emotion, secretMeter };
  }

  // 3) Nothing parseable — show scrubbed prose, never the raw tags.
  const cleaned = stripArtifacts(txt).slice(0, 400);
  if (looksTruncated(cleaned)) {
    return { say: 'ehe~ my brain skipped a beat. say that again? 🥺', emotion, secretMeter };
  }
  return { say: cleaned || 'ehe~ my brain glitched, say that again? 🥺', emotion, secretMeter };
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'No API key configured on the server.' },
      { status: 500 },
    );
  }

  let body: { waifuId?: string; messages?: Msg[]; history?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const waifu = getWaifu(body.waifuId);
  const history = (body.messages || body.history || []).slice(-16); // keep it light
  const lastUser = [...history].reverse().find((msg) => msg.role === 'user')?.content || '';
  const lastAssistant = [...history].reverse().find((msg) => msg.role === 'assistant')?.content || '';
  const recentUserContext = history
    .filter((msg) => msg.role === 'user')
    .slice(-3)
    .map((msg) => msg.content)
    .join(' / ');

  const baseMessages = [
      { role: 'system', content: buildSystemPrompt(waifu) },
      ...history,
      { role: 'system', content: buildContinuityPrompt(lastUser, recentUserContext) },
  ];

  async function complete(messages: typeof baseMessages) {
    const payload = {
      model: MODEL,
      temperature: 0.6,
      top_p: 0.78,
      frequency_penalty: 0.75,
      presence_penalty: 0.35,
      max_tokens: 260,
      messages,
      // Many OpenAI-compatible servers honor this; harmless if ignored.
      response_format: { type: 'json_object' as const },
    };

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
      throw new Error(`upstream ${res.status}: ${t.slice(0, 300)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  try {
    let parsed = safeParse(await complete(baseMessages));
    if ((lastAssistant && tooSimilar(parsed.say, lastAssistant)) || hasBoilerplate(parsed.say) || leaksModelIdentity(parsed.say)) {
      const repairMessages = [
        ...baseMessages,
        {
          role: 'system',
          content: `Your draft was too repetitive or used banned boilerplate.
Previous assistant message: ${JSON.stringify(lastAssistant.slice(0, 500))}.
Banned patterns include: why do you think, what makes you think, made you think, try again, do better, work harder, work for it, working for it, try harder, prove yourself, impress me first, earn it, not that easy, secret weapon, what's your move, best move, next move, bring your A-game, mister, hotshot, not gonna happen, points for confidence, not fully convinced, win me over, steal my heart, don't let it go to your head.
Never mention OpenAI, ChatGPT, GPT, model names, backend/provider identity, or being an AI/model.
Write a fresh reply to the latest user message instead. Do not reuse the same joke, question, phrasing, or scenario.`,
        },
      ];
      const repaired = safeParse(await complete(repairMessages));
      if (!hasBoilerplate(repaired.say) && !leaksModelIdentity(repaired.say) && (!lastAssistant || !tooSimilar(repaired.say, lastAssistant))) {
        parsed = repaired;
      } else {
        parsed = freshFallback(Math.max(parsed.secretMeter, rizzFloor(lastUser)));
      }
    }
    return NextResponse.json({
      ...parsed,
      secretMeter: Math.max(parsed.secretMeter, rizzFloor(lastUser)),
    });
  } catch (e: any) {
    return NextResponse.json(offlineFallback(lastUser));
  }
}
