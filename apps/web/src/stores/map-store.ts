import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type { Token, FogRegion, TokenLayer } from '@dsvtt/shared';
import type {
  TokenMovedPayload,
  TokenAddedPayload,
  TokenRemovedPayload,
  FogCreatedPayload,
  FogUpdatedPayload,
  MapLoadedPayload,
  MapUpdatedPayload,
} from '@dsvtt/events';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MapTool = 'select' | 'move' | 'fog' | 'fog-paint' | 'place-token' | 'measure';

/** Token context menu state. */
export interface TokenContextMenu {
  tokenId: string;
  /** Screen-space position of the menu. */
  x: number;
  y: number;
}

/** Token being moved via click-to-move (select token, click destination). */
export interface MovingToken {
  tokenId: string;
}

/** Pending token placement data (everything except coordinates, which the user clicks to set). */
export interface PendingTokenPlacement {
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  layer: TokenLayer;
  visible: boolean;
  /** Called after the token is successfully placed. */
  onPlaced?: () => void;
}

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
  /** Natural width of the loaded background image in pixels. */
  imageNaturalWidth: number | null;
  /** Natural height of the loaded background image in pixels. */
  imageNaturalHeight: number | null;
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
  /** Token context menu (right-click). */
  contextMenu: TokenContextMenu | null;
  /** Token being click-to-moved (awaiting destination click). */
  movingToken: MovingToken | null;
  /** Token being edited (shows detail panel). */
  editingTokenId: string | null;
  /** Pending token placement awaiting a map click. */
  pendingTokenPlacement: PendingTokenPlacement | null;
  /** Cells being painted for a new fog group (grid coordinates). */
  paintedFogCells: { x: number; y: number }[];
  /** Counter for auto-naming fog groups. */
  fogGroupCounter: number;
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

  /** Update grid dimensions (columns x rows). Recomputes gridSize to fit the image. */
  updateGridDimensions: (gridWidth: number, gridHeight: number) => void;

  /** Store the background image's natural dimensions once loaded. */
  setImageNaturalSize: (width: number, height: number) => void;

  /** Open the token context menu at screen position. */
  openContextMenu: (tokenId: string, x: number, y: number) => void;
  /** Close the token context menu. */
  closeContextMenu: () => void;
  /** Start click-to-move mode for a token. */
  startMovingToken: (tokenId: string) => void;
  /** Cancel click-to-move mode. */
  cancelMovingToken: () => void;
  /** Set the token being edited (detail panel). */
  setEditingToken: (tokenId: string | null) => void;

  /** Start token placement mode. User clicks a map cell to place the token. */
  startTokenPlacement: (placement: PendingTokenPlacement) => void;
  /** Cancel token placement mode. */
  cancelTokenPlacement: () => void;
  /** Complete token placement at the given grid coordinates. */
  completeTokenPlacement: (gridX: number, gridY: number) => void;

  /** Add a cell to the current fog painting session. */
  addPaintedFogCell: (x: number, y: number) => void;
  /** Remove a cell from the current fog painting session. */
  removePaintedFogCell: (x: number, y: number) => void;
  /** Clear all painted fog cells (cancel painting). */
  clearPaintedFogCells: () => void;
  /** Commit painted cells as a new fog region group on the server. */
  commitFogGroup: (name?: string) => void;

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
  contextMenu: null,
  movingToken: null,
  editingTokenId: null,
  pendingTokenPlacement: null,
  paintedFogCells: [],
  fogGroupCounter: 1,
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
          imageNaturalWidth: null,
          imageNaturalHeight: null,
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

  updateGridDimensions(gridWidth: number, gridHeight: number) {
    const { currentMap } = get();
    if (!currentMap) return;

    // Optimistic local update
    set({
      currentMap: { ...currentMap, gridWidth, gridHeight },
    });

    // Persist to server and broadcast to other clients via Socket.IO
    const socket = getSocket();
    socket.emit('MAP_UPDATE', {
      mapId: currentMap.id,
      gridWidth,
      gridHeight,
    });
  },

  setImageNaturalSize(width: number, height: number) {
    set((state) => {
      if (!state.currentMap) return state;
      return {
        currentMap: {
          ...state.currentMap,
          imageNaturalWidth: width,
          imageNaturalHeight: height,
        },
      };
    });
  },

  openContextMenu(tokenId: string, x: number, y: number) {
    set({ contextMenu: { tokenId, x, y }, movingToken: null });
  },

  closeContextMenu() {
    set({ contextMenu: null });
  },

  startMovingToken(tokenId: string) {
    set({ movingToken: { tokenId }, contextMenu: null, selectedTokenId: tokenId });
  },

  cancelMovingToken() {
    set({ movingToken: null });
  },

  setEditingToken(tokenId: string | null) {
    set({ editingTokenId: tokenId, contextMenu: null });
  },

  startTokenPlacement(placement: PendingTokenPlacement) {
    set({ pendingTokenPlacement: placement, tool: 'place-token' });
  },

  cancelTokenPlacement() {
    set({ pendingTokenPlacement: null, tool: 'select' });
  },

  completeTokenPlacement(gridX: number, gridY: number) {
    const { currentMap, pendingTokenPlacement } = get();
    if (!currentMap || !pendingTokenPlacement) return;

    const socket = getSocket();
    socket.emit(
      'TOKEN_ADD',
      {
        mapId: currentMap.id,
        name: pendingTokenPlacement.name,
        imageUrl: pendingTokenPlacement.imageUrl,
        x: gridX,
        y: gridY,
        width: pendingTokenPlacement.width,
        height: pendingTokenPlacement.height,
        layer: pendingTokenPlacement.layer,
        visible: pendingTokenPlacement.visible,
      },
      (ack) => {
        if (!ack.ok) {
          set({ error: ack.error ?? 'Failed to place token' });
        }
      },
    );

    // Call onPlaced callback if provided
    const onPlaced = pendingTokenPlacement.onPlaced;

    set({ pendingTokenPlacement: null, tool: 'select' });

    if (onPlaced) {
      onPlaced();
    }
  },

  addPaintedFogCell(x: number, y: number) {
    set((state) => {
      if (state.paintedFogCells.some((c) => c.x === x && c.y === y)) return state;
      return { paintedFogCells: [...state.paintedFogCells, { x, y }] };
    });
  },

  removePaintedFogCell(x: number, y: number) {
    set((state) => ({
      paintedFogCells: state.paintedFogCells.filter((c) => !(c.x === x && c.y === y)),
    }));
  },

  clearPaintedFogCells() {
    set({ paintedFogCells: [] });
  },

  commitFogGroup(name?: string) {
    const { currentMap, paintedFogCells, fogGroupCounter } = get();
    if (!currentMap || paintedFogCells.length === 0) return;

    const socket = getSocket();
    const groupName = name?.trim() || `Group ${fogGroupCounter}`;

    for (const cell of paintedFogCells) {
      const points = [
        { x: cell.x, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x + 1, y: cell.y + 1 },
        { x: cell.x, y: cell.y + 1 },
      ];
      socket.emit(
        'FOG_CREATE',
        { mapId: currentMap.id, name: groupName, points, revealed: false },
        () => {
          // Acknowledgement handled by FOG_CREATED listener
        },
      );
    }

    set({
      fogGroupCounter: fogGroupCounter + 1,
      paintedFogCells: [],
      tool: 'select',
    });
  },

  clearMap() {
    set({
      currentMap: null,
      tokens: [],
      fogRegions: [],
      selectedTokenId: null,
      tool: 'select',
      viewport: { x: 0, y: 0, scale: 1 },
      pendingTokenPlacement: null,
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

    const handleFogCreated = (payload: FogCreatedPayload) => {
      set((state) => {
        if (!state.currentMap || state.currentMap.id !== payload.mapId) return state;
        const newRegion: FogRegion = {
          id: payload.region.id,
          mapId: payload.region.mapId,
          name: payload.region.name,
          points: payload.region.points,
          revealed: payload.region.revealed,
        };
        if (state.fogRegions.some((r) => r.id === newRegion.id)) return state;
        return { fogRegions: [...state.fogRegions, newRegion] };
      });
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
          imageNaturalWidth: null,
          imageNaturalHeight: null,
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
    socket.on('FOG_CREATED', handleFogCreated);
    socket.on('FOG_UPDATED', handleFogUpdated);
    socket.on('MAP_LOADED', handleMapLoaded);
    socket.on('MAP_UPDATED', handleMapUpdated);

    return () => {
      socket.off('TOKEN_MOVED', handleTokenMoved);
      socket.off('TOKEN_ADDED', handleTokenAdded);
      socket.off('TOKEN_REMOVED', handleTokenRemoved);
      socket.off('FOG_CREATED', handleFogCreated);
      socket.off('FOG_UPDATED', handleFogUpdated);
      socket.off('MAP_LOADED', handleMapLoaded);
      socket.off('MAP_UPDATED', handleMapUpdated);
    };
  },
}));
