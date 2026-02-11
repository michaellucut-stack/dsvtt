import { z } from 'zod';

import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_PLAYERS,
  MAX_ROOM_NAME_LENGTH,
  MIN_PLAYERS,
  DICE_FORMULA_MAX_LENGTH,
} from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Room schemas
// ---------------------------------------------------------------------------

/** Schema for creating a new room. */
export const roomCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(MAX_ROOM_NAME_LENGTH, `Room name must be at most ${MAX_ROOM_NAME_LENGTH} characters`),
  maxPlayers: z
    .number()
    .int()
    .min(MIN_PLAYERS, `Must allow at least ${MIN_PLAYERS} player`)
    .max(MAX_PLAYERS, `Cannot exceed ${MAX_PLAYERS} players`),
});

/** Schema for joining a room. */
export const roomJoinSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
});

/** Schema for leaving a room. */
export const roomLeaveSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
});

// ---------------------------------------------------------------------------
// Game lifecycle schemas
// ---------------------------------------------------------------------------

/** Schema for starting a game session. */
export const gameStartSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
});

/** Schema for pausing a game session. */
export const gamePauseSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

/** Schema for a generic game action. */
export const gameActionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  actionType: z.string().min(1, 'Action type is required'),
  data: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Token schemas
// ---------------------------------------------------------------------------

/** Schema for moving a token. */
export const tokenMoveSchema = z.object({
  tokenId: z.string().uuid('Invalid token ID'),
  mapId: z.string().uuid('Invalid map ID'),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

/** Schema for adding a token. */
export const tokenAddSchema = z.object({
  mapId: z.string().uuid('Invalid map ID'),
  name: z.string().min(1, 'Token name is required').max(100),
  imageUrl: z.string().url().nullable(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  layer: z.enum(['background', 'token', 'effect', 'gm']),
  visible: z.boolean(),
});

/** Schema for removing a token. */
export const tokenRemoveSchema = z.object({
  tokenId: z.string().uuid('Invalid token ID'),
  mapId: z.string().uuid('Invalid map ID'),
});

// ---------------------------------------------------------------------------
// Dice schemas
// ---------------------------------------------------------------------------

/** Schema for rolling dice. */
export const diceRollSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  formula: z
    .string()
    .min(1, 'Dice formula is required')
    .max(DICE_FORMULA_MAX_LENGTH, `Formula must be at most ${DICE_FORMULA_MAX_LENGTH} characters`),
});

// ---------------------------------------------------------------------------
// Chat schemas
// ---------------------------------------------------------------------------

/** Schema for sending a chat message. */
export const chatMessageSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  channel: z.enum(['ic', 'ooc', 'whisper', 'system']),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_CHAT_MESSAGE_LENGTH,
      `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
    ),
});

/** Schema for sending a whisper. */
export const chatWhisperSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  recipientId: z.string().uuid('Invalid recipient ID'),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_CHAT_MESSAGE_LENGTH,
      `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
    ),
});

// ---------------------------------------------------------------------------
// Turn schemas
// ---------------------------------------------------------------------------

/** Schema for ending a turn. */
export const turnEndSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

/** Schema for skipping a turn. */
export const turnSkipSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  targetUserId: z.string().uuid('Invalid target user ID'),
});

// ---------------------------------------------------------------------------
// Fog of war schemas
// ---------------------------------------------------------------------------

/** Schema for updating fog of war. */
export const fogUpdateSchema = z.object({
  mapId: z.string().uuid('Invalid map ID'),
  regionId: z.string().uuid('Invalid region ID'),
  revealed: z.boolean(),
});

// ---------------------------------------------------------------------------
// NPC schemas
// ---------------------------------------------------------------------------

/** Schema for an NPC action. */
export const npcActionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  npcId: z.string().uuid('Invalid NPC ID'),
  actionType: z.string().min(1, 'Action type is required'),
  data: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Map schemas
// ---------------------------------------------------------------------------

/** Schema for loading a map. */
export const mapLoadSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  mapId: z.string().uuid('Invalid map ID'),
});

/** Schema for updating a map. */
export const mapUpdateSchema = z.object({
  mapId: z.string().uuid('Invalid map ID'),
  name: z.string().min(1).max(100).optional(),
  backgroundUrl: z.string().url().nullable().optional(),
  gridWidth: z.number().int().min(1).optional(),
  gridHeight: z.number().int().min(1).optional(),
  gridSize: z.number().int().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Character schemas
// ---------------------------------------------------------------------------

/** Schema for updating a character. */
export const characterUpdateSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  characterId: z.string().uuid('Invalid character ID'),
  changes: z.record(z.string(), z.unknown()),
});
