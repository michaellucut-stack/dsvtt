/**
 * All event types that can be logged in the event-sourcing store.
 * Used as the `eventType` discriminator in GameEventLog records.
 */
export const GameEventType = {
  // Game lifecycle
  GAME_STARTED: 'GAME_STARTED',
  GAME_PAUSED: 'GAME_PAUSED',
  GAME_RESUMED: 'GAME_RESUMED',
  GAME_ENDED: 'GAME_ENDED',

  // Chat
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  CHAT_WHISPER: 'CHAT_WHISPER',

  // Dice
  DICE_ROLL: 'DICE_ROLL',
  DICE_ROLL_PRIVATE: 'DICE_ROLL_PRIVATE',

  // Tokens
  TOKEN_MOVED: 'TOKEN_MOVED',
  TOKEN_ADDED: 'TOKEN_ADDED',
  TOKEN_REMOVED: 'TOKEN_REMOVED',

  // Map
  MAP_UPDATED: 'MAP_UPDATED',

  // Fog of war
  FOG_UPDATED: 'FOG_UPDATED',

  // Turns
  TURN_ADVANCED: 'TURN_ADVANCED',
  TURN_SKIPPED: 'TURN_SKIPPED',
  TURN_ORDER_SET: 'TURN_ORDER_SET',

  // NPCs
  NPC_CREATED: 'NPC_CREATED',
  NPC_UPDATED: 'NPC_UPDATED',
  NPC_DELETED: 'NPC_DELETED',
  NPC_ACTION: 'NPC_ACTION',

  // Characters
  CHARACTER_UPDATED: 'CHARACTER_UPDATED',

  // Notes
  NOTE_CREATED: 'NOTE_CREATED',
  NOTE_UPDATED: 'NOTE_UPDATED',
  NOTE_DELETED: 'NOTE_DELETED',

  // Player connectivity
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',

  // Generic game action (legacy/custom)
  GAME_ACTION: 'GAME_ACTION',
} as const;

export type GameEventTypeValue = (typeof GameEventType)[keyof typeof GameEventType];
