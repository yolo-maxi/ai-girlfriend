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

function safeParse(raw: string): Reply {
  let txt = (raw || '').trim();
  // Strip code fences / stray prose around the JSON.
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start !== -1 && end !== -1) txt = txt.slice(start, end + 1);
  try {
    const o = JSON.parse(txt);
    const emotion: Emotion = isEmotion(o.emotion) ? o.emotion : 'happy';
    const meter = Math.max(0, Math.min(100, Number(o.secretMeter) || 0));
    const say = typeof o.say === 'string' && o.say.trim() ? o.say.trim() : '...';
    return { say, emotion, secretMeter: meter };
  } catch {
    return {
      say: (raw || "ehe~ say that again? 🥺").toString().slice(0, 400),
      emotion: 'surprised',
      secretMeter: 0,
    };
  }
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
    temperature: 1.0,
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
