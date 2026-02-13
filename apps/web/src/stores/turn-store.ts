import { create } from 'zustand';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { TurnChangedPayload, TurnOrderUpdatedPayload } from '@dsvtt/events';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TurnEntry {
  id: string;
  name: string;
  initiative: number;
  isNpc: boolean;
}

// ─── State interface ────────────────────────────────────────────────────────

interface TurnState {
  /** Ordered list of combatants sorted by initiative (descending). */
  turnOrder: TurnEntry[];
  /** Index into turnOrder for the currently active combatant. */
  currentTurnIndex: number;
  /** Current round number. */
  roundNumber: number;
  /** Whether combat/turn tracking is active. */
  isActive: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Replace the entire turn order (e.g., after rolling initiative). */
  setOrder: (entries: TurnEntry[]) => void;

  /** Advance to the next turn. Director-only action. */
  nextTurn: (sessionId: string) => void;

  /** Skip the current turn. Director-only action. */
  skipTurn: (sessionId: string, targetUserId: string) => void;

  /** Clear turn order (e.g., when combat ends). */
  clearTurns: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useTurnStore = create<TurnState>()((set, get) => ({
  turnOrder: [],
  currentTurnIndex: 0,
  roundNumber: 1,
  isActive: false,

  setOrder(entries: TurnEntry[]) {
    set({
      turnOrder: entries,
      currentTurnIndex: 0,
      isActive: entries.length > 0,
    });
  },

  nextTurn(sessionId: string) {
    const socket = getSocket();
    socket.emit('TURN_END', { sessionId });
  },

  skipTurn(sessionId: string, targetUserId: string) {
    const socket = getSocket();
    socket.emit('TURN_SKIP', { sessionId, targetUserId });
  },

  clearTurns() {
    set({
      turnOrder: [],
      currentTurnIndex: 0,
      roundNumber: 1,
      isActive: false,
    });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleTurnOrderUpdated = (payload: TurnOrderUpdatedPayload) => {
      const entries: TurnEntry[] = payload.order.map((o) => ({
        id: o.userId,
        name: o.name ?? o.userId,
        initiative: o.initiative,
        isNpc: o.isNpc ?? false,
      }));

      set({
        turnOrder: entries,
        roundNumber: payload.roundNumber,
        currentTurnIndex: 0,
        isActive: entries.length > 0,
      });
    };

    const handleTurnChanged = (payload: TurnChangedPayload) => {
      const { turnOrder } = get();
      const idx = turnOrder.findIndex((e) => e.id === payload.currentPlayerId);

      set({
        currentTurnIndex: idx >= 0 ? idx : 0,
        roundNumber: payload.roundNumber,
      });
    };

    socket.on('TURN_ORDER_UPDATED', handleTurnOrderUpdated);
    socket.on('TURN_CHANGED', handleTurnChanged);

    return () => {
      socket.off('TURN_ORDER_UPDATED', handleTurnOrderUpdated);
      socket.off('TURN_CHANGED', handleTurnChanged);
    };
  },
}));
