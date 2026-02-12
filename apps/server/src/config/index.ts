import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from monorepo root
dotenvConfig({ path: resolve(import.meta.dirname, '../../../..', '.env') });

/** Server configuration loaded from environment variables with sensible defaults. */
export interface ServerConfig {
  /** HTTP port the server listens on. */
  readonly port: number;
  /** Allowed CORS origin(s). */
  readonly corsOrigin: string;
  /** Secret used to sign JWT access tokens. */
  readonly jwtSecret: string;
  /** Access token lifetime (e.g. "15m"). */
  readonly jwtExpiresIn: string;
  /** Secret used to sign JWT refresh tokens. */
  readonly jwtRefreshSecret: string;
  /** Refresh token lifetime (e.g. "7d"). */
  readonly jwtRefreshExpiresIn: string;
  /** Number of bcrypt salt rounds. */
  readonly bcryptSaltRounds: number;
  /** Current runtime environment. */
  readonly nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Reads an environment variable, returning a default if not set.
 * @param key - The environment variable name.
 * @param fallback - The default value.
 */
function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/** Parsed and validated server configuration. */
export const config: ServerConfig = {
  port: parseInt(env('SERVER_PORT', '4000'), 10),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  jwtSecret: env('JWT_SECRET', 'dev-jwt-secret-change-me'),
  jwtExpiresIn: env('JWT_EXPIRES_IN', '15m'),
  jwtRefreshSecret: env('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtRefreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
  bcryptSaltRounds: parseInt(env('BCRYPT_SALT_ROUNDS', '12'), 10),
  nodeEnv: env('NODE_ENV', 'development') as ServerConfig['nodeEnv'],
};
