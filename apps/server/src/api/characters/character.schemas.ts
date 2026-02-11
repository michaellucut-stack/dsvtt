import { z } from 'zod';

// ---------------------------------------------------------------------------
// Character schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating a character. */
export const createCharacterSchema = z.object({
  name: z
    .string()
    .min(1, 'Character name is required')
    .max(100, 'Character name must be at most 100 characters')
    .trim(),
  stats: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z
    .string()
    .max(5000, 'Notes must be at most 5000 characters')
    .optional()
    .nullable(),
  inventory: z.array(z.unknown()).optional().default([]),
});

/** Inferred type for a validated create-character payload. */
export type CreateCharacterBody = z.infer<typeof createCharacterSchema>;

/** Zod schema for updating a character. */
export const updateCharacterSchema = z.object({
  name: z
    .string()
    .min(1, 'Character name is required')
    .max(100, 'Character name must be at most 100 characters')
    .trim()
    .optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
  notes: z
    .string()
    .max(5000, 'Notes must be at most 5000 characters')
    .optional()
    .nullable(),
  inventory: z.array(z.unknown()).optional(),
});

/** Inferred type for a validated update-character payload. */
export type UpdateCharacterBody = z.infer<typeof updateCharacterSchema>;
