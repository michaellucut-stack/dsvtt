import { create } from 'zustand';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { DiceResultPayload } from '@dsvtt/events';
import type { SingleDie } from '@dsvtt/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiceRollEntry {
  id: string;
  playerId: string;
  playerName: string;
  formula: string;
  results: SingleDie[];
  total: number;
  isPrivate: boolean;
  timestamp: string;
}

const MAX_HISTORY = 50;

// ─── State interface ────────────────────────────────────────────────────────

interface DiceState {
  /** Last 50 dice rolls, most recent first. */
  rollHistory: DiceRollEntry[];
  /** Whether a roll animation is in progress. */
  isRolling: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Roll dice with the given formula. Emits via Socket.IO. */
  roll: (sessionId: string, formula: string, isPrivate: boolean) => void;

  /** Fetch roll history from the server for a session (REST). */
  fetchHistory: (sessionId: string) => Promise<void>;

  /** Add a roll entry to history (used by socket listener). */
  addRoll: (entry: DiceRollEntry) => void;

  /** Clear roll history. */
  clearHistory: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useDiceStore = create<DiceState>()((set, get) => ({
  rollHistory: [],
  isRolling: false,

  roll(sessionId: string, formula: string, isPrivate: boolean) {
    if (!sessionId) return; // Guard: sessionId not yet loaded

    const socket = getSocket();
    if (!socket.connected) return; // Guard: socket not connected

    set({ isRolling: true });

    const event = isPrivate ? 'DICE_ROLL_PRIVATE' : 'DICE_ROLL';
    socket.emit(event, { sessionId, formula });

    // Auto-clear rolling state after a short animation period.
    // The actual result will arrive via the DICE_RESULT socket event.
    setTimeout(() => {
      set({ isRolling: false });
    }, 800);
  },

  async fetchHistory(_sessionId: string) {
    // REST endpoint for history — not yet implemented on server,
    // so this is a no-op placeholder that keeps the store ready.
    // When backend is ready: apiClient.get(`/api/sessions/${sessionId}/dice`)
  },

  addRoll(entry: DiceRollEntry) {
    set((state) => ({
      rollHistory: [entry, ...state.rollHistory].slice(0, MAX_HISTORY),
    }));
  },

  clearHistory() {
    set({ rollHistory: [] });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleDiceResult = (payload: DiceResultPayload) => {
      const entry: DiceRollEntry = {
        id: payload.rollId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        formula: payload.formula,
        results: payload.results,
        total: payload.total,
        isPrivate: false,
        timestamp: new Date().toISOString(),
      };
      get().addRoll(entry);
      set({ isRolling: false });
    };

    const handleDiceResultPrivate = (payload: DiceResultPayload) => {
      const entry: DiceRollEntry = {
        id: payload.rollId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        formula: payload.formula,
        results: payload.results,
        total: payload.total,
        isPrivate: true,
        timestamp: new Date().toISOString(),
      };
      get().addRoll(entry);
      set({ isRolling: false });
    };

    socket.on('DICE_RESULT', handleDiceResult);
    socket.on('DICE_RESULT_PRIVATE', handleDiceResultPrivate);

    return () => {
      socket.off('DICE_RESULT', handleDiceResult);
      socket.off('DICE_RESULT_PRIVATE', handleDiceResultPrivate);
    };
  },
}));
