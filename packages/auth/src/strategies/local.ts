import { Strategy as LocalStrategy } from 'passport-local';
import type { User } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

/**
 * Callback that locates a user by their email address.
 * Should return `null` if no user is found.
 */
export type FindUserByEmail = (email: string) => Promise<User | null>;

/**
 * Callback that verifies a plaintext password against a stored hash.
 * Receives the plaintext password and the user's hashed password.
 */
export type VerifyPasswordFn = (
  plain: string,
  hash: string,
) => Promise<boolean>;

/**
 * Extended user record that includes the password hash.
 * The strategy needs access to the hash for verification but it is
 * intentionally excluded from the shared `User` type.
 */
export interface UserWithPassword extends User {
  /** The bcrypt password hash stored for this user. */
  readonly passwordHash: string;
}

/** Like {@link FindUserByEmail} but returns the password hash too. */
export type FindUserWithPasswordByEmail = (
  email: string,
) => Promise<UserWithPassword | null>;

// ---------------------------------------------------------------------------
// Strategy factory
// ---------------------------------------------------------------------------

/**
 * Create a Passport.js local strategy configured for email + password login.
 *
 * @param findUser         - Async function that retrieves a user (with password hash) by email.
 * @param verifyPasswordFn - Async function that compares a plaintext password to a hash.
 * @returns A configured `passport-local` {@link LocalStrategy} instance.
 *
 * @example
 * ```ts
 * import passport from 'passport';
 * import { createLocalStrategy } from '@dsvtt/auth';
 * import { verifyPassword } from '@dsvtt/auth';
 *
 * passport.use(
 *   createLocalStrategy(findUserWithPasswordByEmail, verifyPassword),
 * );
 * ```
 */
export function createLocalStrategy(
  findUser: FindUserWithPasswordByEmail,
  verifyPasswordFn: VerifyPasswordFn,
): LocalStrategy {
  return new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    (email, password, done) => {
      void (async (): Promise<void> => {
        try {
          const user = await findUser(email.toLowerCase().trim());

          if (!user) {
            done(null, false, { message: 'Invalid email or password' });
            return;
          }

          const isValid = await verifyPasswordFn(
            password,
            user.passwordHash,
          );

          if (!isValid) {
            done(null, false, { message: 'Invalid email or password' });
            return;
          }

          // Strip the password hash before passing the user downstream.
          const { passwordHash: _hash, ...safeUser } = user;
          done(null, safeUser as User);
        } catch (error: unknown) {
          done(error);
        }
      })();
    },
  );
}
