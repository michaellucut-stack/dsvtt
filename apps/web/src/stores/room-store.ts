import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { RoomStatus } from '@dsvtt/shared';

// ─── API response types ────────────────────────────────────────────────────

export interface RoomPlayer {
  userId: string;
  displayName: string;
  role: 'director' | 'player';
  joinedAt: string;
}

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  directorId: string;
  directorName?: string;
  maxPlayers: number;
  playerCount?: number;
  players?: RoomPlayer[];
  createdAt: string;
  updatedAt: string;
}

interface CreateRoomInput {
  name: string;
  maxPlayers: number;
}

interface SessionItem {
  id: string;
  roomId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
}

interface RoomState {
  /** List of rooms for the lobby view. */
  rooms: Room[];
  /** Currently viewed / joined room. */
  currentRoom: Room | null;
  /** Active session ID for the current room. */
  activeSessionId: string | null;
  /** Loading flag for room list. */
  loading: boolean;
  /** Error message. */
  error: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  fetchRooms: () => Promise<void>;
  fetchRoom: (roomId: string) => Promise<void>;
  createRoom: (input: CreateRoomInput) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  startGame: (roomId: string, mapFile?: File) => Promise<void>;
  /** Fetch the active session for a room. */
  fetchActiveSession: (roomId: string) => Promise<string | null>;
  clearCurrentRoom: () => void;
  clearError: () => void;

  /** End the active session (director only). */
  endSession: () => Promise<void>;

  /** Wire up Socket.IO listeners for real-time updates. Call once after connecting. */
  subscribeToSocket: () => () => void;
}

