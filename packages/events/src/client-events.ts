import type {
  ChatMessagePayload,
  ChatWhisperPayload,
  CharacterUpdatePayload,
  DiceRollPayload,
  FogCreatePayload,
  FogUpdatePayload,
  GameActionPayload,
  GamePausePayload,
  GameStartPayload,
  MapLoadPayload,
  MapUpdatePayload,
  NpcActionPayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomLeavePayload,
  TokenAddPayload,
  TokenMovePayload,
  TokenRemovePayload,
  TurnEndPayload,
  TurnSkipPayload,
} from './event-types.js';

/**
 * Typed event map for client-to-server Socket.IO events.
 *
 * Use with `Socket<ServerToClientEvents, ClientToServerEvents>` on the client
 * and `Server<ClientToServerEvents, ServerToClientEvents>` on the server.
 */
export interface ClientToServerEvents {
  // Room events
  ROOM_CREATE: (
    payload: RoomCreatePayload,
    callback: (ack: { ok: boolean; roomId?: string; error?: string }) => void,
  ) => void;
  ROOM_JOIN: (
    payload: RoomJoinPayload,
    callback: (ack: { ok: boolean; error?: string }) => void,
  ) => void;
  ROOM_LEAVE: (payload: RoomLeavePayload) => void;

  // Game lifecycle events
  GAME_START: (
    payload: GameStartPayload,
    callback: (ack: { ok: boolean; sessionId?: string; error?: string }) => void,
  ) => void;
  GAME_PAUSE: (payload: GamePausePayload) => void;
  GAME_ACTION: (payload: GameActionPayload) => void;

  // Token events
  TOKEN_MOVE: (payload: TokenMovePayload) => void;
  TOKEN_ADD: (
    payload: TokenAddPayload,
    callback: (ack: { ok: boolean; tokenId?: string; error?: string }) => void,
  ) => void;
  TOKEN_REMOVE: (payload: TokenRemovePayload) => void;

  // Dice events
  DICE_ROLL: (payload: DiceRollPayload) => void;
  DICE_ROLL_PRIVATE: (payload: DiceRollPayload) => void;

  // Chat events
  CHAT_MESSAGE: (payload: ChatMessagePayload) => void;
  CHAT_WHISPER: (payload: ChatWhisperPayload) => void;

  // Turn events
  TURN_END: (payload: TurnEndPayload) => void;
  TURN_SKIP: (payload: TurnSkipPayload) => void;

  // Fog of war events
  FOG_CREATE: (
    payload: FogCreatePayload,
    callback: (ack: { ok: boolean; regionId?: string; error?: string }) => void,
  ) => void;
  FOG_UPDATE: (payload: FogUpdatePayload) => void;

  // NPC events
  NPC_ACTION: (payload: NpcActionPayload) => void;

  // Map events
  MAP_LOAD: (payload: MapLoadPayload) => void;
  MAP_UPDATE: (payload: MapUpdatePayload) => void;

  // Character events
  CHARACTER_UPDATE: (payload: CharacterUpdatePayload) => void;
}
