import { describe, it, expect } from 'vitest';
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  TokenVerificationError,
} from '../jwt.js';
import type { AuthConfig } from '../types.js';
import type { TokenUser } from '../jwt.js';

const testUser: TokenUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'player',
};

const testConfig: AuthConfig = {
  jwtSecret: 'test-access-secret-that-is-long-enough',
  jwtExpiresIn: '15m',
  refreshSecret: 'test-refresh-secret-that-is-different',
  refreshExpiresIn: '7d',
  bcryptRounds: 4,
};

describe('generateTokens', () => {
  it('returns { accessToken, refreshToken } as strings', () => {
    const tokens = generateTokens(testUser, testConfig);
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken.length).toBeGreaterThan(0);
  });
});

describe('verifyAccessToken', () => {
  it('decodes a valid token and returns payload with sub, email, role', () => {
    const tokens = generateTokens(testUser, testConfig);
    const payload = verifyAccessToken(tokens.accessToken, testConfig.jwtSecret);

    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('player');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('throws TokenVerificationError for invalid token', () => {
    expect(() => verifyAccessToken('not-a-valid-token', testConfig.jwtSecret))
      .toThrow(TokenVerificationError);
  });

  it('throws TokenVerificationError for expired token', () => {
    const shortLivedConfig: AuthConfig = {
      ...testConfig,
      // Use a negative expiry so the token is already expired when created
      // jsonwebtoken will issue an expired token with "0s" — but we use a trick:
      // generate with 0 seconds, which means it's expired immediately upon verification
      jwtExpiresIn: '0s',
    };

    const tokens = generateTokens(testUser, shortLivedConfig);
    expect(() =>
      verifyAccessToken(tokens.accessToken, shortLivedConfig.jwtSecret),
    ).toThrow(TokenVerificationError);
  });
});

describe('verifyRefreshToken', () => {
  it('decodes a valid refresh token', () => {
    const tokens = generateTokens(testUser, testConfig);
    const payload = verifyRefreshToken(
      tokens.refreshToken,
      testConfig.refreshSecret,
    );

    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('player');
  });

  it('throws TokenVerificationError for invalid token', () => {
    expect(() =>
      verifyRefreshToken('garbage-token', testConfig.refreshSecret),
    ).toThrow(TokenVerificationError);
  });
});

describe('access and refresh tokens use different secrets', () => {
  it('access token cannot be verified with refresh secret', () => {
    const tokens = generateTokens(testUser, testConfig);
    expect(() =>
      verifyAccessToken(tokens.accessToken, testConfig.refreshSecret),
    ).toThrow(TokenVerificationError);
  });

  it('refresh token cannot be verified with access secret', () => {
    const tokens = generateTokens(testUser, testConfig);
    expect(() =>
      verifyRefreshToken(tokens.refreshToken, testConfig.jwtSecret),
    ).toThrow(TokenVerificationError);
  });
});
