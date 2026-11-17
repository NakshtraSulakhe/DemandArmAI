import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/security/session';

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({
        required: true,
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      required: true,
      authenticated: true,
      user,
    });
  } catch (err: any) {
    return NextResponse.json({
      required: true,
      authenticated: false,
      user: null,
      error: err.message,
    });
  }
}
