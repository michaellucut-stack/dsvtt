import { z } from 'zod';

// ---------------------------------------------------------------------------
// Map CRUD schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating a new game map. */
export const createMapSchema = z.object({
  name: z
    .string()
    .min(1, 'Map name is required')
    .max(100, 'Map name must be at most 100 characters')
    .trim(),
  gridWidth: z
    .number()
    .int('gridWidth must be an integer')
    .min(1, 'gridWidth must be at least 1')
    .max(200, 'gridWidth must be at most 200'),
  gridHeight: z
    .number()
    .int('gridHeight must be an integer')
    .min(1, 'gridHeight must be at least 1')
    .max(200, 'gridHeight must be at most 200'),
  gridSize: z
    .number()
    .int('gridSize must be an integer')
    .min(16, 'gridSize must be at least 16')
    .max(256, 'gridSize must be at most 256')
    .optional()
    .default(64),
});

/** Inferred type for a validated create-map payload. */
export type CreateMapBody = z.infer<typeof createMapSchema>;

/** Zod schema for updating an existing game map. */
export const updateMapSchema = z.object({
  name: z
    .string()
    .min(1, 'Map name is required')
    .max(100, 'Map name must be at most 100 characters')
    .trim()
    .optional(),
  gridWidth: z
    .number()
    .int('gridWidth must be an integer')
    .min(1, 'gridWidth must be at least 1')
    .max(200, 'gridWidth must be at most 200')
    .optional(),
  gridHeight: z
    .number()
    .int('gridHeight must be an integer')
    .min(1, 'gridHeight must be at least 1')
    .max(200, 'gridHeight must be at most 200')
    .optional(),
  gridSize: z
    .number()
    .int('gridSize must be an integer')
    .min(16, 'gridSize must be at least 16')
    .max(256, 'gridSize must be at most 256')
    .optional(),
});

/** Inferred type for a validated update-map payload. */
export type UpdateMapBody = z.infer<typeof updateMapSchema>;

// ---------------------------------------------------------------------------
// Token schemas
// ---------------------------------------------------------------------------

/** Zod schema for adding a token to a map. */
export const addTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be at most 100 characters')
    .trim(),
  x: z.number().min(0, 'x must be non-negative'),
  y: z.number().min(0, 'y must be non-negative'),
  width: z.number().min(0.25, 'width must be at least 0.25').default(1),
  height: z.number().min(0.25, 'height must be at least 0.25').default(1),
  layer: z.enum(['BACKGROUND', 'TOKEN', 'EFFECT', 'GM']).default('TOKEN'),
  ownerId: z.string().uuid('Invalid ownerId').optional(),
  imageUrl: z.string().url('Invalid image URL').nullable().optional(),
  visible: z.boolean().optional().default(true),
});

/** Inferred type for a validated add-token payload. */
export type AddTokenBody = z.infer<typeof addTokenSchema>;

/** Zod schema for moving a token. */
export const moveTokenSchema = z.object({
  x: z.number().min(0, 'x must be non-negative'),
  y: z.number().min(0, 'y must be non-negative'),
});

/** Inferred type for a validated move-token payload. */
export type MoveTokenBody = z.infer<typeof moveTokenSchema>;

// ---------------------------------------------------------------------------
// Fog region schemas
// ---------------------------------------------------------------------------

/** Zod schema for a single fog polygon point. */
const fogPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/** Zod schema for creating a fog region. */
export const createFogRegionSchema = z.object({
  points: z
    .array(fogPointSchema)
    .min(3, 'A fog region requires at least 3 points'),
  revealed: z.boolean().optional().default(false),
});

/** Inferred type for a validated create-fog-region payload. */
export type CreateFogRegionBody = z.infer<typeof createFogRegionSchema>;

/** Zod schema for updating a fog region's visibility. */
export const updateFogRegionSchema = z.object({
  revealed: z.boolean(),
});

/** Inferred type for a validated update-fog-region payload. */
export type UpdateFogRegionBody = z.infer<typeof updateFogRegionSchema>;
