import type { PlayerRole } from './user.js';

/** Lifecycle status of a room. */
export type RoomStatus = 'waiting' | 'active' | 'paused' | 'ended';

/** A lobby room where players gather before and during a game session. */
export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  directorId: string;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A player's presence within a room. */
export interface RoomPlayer {
  userId: string;
  displayName: string;
  role: PlayerRole;
  joinedAt: Date;
}
