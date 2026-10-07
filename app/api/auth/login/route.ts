import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { consoleSessionToken } from '@/lib/security/session';

export async function POST(req: Request) {
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    return NextResponse.json({ success: true, required: false });
  }

  const body = await req.json().catch(() => ({}));
  const given = String(body.password || '');
  const givenHash = Buffer.from(consoleSessionToken(given));
  const expectedHash = Buffer.from(consoleSessionToken(password));
  const matches = givenHash.length === expectedHash.length && timingSafeEqual(givenHash, expectedHash);

  if (!matches) {
    return NextResponse.json({ success: false, error: 'That password is not right.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('qa_session', consoleSessionToken(password), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
