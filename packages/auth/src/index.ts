// ---------------------------------------------------------------------------
// @dsvtt/auth — Authentication, JWT, password hashing, and RBAC
// ---------------------------------------------------------------------------

// Types & schemas
export type { AuthConfig, RegisterInput, LoginInput, RefreshInput, AuthResult } from './types.js';
export { RegisterInputSchema, LoginInputSchema, RefreshInputSchema } from './types.js';

// Password hashing
export { hashPassword, verifyPassword } from './password.js';

// JWT utilities
export type { TokenUser } from './jwt.js';
export { generateTokens, verifyAccessToken, verifyRefreshToken, TokenVerificationError } from './jwt.js';

// Passport local strategy
export type {
  FindUserByEmail,
  FindUserWithPasswordByEmail,
  VerifyPasswordFn,
  UserWithPassword,
} from './strategies/local.js';
export { createLocalStrategy } from './strategies/local.js';

// RBAC
export type { Permission } from './rbac.js';
export {
  DIRECTOR_PERMISSIONS,
  PLAYER_PERMISSIONS,
  hasPermission,
  requireRole,
} from './rbac.js';
