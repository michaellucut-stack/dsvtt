/**
 * Player role within a game session.
 * Directors control the game; players participate.
 */
export type PlayerRole = 'director' | 'player';

/** Core user entity representing an authenticated account. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: PlayerRole;
  createdAt: Date;
  updatedAt: Date;
}

/** JWT access and refresh token pair returned on authentication. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Decoded JWT payload claims. */
export interface JwtPayload {
  /** Subject — the user ID. */
  sub: string;
  email: string;
  role: PlayerRole;
  /** Issued-at timestamp (seconds since epoch). */
  iat: number;
  /** Expiration timestamp (seconds since epoch). */
  exp: number;
}
