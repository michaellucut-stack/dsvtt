import type {
  ChatMessageBroadcastPayload,
  ChatWhisperReceivedPayload,
  CharacterUpdatedPayload,
  DiceResultPayload,
  FogCreatedPayload,
  FogUpdatedPayload,
  GamePausedPayload,
  GameStartedPayload,
  GameStateUpdatePayload,
  MapLoadedPayload,
  MapUpdatedPayload,
  NpcActionBroadcastPayload,
  NpcCreatedPayload,
  NpcUpdatedPayload,
  NpcDeletedPayload,
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NoteDeletedPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomLeftPayload,
  TokenAddedPayload,
  TokenMovedPayload,
  TokenRemovedPayload,
  TurnChangedPayload,
  TurnOrderUpdatedPayload,
} from './event-types.js';

/**
 * Typed event map for server-to-client Socket.IO events.
 *
 * Use with `Socket<ServerToClientEvents, ClientToServerEvents>` on the client
 * and `Server<ClientToServerEvents, ServerToClientEvents>` on the server.
 */
export interface ServerToClientEvents {
  // Room events
  ROOM_CREATED: (payload: RoomCreatedPayload) => void;
  ROOM_JOINED: (payload: RoomJoinedPayload) => void;
  ROOM_LEFT: (payload: RoomLeftPayload) => void;

  // Game lifecycle events
  GAME_STARTED: (payload: GameStartedPayload) => void;
  GAME_PAUSED: (payload: GamePausedPayload) => void;
  GAME_STATE_UPDATE: (payload: GameStateUpdatePayload) => void;

  // Token events
  TOKEN_MOVED: (payload: TokenMovedPayload) => void;
  TOKEN_ADDED: (payload: TokenAddedPayload) => void;
  TOKEN_REMOVED: (payload: TokenRemovedPayload) => void;

  // Dice events
  DICE_RESULT: (payload: DiceResultPayload) => void;
  DICE_RESULT_PRIVATE: (payload: DiceResultPayload) => void;

  // Chat events
  CHAT_MESSAGE_BROADCAST: (payload: ChatMessageBroadcastPayload) => void;
  CHAT_WHISPER_RECEIVED: (payload: ChatWhisperReceivedPayload) => void;

  // Turn events
  TURN_CHANGED: (payload: TurnChangedPayload) => void;
  TURN_ORDER_UPDATED: (payload: TurnOrderUpdatedPayload) => void;

  // Fog of war events
  FOG_CREATED: (payload: FogCreatedPayload) => void;
  FOG_UPDATED: (payload: FogUpdatedPayload) => void;

  // NPC events
  NPC_ACTION_BROADCAST: (payload: NpcActionBroadcastPayload) => void;
  NPC_CREATED: (payload: NpcCreatedPayload) => void;
  NPC_UPDATED: (payload: NpcUpdatedPayload) => void;
  NPC_DELETED: (payload: NpcDeletedPayload) => void;

  // Shared note events
  NOTE_CREATED: (payload: NoteCreatedPayload) => void;
  NOTE_UPDATED: (payload: NoteUpdatedPayload) => void;
  NOTE_DELETED: (payload: NoteDeletedPayload) => void;

  // Map events
  MAP_LOADED: (payload: MapLoadedPayload) => void;
  MAP_UPDATED: (payload: MapUpdatedPayload) => void;

  // Character events
  CHARACTER_UPDATED: (payload: CharacterUpdatedPayload) => void;
}
