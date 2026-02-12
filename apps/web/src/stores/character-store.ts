import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { CharacterUpdatedPayload } from '@dsvtt/events';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CharacterStat {
  key: string;
  value: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
}

export interface Character {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  stats: CharacterStat[];
  notes: string;
  inventory: InventoryItem[];
  createdAt: string;
  updatedAt: string;
}

interface CreateCharacterInput {
  sessionId: string;
  name: string;
  stats?: CharacterStat[];
  notes?: string;
  inventory?: InventoryItem[];
}

interface UpdateCharacterInput {
  name?: string;
  stats?: CharacterStat[];
  notes?: string;
  inventory?: InventoryItem[];
}

// ─── State interface ────────────────────────────────────────────────────────

interface CharacterState {
  /** All characters for the current session. */
  characters: Character[];
  /** The current player's character. */
  myCharacter: Character | null;
  /** Loading flag. */
  loading: boolean;
  /** Error message. */
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Fetch all characters for a session. */
  fetchCharacters: (sessionId: string) => Promise<void>;

  /** Create a new character. */
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;

  /** Update an existing character. */
  updateCharacter: (characterId: string, changes: UpdateCharacterInput) => Promise<void>;

  /** Delete a character. */
  deleteCharacter: (characterId: string) => Promise<void>;

  /** Set the current player's character. */
  setMyCharacter: (character: Character | null) => void;

  /** Clear all character state. */
  clearCharacters: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useCharacterStore = create<CharacterState>()((set, get) => ({
  characters: [],
  myCharacter: null,
  loading: false,
  error: null,

  async fetchCharacters(sessionId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: Character[] }>(
        `/api/sessions/${sessionId}/characters`,
      );
      set({ characters: res.data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch characters',
        loading: false,
      });
    }
  },

  async createCharacter(input: CreateCharacterInput) {
    set({ error: null });
    try {
      const res = await apiClient.post<{ ok: boolean; data: Character }>(
        `/api/sessions/${input.sessionId}/characters`,
        input,
      );
      const character = res.data;
      set((state) => ({
        characters: [...state.characters, character],
        myCharacter: character,
      }));
      return character;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create character';
      set({ error: message });
      throw err;
    }
  },

  async updateCharacter(characterId: string, changes: UpdateCharacterInput) {
    set({ error: null });

    // Optimistic update
    set((state) => {
      const updater = (c: Character) => (c.id === characterId ? { ...c, ...changes } : c);
      return {
        characters: state.characters.map(updater),
        myCharacter:
          state.myCharacter?.id === characterId
            ? { ...state.myCharacter, ...changes }
            : state.myCharacter,
      };
    });

    try {
      const res = await apiClient.patch<{ ok: boolean; data: Character }>(
        `/api/characters/${characterId}`,
        changes,
      );
      const updated = res.data;

      // Broadcast update via Socket.IO
      const { myCharacter } = get();
      if (myCharacter?.id === characterId) {
        const socket = getSocket();
        socket.emit('CHARACTER_UPDATE', {
          sessionId: myCharacter.sessionId,
          characterId,
          changes: changes as Record<string, unknown>,
        });
      }

      set((state) => ({
        characters: state.characters.map((c) => (c.id === characterId ? updated : c)),
        myCharacter: state.myCharacter?.id === characterId ? updated : state.myCharacter,
      }));
    } catch (err) {
      // Revert optimistic update by re-fetching
      set({
        error: err instanceof Error ? err.message : 'Failed to update character',
      });
    }
  },

  async deleteCharacter(characterId: string) {
    set({ error: null });
    try {
      await apiClient.delete(`/api/characters/${characterId}`);
      set((state) => ({
        characters: state.characters.filter((c) => c.id !== characterId),
        myCharacter: state.myCharacter?.id === characterId ? null : state.myCharacter,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete character',
      });
    }
  },

  setMyCharacter(character: Character | null) {
    set({ myCharacter: character });
  },

  clearCharacters() {
    set({
      characters: [],
      myCharacter: null,
      loading: false,
      error: null,
    });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleCharacterUpdated = (payload: CharacterUpdatedPayload) => {
      const { characterId, changes } = payload;

      set((state) => ({
        characters: state.characters.map((c) => (c.id === characterId ? { ...c, ...changes } : c)),
        myCharacter:
          state.myCharacter?.id === characterId
            ? { ...state.myCharacter, ...(changes as Partial<Character>) }
            : state.myCharacter,
      }));
    };

    socket.on('CHARACTER_UPDATED', handleCharacterUpdated);

    return () => {
      socket.off('CHARACTER_UPDATED', handleCharacterUpdated);
    };
  },
}));
