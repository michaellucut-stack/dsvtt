import { z } from 'zod';

// ---------------------------------------------------------------------------
// NPC schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating an NPC. */
export const createNpcSchema = z.object({
  name: z
    .string()
    .min(1, 'NPC name is required')
    .max(100, 'NPC name must be at most 100 characters')
    .trim(),
  stats: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z
    .string()
    .max(5000, 'Notes must be at most 5000 characters')
    .optional()
    .nullable(),
  tokenId: z.string().uuid('Invalid token ID').optional().nullable(),
});

/** Inferred type for a validated create-NPC payload. */
export type CreateNpcBody = z.infer<typeof createNpcSchema>;

/** Zod schema for updating an NPC. */
export const updateNpcSchema = z.object({
  name: z
    .string()
    .min(1, 'NPC name is required')
    .max(100, 'NPC name must be at most 100 characters')
    .trim()
    .optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
  notes: z
    .string()
    .max(5000, 'Notes must be at most 5000 characters')
    .optional()
    .nullable(),
  tokenId: z.string().uuid('Invalid token ID').optional().nullable(),
});

/** Inferred type for a validated update-NPC payload. */
export type UpdateNpcBody = z.infer<typeof updateNpcSchema>;

/** Zod schema for assigning a token to an NPC. */
export const assignTokenSchema = z.object({
  tokenId: z.string().uuid('Invalid token ID'),
});

/** Inferred type for a validated assign-token payload. */
export type AssignTokenBody = z.infer<typeof assignTokenSchema>;
