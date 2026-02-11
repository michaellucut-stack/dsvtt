import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '@dsvtt/auth';
import type { User, AuthTokens, JwtPayload } from '@dsvtt/shared';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { AppError } from '../../middleware/error-handler.js';
import type { RegisterBody, LoginBody } from './auth.schemas.js';

/** Successful auth response containing the user profile and token pair. */
export interface AuthResponse {
  user: Omit<User, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
  tokens: AuthTokens;
}

/**
 * Issue an access + refresh token pair for a given user.
 *
 * @param user - The user record to encode claims for.
 * @returns A pair of signed JWTs.
 */
function issueTokens(user: { id: string; email: string }, role = 'player'): AuthTokens {
  const payload = { sub: user.id, email: user.email, role };

  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

/**
 * Serialise a Prisma user record into a plain object safe for JSON responses.
 */
function serializeUser(user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}): AuthResponse['user'] {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: 'player' as User['role'],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Register a new user account.
 *
 * @param input - Validated registration payload.
 * @returns The created user and a signed token pair.
 * @throws {AppError} 409 if the email is already registered.
 */
export async function register(input: RegisterBody): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new AppError('Email already registered', 409, 'AUTH_EMAIL_EXISTS');
  }

  const passwordHash = await hashPassword(input.password, config.bcryptSaltRounds);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    },
  });

  const tokens = issueTokens(user);

  return { user: serializeUser(user), tokens };
}

/**
 * Authenticate an existing user with email and password.
 *
 * @param input - Validated login payload.
 * @returns The user profile and a signed token pair.
 * @throws {AppError} 401 on invalid credentials.
 */
export async function login(input: LoginBody): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const tokens = issueTokens(user);

  return { user: serializeUser(user), tokens };
}

/**
 * Verify a refresh token and issue a new access + refresh token pair.
 *
 * @param refreshToken - The refresh JWT to verify.
 * @returns A new token pair.
 * @throws {AppError} 401 if the refresh token is invalid or the user no longer exists.
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let decoded: JwtPayload;

  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as JwtPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'AUTH_INVALID_REFRESH');
  }

  // Ensure the user still exists
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
  });

  if (!user) {
    throw new AppError('User no longer exists', 401, 'AUTH_USER_NOT_FOUND');
  }

  return issueTokens(user);
}

/**
 * Retrieve the profile for an authenticated user.
 *
 * @param userId - The user's unique ID.
 * @returns The user profile.
 * @throws {AppError} 404 if the user is not found.
 */
export async function getProfile(userId: string): Promise<AuthResponse['user']> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return serializeUser(user);
}
