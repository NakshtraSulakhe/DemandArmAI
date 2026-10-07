import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { consoleSessionToken } from '@/lib/security/session';

export async function GET() {
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    return NextResponse.json({ required: false, authenticated: true });
  }

  const cookieStore = await cookies();
  const value = cookieStore.get('qa_session')?.value;
  return NextResponse.json({
    required: true,
    authenticated: value === consoleSessionToken(password),
  });
}
