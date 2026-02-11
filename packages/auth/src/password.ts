import bcrypt from 'bcryptjs';

/** Default number of bcrypt salt rounds when none is specified. */
const DEFAULT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 *
 * @param plain  - The plaintext password to hash.
 * @param rounds - Number of bcrypt salt rounds (default 12).
 * @returns The bcrypt hash string.
 */
export async function hashPassword(
  plain: string,
  rounds: number = DEFAULT_ROUNDS,
): Promise<string> {
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plain, salt);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * @param plain - The plaintext password to check.
 * @param hash  - The bcrypt hash to compare against.
 * @returns `true` if the password matches the hash.
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
