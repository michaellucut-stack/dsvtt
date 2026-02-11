import { z } from 'zod';
import type { User, AuthTokens } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------------------

/** Configuration for the authentication subsystem. */
export interface AuthConfig {
  /** Secret used to sign JWT access tokens. */
  readonly jwtSecret: string;
  /** Access token lifetime (e.g. "15m", "1h"). */
  readonly jwtExpiresIn: string;
  /** Secret used to sign JWT refresh tokens. */
  readonly refreshSecret: string;
  /** Refresh token lifetime (e.g. "7d", "30d"). */
  readonly refreshExpiresIn: string;
  /** Number of bcrypt salt rounds for password hashing. */
  readonly bcryptRounds: number;
}

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

/** Zod schema for user registration input. */
export const RegisterInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(64, 'Display name must be at most 64 characters'),
});

/** Validated registration payload. */
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** Zod schema for user login input. */
export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Validated login payload. */
export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Zod schema for token refresh input. */
export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** Validated refresh payload. */
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

// ---------------------------------------------------------------------------
// Auth result
// ---------------------------------------------------------------------------

/** Successful authentication result containing the user and token pair. */
export interface AuthResult {
  /** The authenticated user. */
  readonly user: User;
  /** The issued access and refresh tokens. */
  readonly tokens: AuthTokens;
}
