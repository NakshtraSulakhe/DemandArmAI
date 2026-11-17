import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { createSessionToken, verifyPassword } from '@/lib/security/session';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || body.email || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter both username and password.' },
        { status: 400 }
      );
    }

    // 1. Try finding user in dbStore memory/local cache
    let user = dbStore.getUserByUsername(username);

    // 2. If not found in cache, query MySQL database directly
    if (!user) {
      try {
        const norm = username.toLowerCase();
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: norm },
              { email: norm },
            ],
          },
        });
        if (dbUser) {
          user = {
            id: dbUser.id,
            username: dbUser.username,
            name: dbUser.name,
            email: dbUser.email || undefined,
            passwordHash: dbUser.passwordHash,
            salt: dbUser.salt,
            role: dbUser.role as UserRole,
            createdAt: dbUser.createdAt.toISOString(),
            updatedAt: dbUser.updatedAt.toISOString(),
          };
          dbStore.upsertUser(user);
        }
      } catch {
        // Database offline or query error
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    // Verify password against stored hash & salt
    const valid = verifyPassword(password, user.passwordHash, user.salt);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      email: user.email,
      role: user.role,
    };

    const token = createSessionToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    response.cookies.set('qa_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected server error occurred during login.' },
      { status: 500 }
    );
  }
}
