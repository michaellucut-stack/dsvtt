/** A game map with a grid overlay for token placement. */
export interface GameMap {
  id: string;
  sessionId: string;
  name: string;
  backgroundUrl: string | null;
  /** Number of grid columns. */
  gridWidth: number;
  /** Number of grid rows. */
  gridHeight: number;
  /** Size of each grid cell in pixels. */
  gridSize: number;
}

/** Rendering layer for tokens, controlling z-ordering and visibility. */
export type TokenLayer = 'background' | 'token' | 'effect' | 'gm';

/** A movable token placed on a game map. */
export interface Token {
  id: string;
  mapId: string;
  ownerId: string;
  name: string;
  imageUrl: string | null;
  /** Grid x-coordinate. */
  x: number;
  /** Grid y-coordinate. */
  y: number;
  /** Width in grid cells. */
  width: number;
  /** Height in grid cells. */
  height: number;
  layer: TokenLayer;
  /** Whether the token is visible to players. */
  visible: boolean;
}

/** A fog-of-war polygon region on a map. */
export interface FogRegion {
  id: string;
  mapId: string;
  /** Optional human-readable name for the fog region. */
  name?: string;
  /** Polygon vertices defining the fog boundary. */
  points: { x: number; y: number }[];
  /** Whether this region has been revealed to players. */
  revealed: boolean;
}
