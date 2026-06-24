import { NextRequest, NextResponse } from 'next/server';

// Magic-link token gate. Visit /?token=XXX once -> sets HttpOnly cookie -> clean URL.
// No open site: without a valid cookie/token everything 401s.
const TOKEN = process.env.ACCESS_TOKEN || '';
const COOKIE = 'aigf_auth';

export const config = {
  // gate everything except Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  if (!TOKEN) return NextResponse.next(); // unset = open (dev only)

  const url = req.nextUrl;
  const qToken = url.searchParams.get('token');
  const cookie = req.cookies.get(COOKIE)?.value;

  // valid cookie already
  if (cookie === TOKEN) return NextResponse.next();

  // magic link: token in query -> set cookie, redirect to clean URL
  if (qToken === TOKEN) {
    const clean = url.clone();
    clean.searchParams.delete('token');
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return new NextResponse('🔒 nuh uh~ you need the magic link to meet your waifu', {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
