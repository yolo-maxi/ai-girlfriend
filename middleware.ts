import { NextRequest, NextResponse } from 'next/server';

// Password login gate. /api/login sets an opaque HttpOnly session cookie.
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || process.env.ACCESS_TOKEN || '';
const COOKIE = 'aigf_auth';

export const config = {
  // Gate everything except Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const cookie = req.cookies.get(COOKIE)?.value;
  const isLoginPage = pathname === '/login';
  const isLoginApi = pathname === '/api/login';

  if (isLoginApi) return NextResponse.next();

  if (!SESSION_SECRET) {
    return new NextResponse('Auth is not configured.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (cookie === SESSION_SECRET) {
    if (isLoginPage) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  if (isLoginPage) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const login = new URL('/login', req.url);
  login.searchParams.set('next', pathname + url.search);
  return NextResponse.redirect(login);
}
