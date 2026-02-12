/** Maximum number of players allowed in a single room. */
export const MAX_PLAYERS = 8;

/** Minimum number of players required for a game session. */
export const MIN_PLAYERS = 1;

/** Maximum character length for a room name. */
export const MAX_ROOM_NAME_LENGTH = 64;

/** Default grid cell size in pixels. */
export const GRID_DEFAULT_SIZE = 64;

/** Maximum character length for a chat message. */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

/** Maximum character length for a dice formula string. */
export const DICE_FORMULA_MAX_LENGTH = 100;

// Event sourcing
export { GameEventType } from './event-types.js';
export type { GameEventTypeValue } from './event-types.js';