export const useRoomStore = create<RoomState>()((set, get) => ({
  rooms: [],
  currentRoom: null,
  activeSessionId: null,
  loading: false,
  error: null,

  async fetchRooms() {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: { rooms: Room[] } }>('/api/rooms');
      set({ rooms: res.data.rooms, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch rooms',
        loading: false,
      });
    }
  },

  async fetchRoom(roomId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: Room }>(`/api/rooms/${roomId}`);
      set({ currentRoom: res.data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch room',
        loading: false,
      });
    }
  },

  async createRoom(input: CreateRoomInput) {
    set({ error: null });
    try {
      const res = await apiClient.post<{ ok: boolean; data: Room }>('/api/rooms', input);
      const room = res.data;
      set((state) => ({ rooms: [room, ...state.rooms] }));
      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      set({ error: message });
      throw err;
    }
  },

  async joinRoom(roomId: string) {
    set({ error: null });
    try {
      const res = await apiClient.post<{ ok: boolean; data: Room }>(`/api/rooms/${roomId}/join`);
      set({ currentRoom: res.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      set({ error: message });
      throw err;
    }
  },

  async leaveRoom(roomId: string) {
    set({ error: null });
    try {
      await apiClient.post(`/api/rooms/${roomId}/leave`);
      set({ currentRoom: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave room';
      set({ error: message });
      throw err;
    }
  },

  async startGame(roomId: string, mapFile?: File) {
    set({ loading: true, error: null });
    try {
      // 1. Create the session
      const sessionRes = await apiClient.post<{
        ok: boolean;
        data: { id: string };
      }>(`/api/rooms/${roomId}/sessions`);
      const sessionId = sessionRes.data.id;

      // 2. If a map file was provided, create a map and upload the background
      if (mapFile) {
        const mapRes = await apiClient.post<{
          ok: boolean;
          data: { id: string };
        }>(`/api/sessions/${sessionId}/maps`, {
          name: 'Battle Map',
          gridWidth: 20,
          gridHeight: 15,
        });
        await apiClient.upload(`/api/maps/${mapRes.data.id}/upload`, mapFile);
      }

      // Store the session ID and optimistically update room status
      set({ activeSessionId: sessionId });
      const currentRoom = get().currentRoom;
      if (currentRoom?.id === roomId) {
        set({ currentRoom: { ...currentRoom, status: 'ACTIVE' as RoomStatus } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  async fetchActiveSession(roomId: string) {
    try {
      const res = await apiClient.get<{ ok: boolean; data: SessionItem[] }>(
        `/api/rooms/${roomId}/sessions`,
      );
      const active = res.data.find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
      const sessionId = active?.id ?? null;
      set({ activeSessionId: sessionId });
      return sessionId;
    } catch {
      return null;
    }
  },

  async endSession() {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    set({ error: null });
    try {
      await apiClient.patch(`/api/sessions/${sessionId}/status`, { status: 'ENDED' });
      set({ activeSessionId: null });
      // Update room status back to WAITING
      const currentRoom = get().currentRoom;
      if (currentRoom) {
        set({ currentRoom: { ...currentRoom, status: 'WAITING' as RoomStatus } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end session';
      set({ error: message });
      throw err;
    }
  },

  clearCurrentRoom() {
    set({ currentRoom: null, activeSessionId: null });
  },

  clearError() {
    set({ error: null });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleRoomCreated = (payload: {
      roomId: string;
      name: string;
      directorId: string;
      maxPlayers: number;
    }) => {
      const newRoom: Room = {
        id: payload.roomId,
        name: payload.name,
        status: 'WAITING' as RoomStatus,
        directorId: payload.directorId,
        maxPlayers: payload.maxPlayers,
        playerCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => {
        // Avoid duplicates
        if (state.rooms.some((r) => r.id === newRoom.id)) return state;
        return { rooms: [newRoom, ...state.rooms] };
      });
    };

    const handleRoomJoined = (payload: {
      roomId: string;
      userId: string;
      displayName: string;
      role: 'director' | 'player';
    }) => {
      // Update lobby list player count
      set((state) => ({
        rooms: state.rooms.map((r) =>
          r.id === payload.roomId ? { ...r, playerCount: (r.playerCount ?? 0) + 1 } : r,
        ),
      }));

      // Update current room players
      const currentRoom = get().currentRoom;
      if (currentRoom?.id === payload.roomId) {
        const player: RoomPlayer = {
          userId: payload.userId,
          displayName: payload.displayName,
          role: payload.role,
          joinedAt: new Date().toISOString(),
        };
        const players = currentRoom.players ?? [];
        if (!players.some((p) => p.userId === payload.userId)) {
          set({
            currentRoom: {
              ...currentRoom,
              players: [...players, player],
              playerCount: (currentRoom.playerCount ?? players.length) + 1,
            },
          });
        }
      }
    };

    const handleRoomLeft = (payload: { roomId: string; userId: string }) => {
      // Update lobby list player count
      set((state) => ({
        rooms: state.rooms.map((r) =>
          r.id === payload.roomId
            ? {
                ...r,
                playerCount: Math.max(0, (r.playerCount ?? 1) - 1),
              }
            : r,
        ),
      }));

      // Update current room players
      const currentRoom = get().currentRoom;
      if (currentRoom?.id === payload.roomId) {
        const players = (currentRoom.players ?? []).filter((p) => p.userId !== payload.userId);
        set({
          currentRoom: {
            ...currentRoom,
            players,
            playerCount: players.length,
          },
        });
      }
    };

    const handleGameStarted = (payload: {
      sessionId: string;
      roomId: string;
      status: RoomStatus;
    }) => {
      // Update lobby room status
      set((state) => ({
        rooms: state.rooms.map((r) =>
          r.id === payload.roomId ? { ...r, status: payload.status } : r,
        ),
      }));

      // Update current room status and store the session ID
      const currentRoom = get().currentRoom;
      if (currentRoom?.id === payload.roomId) {
        set({
          currentRoom: { ...currentRoom, status: payload.status },
          activeSessionId: payload.sessionId,
        });
      }
    };

    socket.on('ROOM_CREATED', handleRoomCreated);
    socket.on('ROOM_JOINED', handleRoomJoined);
    socket.on('ROOM_LEFT', handleRoomLeft);
    socket.on('GAME_STARTED', handleGameStarted);

    // Return cleanup function
    return () => {
      socket.off('ROOM_CREATED', handleRoomCreated);
      socket.off('ROOM_JOINED', handleRoomJoined);
      socket.off('ROOM_LEFT', handleRoomLeft);
      socket.off('GAME_STARTED', handleGameStarted);
    };
  },
}));
