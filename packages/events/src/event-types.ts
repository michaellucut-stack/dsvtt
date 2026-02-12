import type { ChatChannel, PlayerRole, RoomStatus, TokenLayer } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Room event payloads
// ---------------------------------------------------------------------------

/** Payload for creating a new room. */
export interface RoomCreatePayload {
  name: string;
  maxPlayers: number;
}

/** Payload for joining an existing room. */
export interface RoomJoinPayload {
  roomId: string;
}

/** Payload for leaving a room. */
export interface RoomLeavePayload {
  roomId: string;
}

/** Server response when a room is created. */
export interface RoomCreatedPayload {
  roomId: string;
  name: string;
  directorId: string;
  maxPlayers: number;
}

/** Server response when a user joins a room. */
export interface RoomJoinedPayload {
  roomId: string;
  userId: string;
  displayName: string;
  role: PlayerRole;
}

/** Server response when a user leaves a room. */
export interface RoomLeftPayload {
  roomId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Game lifecycle event payloads
// ---------------------------------------------------------------------------

/** Payload for starting a game session. */
export interface GameStartPayload {
  roomId: string;
}

/** Payload for pausing a game session. */
export interface GamePausePayload {
  sessionId: string;
}

/** Payload for a generic game action. */
export interface GameActionPayload {
  sessionId: string;
  actionType: string;
  data: Record<string, unknown>;
}

/** Server broadcast when the game starts. */
export interface GameStartedPayload {
  sessionId: string;
  roomId: string;
  status: RoomStatus;
}

/** Server broadcast when the game is paused. */
export interface GamePausedPayload {
  sessionId: string;
}

/** Server broadcast of authoritative game state. */
export interface GameStateUpdatePayload {
  sessionId: string;
  state: Record<string, unknown>;
  sequenceNumber: number;
}

// ---------------------------------------------------------------------------
// Token event payloads
// ---------------------------------------------------------------------------

/** Payload for moving a token on the map. */
export interface TokenMovePayload {
  tokenId: string;
  mapId: string;
  x: number;
  y: number;
}

/** Payload for adding a new token to the map. */
export interface TokenAddPayload {
  mapId: string;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: TokenLayer;
  visible: boolean;
}

/** Payload for removing a token from the map. */
export interface TokenRemovePayload {
  tokenId: string;
  mapId: string;
}

/** Server broadcast when a token is moved. */
export interface TokenMovedPayload {
  tokenId: string;
  mapId: string;
  x: number;
  y: number;
  movedBy: string;
}

/** Server broadcast when a token is added. */
export interface TokenAddedPayload {
  tokenId: string;
  mapId: string;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: TokenLayer;
  visible: boolean;
  ownerId: string;
}

/** Server broadcast when a token is removed. */
export interface TokenRemovedPayload {
  tokenId: string;
  mapId: string;
  removedBy: string;
}

// ---------------------------------------------------------------------------
// Dice event payloads
// ---------------------------------------------------------------------------

/** Payload for rolling dice. */
export interface DiceRollPayload {
  sessionId: string;
  formula: string;
}

/** Server broadcast of a dice roll result. */
export interface DiceResultPayload {
  rollId: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  formula: string;
  results: { sides: number; result: number; dropped: boolean; exploded: boolean }[];
  total: number;
}

// ---------------------------------------------------------------------------
// Chat event payloads
// ---------------------------------------------------------------------------

/** Payload for sending a chat message. */
export interface ChatMessagePayload {
  sessionId: string;
  channel: ChatChannel;
  content: string;
}

/** Payload for sending a whisper. */
export interface ChatWhisperPayload {
  sessionId: string;
  recipientId: string;
  content: string;
}

/** Server broadcast of a chat message. */
export interface ChatMessageBroadcastPayload {
  messageId: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  content: string;
  timestamp: string;
}

/** Server delivery of a whisper. */
export interface ChatWhisperReceivedPayload {
  messageId: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Turn event payloads
// ---------------------------------------------------------------------------

/** Payload for ending the current turn. */
export interface TurnEndPayload {
  sessionId: string;
}

/** Payload for skipping a turn. */
export interface TurnSkipPayload {
  sessionId: string;
  targetUserId: string;
}

/** Server broadcast when the active turn changes. */
export interface TurnChangedPayload {
  sessionId: string;
  currentPlayerId: string;
  roundNumber: number;
}

/** Server broadcast when turn order is updated. */
export interface TurnOrderUpdatedPayload {
  sessionId: string;
  order: { userId: string; initiative: number }[];
  roundNumber: number;
}

// ---------------------------------------------------------------------------
// Fog of war event payloads
// ---------------------------------------------------------------------------

/** Client request to create a new fog region. */
export interface FogCreatePayload {
  mapId: string;
  name?: string;
  points: { x: number; y: number }[];
  revealed?: boolean;
}

/** Server broadcast when a fog region is created. */
export interface FogCreatedPayload {
  mapId: string;
  region: {
    id: string;
    mapId: string;
    name?: string;
    points: { x: number; y: number }[];
    revealed: boolean;
  };
  createdBy: string;
}

/** Payload for updating fog of war regions. */
export interface FogUpdatePayload {
  mapId: string;
  regionId: string;
  revealed: boolean;
}

/** Server broadcast when fog is updated. */
export interface FogUpdatedPayload {
  mapId: string;
  regionId: string;
  revealed: boolean;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// NPC event payloads
// ---------------------------------------------------------------------------

/** Payload for an NPC action initiated by the director. */
export interface NpcActionPayload {
  sessionId: string;
  npcId: string;
  actionType: string;
  data: Record<string, unknown>;
}

/** Server broadcast of an NPC action. */
export interface NpcActionBroadcastPayload {
  sessionId: string;
  npcId: string;
  npcName: string;
  actionType: string;
  data: Record<string, unknown>;
}

/** Server broadcast when an NPC is created. */
export interface NpcCreatedPayload {
  sessionId: string;
  npc: {
    id: string;
    name: string;
    stats: Record<string, unknown>;
    notes: string | null;
    tokenId: string | null;
  };
}

/** Server broadcast when an NPC is updated. */
export interface NpcUpdatedPayload {
  sessionId: string;
  npc: {
    id: string;
    name: string;
    stats: Record<string, unknown>;
    notes: string | null;
    tokenId: string | null;
  };
}

/** Server broadcast when an NPC is deleted. */
export interface NpcDeletedPayload {
  sessionId: string;
  npcId: string;
}

// ---------------------------------------------------------------------------
// Shared note event payloads
// ---------------------------------------------------------------------------

/** Server broadcast when a shared note is created. */
export interface NoteCreatedPayload {
  sessionId: string;
  note: {
    id: string;
    title: string;
    content: string;
    updatedBy: string | null;
    updatedAt: string;
  };
}

/** Server broadcast when a shared note is updated. */
export interface NoteUpdatedPayload {
  sessionId: string;
  note: {
    id: string;
    title: string;
    content: string;
    updatedBy: string | null;
    updatedAt: string;
  };
}

/** Server broadcast when a shared note is deleted. */
export interface NoteDeletedPayload {
  sessionId: string;
  noteId: string;
}

// ---------------------------------------------------------------------------
// Map event payloads
// ---------------------------------------------------------------------------

/** Payload for loading a map. */
export interface MapLoadPayload {
  sessionId: string;
  mapId: string;
}

/** Payload for updating map properties. */
export interface MapUpdatePayload {
  mapId: string;
  name?: string;
  backgroundUrl?: string | null;
  gridWidth?: number;
  gridHeight?: number;
  gridSize?: number;
}

/** Server broadcast when a map is loaded. */
export interface MapLoadedPayload {
  mapId: string;
  sessionId: string;
  name: string;
  backgroundUrl: string | null;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
}

/** Server broadcast when a map is updated. */
export interface MapUpdatedPayload {
  mapId: string;
  changes: Record<string, unknown>;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Character event payloads
// ---------------------------------------------------------------------------

/** Payload for updating character data. */
export interface CharacterUpdatePayload {
  sessionId: string;
  characterId: string;
  changes: Record<string, unknown>;
}

/** Server broadcast when a character is updated. */
export interface CharacterUpdatedPayload {
  sessionId: string;
  characterId: string;
  changes: Record<string, unknown>;
  updatedBy: string;
}
