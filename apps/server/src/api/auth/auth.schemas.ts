import { z } from 'zod';

/** Zod schema for the registration request body. */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(64, 'Display name must be at most 64 characters')
    .trim(),
});

/** Inferred type for a validated registration payload. */
export type RegisterBody = z.infer<typeof registerSchema>;

/** Zod schema for the login request body. */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Inferred type for a validated login payload. */
export type LoginBody = z.infer<typeof loginSchema>;

/** Zod schema for the token refresh request body. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** Inferred type for a validated refresh payload. */
export type RefreshBody = z.infer<typeof refreshSchema>;
