import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const COOKIE = 'aigf_auth';

function matchesPassword(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  const password = process.env.AUTH_PASSWORD || '';
  const sessionSecret = process.env.AUTH_SESSION_SECRET || process.env.ACCESS_TOKEN || '';

  if (!password || !sessionSecret) {
    return NextResponse.json({ error: 'Auth is not configured.' }, { status: 503 });
  }

  let input = '';
  try {
    const body = await req.json();
    input = String(body?.password || '');
  } catch {
    return NextResponse.json({ error: 'Bad login request.' }, { status: 400 });
  }

  if (!matchesPassword(input, password)) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, sessionSecret, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
