import { create } from 'zustand';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReplayEvent {
  id: string;
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
  actorId: string;
  actorType: string;
  timestamp: string;
}

interface ReplayState {
  sessionId: string | null;
  events: ReplayEvent[];
  totalEvents: number;
  currentIndex: number;

  isPlaying: boolean;
  playbackSpeed: number;

  gameState: Record<string, unknown> | null;

  loading: boolean;
  error: string | null;

  loadSession: (sessionId: string) => Promise<void>;
  loadMoreEvents: () => Promise<void>;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seekTo: (index: number) => Promise<void>;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
}

// ─── API response shapes ────────────────────────────────────────────────────

interface EventsResponse {
  ok: boolean;
  data: {
    events: ReplayEvent[];
    totalEvents: number;
    hasMore: boolean;
  };
}

interface StateResponse {
  ok: boolean;
  data: {
    state: Record<string, unknown>;
    sequenceNumber: number;
  };
}

// ─── Timer handle ───────────────────────────────────────────────────────────

let playbackTimer: ReturnType<typeof setInterval> | null = null;

function clearPlayback() {
  if (playbackTimer !== null) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useReplayStore = create<ReplayState>()((set, get) => ({
  sessionId: null,
  events: [],
  totalEvents: 0,
  currentIndex: -1,

  isPlaying: false,
  playbackSpeed: 1,

  gameState: null,

  loading: false,
  error: null,

  async loadSession(sessionId: string) {
    set({ loading: true, error: null, sessionId, events: [], currentIndex: -1, gameState: null });
    clearPlayback();

    try {
      const res = await apiClient.get<EventsResponse>(
        `/api/sessions/${sessionId}/replay/events?fromSequence=0&limit=1000`,
      );
      set({
        events: res.data.events,
        totalEvents: res.data.totalEvents,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load session',
        loading: false,
      });
    }
  },

  async loadMoreEvents() {
    const { sessionId, events } = get();
    if (!sessionId || events.length === 0) return;

    const lastSeq = events[events.length - 1]!.sequenceNumber;

    try {
      const res = await apiClient.get<EventsResponse>(
        `/api/sessions/${sessionId}/replay/events?fromSequence=${lastSeq}&limit=1000`,
      );
      set((state) => ({
        events: [...state.events, ...res.data.events],
        totalEvents: res.data.totalEvents,
      }));
    } catch {
      // Silently handle — events already loaded are still usable
    }
  },

  play() {
    const { events, isPlaying } = get();
    if (isPlaying || events.length === 0) return;

    set({ isPlaying: true });

    const tick = async () => {
      const state = get();
      if (!state.isPlaying) {
        clearPlayback();
        return;
      }

      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.events.length) {
        clearPlayback();
        set({ isPlaying: false });
        return;
      }

      await get().seekTo(nextIndex);
    };

    const delay = Math.max(100, 500 / get().playbackSpeed);
    playbackTimer = setInterval(tick, delay);
  },

  pause() {
    clearPlayback();
    set({ isPlaying: false });
  },

  setSpeed(speed: number) {
    const { isPlaying } = get();
    set({ playbackSpeed: speed });

    // Restart the timer with new speed if playing
    if (isPlaying) {
      clearPlayback();
      get().play();
    }
  },

  async seekTo(index: number) {
    const { sessionId, events } = get();
    if (!sessionId || index < 0 || index >= events.length) return;

    const event = events[index]!;
    set({ currentIndex: index });

    // Fetch reconstructed state at this point
    try {
      const res = await apiClient.get<StateResponse>(
        `/api/sessions/${sessionId}/replay/state?sequenceNumber=${event.sequenceNumber}`,
      );
      set({ gameState: res.data.state });
    } catch {
      // Keep the last known state
    }
  },

  stepForward() {
    const { currentIndex, events, isPlaying } = get();
    if (isPlaying) return;
    const nextIndex = Math.min(currentIndex + 1, events.length - 1);
    get().seekTo(nextIndex);
  },

  stepBackward() {
    const { currentIndex, isPlaying } = get();
    if (isPlaying) return;
    const prevIndex = Math.max(currentIndex - 1, 0);
    get().seekTo(prevIndex);
  },

  reset() {
    clearPlayback();
    set({
      sessionId: null,
      events: [],
      totalEvents: 0,
      currentIndex: -1,
      isPlaying: false,
      playbackSpeed: 1,
      gameState: null,
      loading: false,
      error: null,
    });
  },
}));
