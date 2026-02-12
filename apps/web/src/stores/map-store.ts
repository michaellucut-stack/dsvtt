import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { Token, FogRegion, TokenLayer } from '@dsvtt/shared';
import type {
  TokenMovedPayload,
  TokenAddedPayload,
  TokenRemovedPayload,
  FogUpdatedPayload,
  MapLoadedPayload,
  MapUpdatedPayload,
} from '@dsvtt/events';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MapTool = 'select' | 'move' | 'fog' | 'measure';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface MapData {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  backgroundUrl: string | null;
}

// ─── State interface ────────────────────────────────────────────────────────

interface MapState {
  /** Currently loaded map metadata. */
  currentMap: MapData | null;
  /** All tokens on the current map. */
  tokens: Token[];
  /** Fog-of-war regions on the current map. */
  fogRegions: FogRegion[];
  /** Currently selected token ID. */
  selectedTokenId: string | null;
  /** Active tool in the toolbar. */
  tool: MapTool;
  /** Pan/zoom viewport state. */
  viewport: Viewport;
  /** Whether the grid overlay is visible. */
  gridVisible: boolean;
  /** Loading flag. */
  loading: boolean;
  /** Error message. */
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────

  /** Fetch the full map state (map data, tokens, fog) from the API. */
  fetchMapState: (mapId: string) => Promise<void>;

  /** Optimistically move a token and emit via Socket.IO. */
  moveToken: (tokenId: string, x: number, y: number) => void;

  /** Add a token via Socket.IO. */
  addToken: (data: {
    mapId: string;
    name: string;
    imageUrl: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    layer: TokenLayer;
    visible: boolean;
  }) => void;

  /** Remove a token via Socket.IO. */
  removeToken: (tokenId: string) => void;

  /** Update a fog region's revealed state via Socket.IO. */
  updateFog: (regionId: string, revealed: boolean) => void;

  /** Set the currently selected token. */
  setSelectedToken: (tokenId: string | null) => void;

  /** Set the active tool. */
  setTool: (tool: MapTool) => void;

  /** Set the viewport (pan/zoom). */
  setViewport: (viewport: Partial<Viewport>) => void;

  /** Toggle grid visibility. */
  toggleGrid: () => void;

  /** Fetch the first map for a session and load its state. */
  fetchSessionMap: (sessionId: string) => Promise<void>;

  /** Clear the current map state. */
  clearMap: () => void;

  /** Wire up Socket.IO listeners for real-time map updates. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── API response shapes ────────────────────────────────────────────────────

/** Server returns a flat object with map fields at top level alongside tokens/fogRegions. */
interface MapStateResponse {
  id: string;
  sessionId: string;
  name: string;
  backgroundUrl: string | null;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  createdAt: string;
  tokens: Token[];
  fogRegions: FogRegion[];
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useMapStore = create<MapState>()((set, get) => ({
  currentMap: null,
  tokens: [],
  fogRegions: [],
  selectedTokenId: null,
  tool: 'select',
  viewport: { x: 0, y: 0, scale: 1 },
  gridVisible: true,
  loading: false,
  error: null,

  async fetchMapState(mapId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{ ok: boolean; data: MapStateResponse }>(
        `/api/maps/${mapId}/state`,
      );
      const data = res.data;
      set({
        currentMap: {
          id: data.id,
          name: data.name,
          gridWidth: data.gridWidth,
          gridHeight: data.gridHeight,
          gridSize: data.gridSize,
          backgroundUrl: data.backgroundUrl,
        },
        tokens: data.tokens ?? [],
        fogRegions: data.fogRegions ?? [],
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch map state',
        loading: false,
      });
    }
  },

  async fetchSessionMap(sessionId: string) {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<{
        ok: boolean;
        data: Array<{ id: string }>;
      }>(`/api/sessions/${sessionId}/maps`);
      const maps = res.data;
      if (maps.length > 0 && maps[0]) {
        // Load the first map's full state
        await get().fetchMapState(maps[0].id);
      } else {
        set({ currentMap: null, tokens: [], fogRegions: [], loading: false });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch maps',
        loading: false,
      });
    }
  },

  moveToken(tokenId: string, x: number, y: number) {
    const { currentMap, tokens } = get();
    if (!currentMap) return;

    // Optimistic update
    set({
      tokens: tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
    });

    // Emit via Socket.IO
    const socket = getSocket();
    socket.emit('TOKEN_MOVE', {
      tokenId,
      mapId: currentMap.id,
      x,
      y,
    });
  },

