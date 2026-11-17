import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { getSessionUser, hashPassword } from '@/lib/security/session';
import { AppUser, UserRole } from '@/lib/types';

function toSafeUser(user: AppUser) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    const caller = await getSessionUser(req);
    if (!caller || caller.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only administrators can view user accounts.' },
        { status: 403 }
      );
    }

    const users = dbStore.getUsers().map(toSafeUser);
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await getSessionUser(req);
    if (!caller || caller.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only administrators can create users.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const role: UserRole = body.role === 'ADMIN' ? 'ADMIN' : 'USER';

    // Validation
    if (!username) {
      return NextResponse.json({ success: false, error: 'Username is required.' }, { status: 400 });
    }
    if (username.length < 3) {
      return NextResponse.json({ success: false, error: 'Username must be at least 3 characters long.' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username may only contain letters, numbers, hyphens, underscores, and dots.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // Check duplicate username
    const existing = dbStore.getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ success: false, error: `Username "${username}" is already taken.` }, { status: 409 });
    }

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const newUser: AppUser = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      username,
      name: name || username,
      email: email || undefined,
      passwordHash: hash,
      salt,
      role,
      createdAt: now,
      updatedAt: now,
    };

    dbStore.upsertUser(newUser);
    dbStore.addAuditLog(
      undefined,
      'USER_CREATED',
      `User "${username}" (${role}) created by admin "${caller.username}".`
    );

    return NextResponse.json({
      success: true,
      message: `User "${username}" created successfully.`,
      user: toSafeUser(newUser),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await getSessionUser(req);
    if (!caller || caller.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only administrators can delete users.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const allUsers = dbStore.getUsers();
    const target = allUsers.find((u) => u.id === id);
    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Protection 1: Cannot delete yourself
    if (target.id === caller.id || target.username.toLowerCase() === caller.username.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own currently signed-in administrator account.' },
        { status: 400 }
      );
    }

    // Protection 2: Cannot delete the last admin
    if (target.role === 'ADMIN') {
      const adminCount = allUsers.filter((u) => u.role === 'ADMIN').length;
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the sole administrator account on the system.' },
          { status: 400 }
        );
      }
    }

    const deleted = dbStore.deleteUser(id);
    if (deleted) {
      dbStore.addAuditLog(
        undefined,
        'USER_DELETED',
        `User "${target.username}" (${target.role}) deleted by admin "${caller.username}".`
      );
      return NextResponse.json({ success: true, message: `User "${target.username}" deleted.` });
    }

    return NextResponse.json({ success: false, error: 'Failed to delete user.' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
