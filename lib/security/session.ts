import { createHash } from 'crypto';

export function consoleSessionToken(password: string): string {
  return createHash('sha256').update(`demandarm-console:${password}`).digest('hex');
}
