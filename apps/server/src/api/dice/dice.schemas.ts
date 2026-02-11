import { z } from 'zod';
import { DICE_FORMULA_MAX_LENGTH } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Dice roll schemas
// ---------------------------------------------------------------------------

/** Zod schema for rolling dice via REST API. */
export const rollDiceSchema = z.object({
  formula: z
    .string()
    .min(1, 'Dice formula is required')
    .max(
      DICE_FORMULA_MAX_LENGTH,
      `Formula must be at most ${DICE_FORMULA_MAX_LENGTH} characters`,
    )
    .trim(),
  isPrivate: z.boolean().optional().default(false),
});

/** Inferred type for a validated dice roll payload. */
export type RollDiceBody = z.infer<typeof rollDiceSchema>;

/** Zod schema for the dice history query string. */
export const diceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Inferred type for validated dice history query params. */
export type DiceHistoryQuery = z.infer<typeof diceHistoryQuerySchema>;
