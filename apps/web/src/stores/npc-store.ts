import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { NpcActionBroadcastPayload } from '@dsvtt/events';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NpcStat {
  key: string;
  value: string;
}

export interface Npc {
  id: string;
  sessionId: string;
  name: string;
  stats: NpcStat[];
  notes: string;
  tokenId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** API returns stats as Record<string, unknown>; convert to NpcStat[] for the UI. */
interface RawNpc extends Omit<Npc, 'stats'> {
  stats: Record<string, unknown> | NpcStat[];
}

function normalizeNpc(raw: RawNpc): Npc {
  let stats: NpcStat[];
  if (Array.isArray(raw.stats)) {
    stats = raw.stats;
  } else if (raw.stats && typeof raw.stats === 'object') {
    stats = Object.entries(raw.stats).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }));
  } else {
    stats = [];
  }
  return { ...raw, stats };
}

interface CreateNpcInput {
  sessionId: string;
  name: string;
  stats?: NpcStat[];
  notes?: string;
}

interface UpdateNpcInput {
  name?: string;
  stats?: NpcStat[];
  notes?: string;
}

// ─── State interface ────────────────────────────────────────────────────────

interface NpcState {
  /** All NPCs for the current session. */
  npcs: Npc[];
  /** Currently selected NPC for editing. */
  selectedNpc: Npc | null;
  /** Loading flag. */
  loading: boolean;
  /** Error message. */
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Fetch all NPCs for a session. */
  fetchNpcs: (sessionId: string) => Promise<void>;

  /** Create a new NPC. */
  createNpc: (input: CreateNpcInput) => Promise<Npc>;

  /** Update an existing NPC. */
  updateNpc: (npcId: string, changes: UpdateNpcInput) => Promise<void>;

  /** Delete an NPC. */
  deleteNpc: (npcId: string) => Promise<void>;

  /** Assign a token to an NPC. */
  assignToken: (npcId: string, tokenId: string | null) => Promise<void>;

  /** Set the selected NPC. */
  setSelectedNpc: (npc: Npc | null) => void;

  /** Clear all NPC state. */
  clearNpcs: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNpcStore = create<NpcState>()((set, get) => ({
  npcs: [],
  selectedNpc: null,
  loading: false,
  error: null,

  async fetchNpcs(sessionId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: RawNpc[] }>(
        `/api/sessions/${sessionId}/npcs`,
      );
      set({ npcs: res.data.map(normalizeNpc), loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch NPCs',
        loading: false,
      });
    }
  },

  async createNpc(input: CreateNpcInput) {
    set({ error: null });
    try {
      // Convert stats array to Record<string, string> for the API
      const statsRecord: Record<string, string> = {};
      if (input.stats) {
        for (const s of input.stats) {
          if (s.key.trim()) {
            statsRecord[s.key.trim()] = s.value;
          }
        }
      }
      const res = await apiClient.post<{ ok: boolean; data: RawNpc }>(
        `/api/sessions/${input.sessionId}/npcs`,
        { name: input.name, stats: statsRecord, notes: input.notes },
      );
      const npc = normalizeNpc(res.data);
      set((state) => ({ npcs: [...state.npcs, npc] }));
      return npc;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create NPC';
      set({ error: message });
      throw err;
    }
  },

  async updateNpc(npcId: string, changes: UpdateNpcInput) {
    set({ error: null });
    try {
      // Convert stats array to Record if present
      const body: Record<string, unknown> = { ...changes };
      if (changes.stats) {
        const statsRecord: Record<string, string> = {};
        for (const s of changes.stats) {
          if (s.key.trim()) {
            statsRecord[s.key.trim()] = s.value;
          }
        }
        body.stats = statsRecord;
      }
      const res = await apiClient.patch<{ ok: boolean; data: RawNpc }>(`/api/npcs/${npcId}`, body);
      const updated = normalizeNpc(res.data);
      set((state) => ({
        npcs: state.npcs.map((n) => (n.id === npcId ? updated : n)),
        selectedNpc: state.selectedNpc?.id === npcId ? updated : state.selectedNpc,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update NPC',
      });
    }
  },

  async deleteNpc(npcId: string) {
    set({ error: null });
    try {
      await apiClient.delete(`/api/npcs/${npcId}`);
      set((state) => ({
        npcs: state.npcs.filter((n) => n.id !== npcId),
        selectedNpc: state.selectedNpc?.id === npcId ? null : state.selectedNpc,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete NPC',
      });
    }
  },

  async assignToken(npcId: string, tokenId: string | null) {
    set({ error: null });
    try {
      const res = await apiClient.patch<{ ok: boolean; data: RawNpc }>(`/api/npcs/${npcId}`, {
        tokenId,
      });
      const updated = normalizeNpc(res.data);
      set((state) => ({
        npcs: state.npcs.map((n) => (n.id === npcId ? updated : n)),
        selectedNpc: state.selectedNpc?.id === npcId ? updated : state.selectedNpc,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to assign token',
      });
    }
  },

  setSelectedNpc(npc: Npc | null) {
    set({ selectedNpc: npc });
  },

  clearNpcs() {
    set({
      npcs: [],
      selectedNpc: null,
      loading: false,
      error: null,
    });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleNpcAction = (payload: NpcActionBroadcastPayload) => {
      const { npcId, actionType, data } = payload;

      switch (actionType) {
        case 'NPC_CREATED': {
          const npc = data as unknown as Npc;
          set((state) => {
            if (state.npcs.some((n) => n.id === npc.id)) return state;
            return { npcs: [...state.npcs, npc] };
          });
          break;
        }
        case 'NPC_UPDATED': {
          const updates = data as unknown as Partial<Npc>;
          set((state) => ({
            npcs: state.npcs.map((n) => (n.id === npcId ? { ...n, ...updates } : n)),
            selectedNpc:
              state.selectedNpc?.id === npcId
                ? { ...state.selectedNpc, ...updates }
                : state.selectedNpc,
          }));
          break;
        }
        case 'NPC_DELETED': {
          set((state) => ({
            npcs: state.npcs.filter((n) => n.id !== npcId),
            selectedNpc: state.selectedNpc?.id === npcId ? null : state.selectedNpc,
          }));
          break;
        }
      }
    };

    socket.on('NPC_ACTION_BROADCAST', handleNpcAction);

    return () => {
      socket.off('NPC_ACTION_BROADCAST', handleNpcAction);
    };
  },
}));
