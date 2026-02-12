import { z } from 'zod';
import { MAX_PLAYERS, MIN_PLAYERS, MAX_ROOM_NAME_LENGTH } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Room CRUD schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating a new room. */
export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(MAX_ROOM_NAME_LENGTH, `Room name must be at most ${MAX_ROOM_NAME_LENGTH} characters`)
    .trim(),
  maxPlayers: z
    .number()
    .int('maxPlayers must be an integer')
    .min(MIN_PLAYERS, `Must allow at least ${MIN_PLAYERS} player`)
    .max(MAX_PLAYERS, `Cannot exceed ${MAX_PLAYERS} players`),
  /** Optional game system ID (Phase 2). When set, the room uses game-specific rules. */
  gameSystemId: z.string().uuid('Invalid game system ID').optional().nullable(),
});

/** Inferred type for a validated create-room payload. */
export type CreateRoomBody = z.infer<typeof createRoomSchema>;

/** Zod schema for joining a room. */
export const joinRoomSchema = z.object({
  role: z.enum(['player', 'director']).optional().default('player'),
});

/** Inferred type for a validated join-room payload. */
export type JoinRoomBody = z.infer<typeof joinRoomSchema>;

/** Zod schema for the list-rooms query string. */
export const listRoomsQuerySchema = z.object({
  status: z.enum(['WAITING', 'ACTIVE', 'PAUSED', 'ENDED']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Inferred type for validated list-rooms query params. */
export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;
