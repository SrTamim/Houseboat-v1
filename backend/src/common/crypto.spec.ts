import { encryptJson, decryptJson } from './crypto';

describe('field encryption (AES-256-GCM)', () => {
  const secret = 'a-test-secret-that-is-long-enough-32b';

  it('round-trips a JSON value', () => {
    const value = { account: '1234567890', bank: 'Test Bank', branch: 'Dhaka' };
    const blob = encryptJson(value, secret);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain('1234567890'); // ciphertext, not plaintext
    expect(decryptJson(blob, secret)).toEqual(value);
  });

  it('fails to decrypt with the wrong key', () => {
    const blob = encryptJson({ x: 1 }, secret);
    expect(() => decryptJson(blob, 'a-different-secret-key-of-length-32b')).toThrow();
  });

  it('rejects tampered ciphertext (auth tag)', () => {
    const blob = encryptJson({ hello: 'world' }, secret);
    const parts = blob.split(':');
    // Flip a byte in the auth tag — GCM verification must fail.
    const tag = Buffer.from(parts[2], 'base64');
    tag[0] ^= 0xff;
    parts[2] = tag.toString('base64');
    expect(() => decryptJson(parts.join(':'), secret)).toThrow();
  });
});
