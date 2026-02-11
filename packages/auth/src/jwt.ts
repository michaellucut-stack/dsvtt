import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload, PlayerRole } from '@dsvtt/shared';
import type { AuthConfig } from './types.js';
import type { AuthTokens } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Token user shape (minimal claims required for token generation)
// ---------------------------------------------------------------------------

/** Minimal user information required to generate JWT tokens. */
export interface TokenUser {
  readonly id: string;
  readonly email: string;
  readonly role: PlayerRole;
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

/** Error thrown when a JWT cannot be verified or has expired. */
export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Generate an access / refresh token pair for a user.
 *
 * @param user   - The user to encode into the tokens.
 * @param config - Auth configuration containing secrets and lifetimes.
 * @returns An {@link AuthTokens} object with `accessToken` and `refreshToken`.
 */
export function generateTokens(
  user: TokenUser,
  config: AuthConfig,
): AuthTokens {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessOpts: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  const refreshOpts: SignOptions = {
    expiresIn: config.refreshExpiresIn as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(payload, config.jwtSecret, accessOpts);
  const refreshToken = jwt.sign(payload, config.refreshSecret, refreshOpts);

  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Token verification helpers
// ---------------------------------------------------------------------------

/**
 * Verify and decode a JWT access token.
 *
 * @param token  - The raw JWT string to verify.
 * @param secret - The secret the token was signed with.
 * @returns The decoded {@link JwtPayload}.
 * @throws {TokenVerificationError} If the token is invalid or expired.
 */
export function verifyAccessToken(
  token: string,
  secret: string,
): JwtPayload {
  return verifyToken(token, secret);
}

/**
 * Verify and decode a JWT refresh token.
 *
 * @param token  - The raw JWT string to verify.
 * @param secret - The secret the token was signed with.
 * @returns The decoded {@link JwtPayload}.
 * @throws {TokenVerificationError} If the token is invalid or expired.
 */
export function verifyRefreshToken(
  token: string,
  secret: string,
): JwtPayload {
  return verifyToken(token, secret);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Shared verification logic. Decodes the token and maps the raw jsonwebtoken
 * payload to the application-level {@link JwtPayload} shape.
 */
function verifyToken(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      throw new TokenVerificationError(
        'Token payload is missing required claims',
      );
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role as PlayerRole,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error: unknown) {
    if (error instanceof TokenVerificationError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenVerificationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenVerificationError(`Invalid token: ${error.message}`);
    }
    throw new TokenVerificationError('Token verification failed');
  }
}
