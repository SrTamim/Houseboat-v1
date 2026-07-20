import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * App-layer field encryption (AES-256-GCM) for PII at rest — e.g. refund bank
 * details. The DB stores ciphertext; only this process (with ENCRYPTION_KEY)
 * can read it. Format: v1:<iv b64>:<tag b64>:<ciphertext b64>.
 *
 * ENCRYPTION_KEY is any string; we derive a 32-byte key via SHA-256 so key
 * length is never a footgun. Rotating the key makes old ciphertext unreadable —
 * plan a re-encryption migration if you rotate.
 */

const PREFIX = 'v1';

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptJson(value: unknown, secret: string): string {
  const key = keyFrom(secret);
  const iv = randomBytes(12); // GCM standard nonce size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptJson<T = unknown>(blob: string, secret: string): T {
  const [prefix, ivB64, tagB64, dataB64] = blob.split(':');
  if (prefix !== PREFIX) {
    throw new Error('Unrecognized ciphertext format');
  }
  const key = keyFrom(secret);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
