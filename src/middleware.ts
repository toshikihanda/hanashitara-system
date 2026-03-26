import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: '/:path*',
};

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  const user = process.env.BASIC_AUTH_USER || 'admin';
  const pwd = process.env.BASIC_AUTH_PASSWORD || 'hanashitara2026';

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [providedUser, providedPwd] = atob(authValue).split(':');

    if (providedUser === user && providedPwd === pwd) {
      return NextResponse.next();
    }
  }

  url.pathname = '/api/basicauth';

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
