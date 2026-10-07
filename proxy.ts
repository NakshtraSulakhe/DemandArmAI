import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { consoleSessionToken } from '@/lib/security/session';

export async function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/health') ||
    path.startsWith('/api/webhooks')
  ) {
    return NextResponse.next();
  }

  if (!path.startsWith('/api/')) return NextResponse.next();

  if (request.cookies.get('qa_session')?.value === consoleSessionToken(password)) {
    return NextResponse.next();
  }

  return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
}

export const config = {
  matcher: ['/api/:path*'],
};
