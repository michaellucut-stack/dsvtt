import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

describe('hashPassword', () => {
  it('produces a bcrypt hash string', async () => {
    const hash = await hashPassword('mysecretpassword', 4);
    expect(typeof hash).toBe('string');
    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('different passwords produce different hashes', async () => {
    const hash1 = await hashPassword('password-one', 4);
    const hash2 = await hashPassword('password-two', 4);
    expect(hash1).not.toBe(hash2);
  });

  it('salt rounds parameter affects hash (low rounds for speed)', async () => {
    // Just verify that specifying rounds=4 still produces a valid hash
    const start = Date.now();
    const hash = await hashPassword('testpassword', 4);
    const elapsed = Date.now() - start;

    expect(hash).toMatch(/^\$2[ab]\$/);
    // With rounds=4, hashing should be very fast (under 1 second)
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const plain = 'correcthorsebatterystaple';
    const hash = await hashPassword(plain, 4);
    const result = await verifyPassword(plain, hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('realpassword', 4);
    const result = await verifyPassword('wrongpassword', hash);
    expect(result).toBe(false);
  });
});
