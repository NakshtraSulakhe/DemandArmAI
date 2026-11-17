import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { SessionUser } from '../types';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.ADMIN_PASSWORD ||
  'demandarm-qa-secure-session-key-2026-b2b';

export function consoleSessionToken(password: string): string {
  return createHash('sha256').update(`demandarm-console:${password}`).digest('hex');
}

/**
 * Hash a password using scrypt with a cryptographic salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString('hex');
  const hash = scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

/**
 * Verify a plaintext password against a stored scrypt hash & salt using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const hash = scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash);
    const b = Buffer.from(storedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Issue a signed compact session token for the authenticated user.
 */
export function createSessionToken(user: SessionUser): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14, // 14 days valid
    })
  ).toString('base64url');

  const signature = createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode a session token. Returns null if expired, tampered, or invalid.
 */
export function verifySessionToken(token: string): SessionUser | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSignature = createHmac('sha256', SESSION_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!decoded.username || !decoded.role) {
      return null;
    }

    return {
      id: decoded.id || decoded.username,
      username: decoded.username,
      name: decoded.name || decoded.username,
      email: decoded.email,
      role: decoded.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };
  } catch {
    return null;
  }
}

/**
 * Read the current session user from the incoming request or next/headers cookies.
 */
export async function getSessionUser(req?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)qa_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('qa_session')?.value;
    } catch {
      // Outside Request / next/headers context
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Assert that the request is authenticated, throwing an Error if not.
 */
export async function requireAuth(req?: Request): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Assert that the request is from an ADMIN user, throwing an Error if not.
 */
export async function requireAdmin(req?: Request): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin role required');
  }
  return user;
}
