import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Gets a 32-byte secret key for encryption.
 * Derived from process.env.CREDENTIAL_ENCRYPTION_KEY or a fallback server secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || 'demandarm_secure_backend_encryption_secret_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plain-text string (e.g. an API Key).
 * Format: `enc:v1:<iv_hex>:<authTag_hex>:<encrypted_hex>`
 */
export function encryptCredential(plainText: string): string {
  if (!plainText || plainText.trim() === '') {
    return '';
  }
  // If already encrypted, return as is
  if (isEncrypted(plainText)) {
    return plainText;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an encrypted credential string.
 * Returns original plain-text or empty string.
 */
export function decryptCredential(encryptedText: string): string {
  if (!encryptedText || encryptedText.trim() === '') {
    return '';
  }

  // If text is not in encrypted format (e.g. plain text legacy string), return as is
  if (!isEncrypted(encryptedText)) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      return encryptedText;
    }

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt credential string:', err);
    return '';
  }
}

/**
 * Checks if a string is encrypted with encryptCredential format.
 */
export function isEncrypted(text: string): boolean {
  return typeof text === 'string' && text.startsWith('enc:v1:');
}

/**
 * Masks an API Key for frontend display.
 * Example: `AIzaSy******Ab12`
 */
export function maskApiKey(key: string): string {
  if (!key || key.trim() === '') {
    return '';
  }
  const clean = isEncrypted(key) ? decryptCredential(key) : key;
  if (!clean || clean.trim() === '') {
    return '';
  }
  if (clean.length <= 8) {
    return '********';
  }
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}******${suffix}`;
}
