import { describe, it, expect } from 'vitest';
import {
  RegisterInputSchema,
  LoginInputSchema,
  RefreshInputSchema,
} from '../types.js';

describe('RegisterInputSchema', () => {
  it('accepts valid input {email, password, displayName}', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'user@example.com',
      password: 'securepassword123',
      displayName: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'not-an-email',
      password: 'securepassword123',
      displayName: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password (min 8)', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      displayName: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing displayName', () => {
    const result = RegisterInputSchema.safeParse({
      email: 'user@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginInputSchema', () => {
  it('accepts valid {email, password}', () => {
    const result = LoginInputSchema.safeParse({
      email: 'user@example.com',
      password: 'mypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = LoginInputSchema.safeParse({
      email: 'bad-email',
      password: 'mypassword',
    });
    expect(result.success).toBe(false);
  });
});

describe('RefreshInputSchema', () => {
  it('accepts valid {refreshToken}', () => {
    const result = RefreshInputSchema.safeParse({
      refreshToken: 'some-valid-token-string',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty refreshToken', () => {
    const result = RefreshInputSchema.safeParse({
      refreshToken: '',
    });
    expect(result.success).toBe(false);
  });
});