  addToken(data) {
    const socket = getSocket();
    socket.emit('TOKEN_ADD', data, (ack) => {
      if (!ack.ok) {
        set({ error: ack.error ?? 'Failed to add token' });
      }
    });
  },

  removeToken(tokenId: string) {
    const { currentMap, tokens } = get();
    if (!currentMap) return;

    // Optimistic removal
    set({ tokens: tokens.filter((t) => t.id !== tokenId) });

    const socket = getSocket();
    socket.emit('TOKEN_REMOVE', { tokenId, mapId: currentMap.id });
  },

  updateFog(regionId: string, revealed: boolean) {
    const { currentMap, fogRegions } = get();
    if (!currentMap) return;

    // Optimistic update
    set({
      fogRegions: fogRegions.map((r) => (r.id === regionId ? { ...r, revealed } : r)),
    });

    const socket = getSocket();
    socket.emit('FOG_UPDATE', {
      mapId: currentMap.id,
      regionId,
      revealed,
    });
  },

  setSelectedToken(tokenId: string | null) {
    set({ selectedTokenId: tokenId });
  },

  setTool(tool: MapTool) {
    set({ tool });
  },

  setViewport(partial: Partial<Viewport>) {
    set((state) => ({
      viewport: { ...state.viewport, ...partial },
    }));
  },

  toggleGrid() {
    set((state) => ({ gridVisible: !state.gridVisible }));
  },

  clearMap() {
    set({
      currentMap: null,
      tokens: [],
      fogRegions: [],
      selectedTokenId: null,
      tool: 'select',
      viewport: { x: 0, y: 0, scale: 1 },
      loading: false,
      error: null,
    });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleTokenMoved = (payload: TokenMovedPayload) => {
      set((state) => ({
        tokens: state.tokens.map((t) =>
          t.id === payload.tokenId ? { ...t, x: payload.x, y: payload.y } : t,
        ),
      }));
    };

    const handleTokenAdded = (payload: TokenAddedPayload) => {
      const newToken: Token = {
        id: payload.tokenId,
        mapId: payload.mapId,
        ownerId: payload.ownerId,
        name: payload.name,
        imageUrl: payload.imageUrl,
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
        layer: payload.layer,
        visible: payload.visible,
      };
      set((state) => {
        // Avoid duplicates
        if (state.tokens.some((t) => t.id === newToken.id)) return state;
        return { tokens: [...state.tokens, newToken] };
      });
    };

    const handleTokenRemoved = (payload: TokenRemovedPayload) => {
      set((state) => ({
        tokens: state.tokens.filter((t) => t.id !== payload.tokenId),
      }));
    };

    const handleFogUpdated = (payload: FogUpdatedPayload) => {
      set((state) => ({
        fogRegions: state.fogRegions.map((r) =>
          r.id === payload.regionId ? { ...r, revealed: payload.revealed } : r,
        ),
      }));
    };

    const handleMapLoaded = (payload: MapLoadedPayload) => {
      set({
        currentMap: {
          id: payload.mapId,
          name: payload.name,
          gridWidth: payload.gridWidth,
          gridHeight: payload.gridHeight,
          gridSize: payload.gridSize,
          backgroundUrl: payload.backgroundUrl,
        },
      });
    };

    const handleMapUpdated = (payload: MapUpdatedPayload) => {
      set((state) => {
        if (!state.currentMap || state.currentMap.id !== payload.mapId) {
          return state;
        }
        return {
          currentMap: {
            ...state.currentMap,
            ...(payload.changes as Partial<MapData>),
          },
        };
      });
    };

    socket.on('TOKEN_MOVED', handleTokenMoved);
    socket.on('TOKEN_ADDED', handleTokenAdded);
    socket.on('TOKEN_REMOVED', handleTokenRemoved);
    socket.on('FOG_UPDATED', handleFogUpdated);
    socket.on('MAP_LOADED', handleMapLoaded);
    socket.on('MAP_UPDATED', handleMapUpdated);

    return () => {
      socket.off('TOKEN_MOVED', handleTokenMoved);
      socket.off('TOKEN_ADDED', handleTokenAdded);
      socket.off('TOKEN_REMOVED', handleTokenRemoved);
      socket.off('FOG_UPDATED', handleFogUpdated);
      socket.off('MAP_LOADED', handleMapLoaded);
      socket.off('MAP_UPDATED', handleMapUpdated);
    };
  },
}));
