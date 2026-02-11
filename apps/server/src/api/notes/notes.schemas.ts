import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared notes schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating a shared note. */
export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim(),
  content: z
    .string()
    .max(50_000, 'Content must be at most 50000 characters')
    .default(''),
});

/** Inferred type for a validated create-note payload. */
export type CreateNoteBody = z.infer<typeof createNoteSchema>;

/** Zod schema for updating a shared note. */
export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .trim()
    .optional(),
  content: z
    .string()
    .max(50_000, 'Content must be at most 50000 characters')
    .optional(),
});

/** Inferred type for a validated update-note payload. */
export type UpdateNoteBody = z.infer<typeof updateNoteSchema>;
