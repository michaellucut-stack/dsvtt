import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type {
  CreateMapBody,
  UpdateMapBody,
  AddTokenBody,
  CreateFogRegionBody,
} from './map.schemas.js';

// ---------------------------------------------------------------------------
// Serialisation types
// ---------------------------------------------------------------------------

/** Serialised game map without relations. */
export interface MapListItem {
  id: string;
  sessionId: string;
  name: string;
  backgroundUrl: string | null;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  createdAt: string;
}

/** Serialised token. */
export interface TokenItem {
  id: string;
  mapId: string;
  ownerId: string;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: string;
  visible: boolean;
}

/** Serialised fog region. */
export interface FogRegionItem {
  id: string;
  mapId: string;
  name?: string;
  points: { x: number; y: number }[];
  revealed: boolean;
}

/** Full map detail with tokens and fog regions. */
export interface MapDetail extends MapListItem {
  tokens: TokenItem[];
  fogRegions: FogRegionItem[];
}

/** Complete map state for syncing new players. */
export interface MapState extends MapDetail {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a session exists and that the requesting user is the director
 * of the room owning the session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The authenticated user's ID.
 * @throws {AppError} 404 if session not found, 403 if not director.
 */
export async function requireSessionDirector(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: true },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.room.directorId !== userId) {
    throw new AppError(
      'Only the session director can perform this action',
      403,
      'MAP_NOT_DIRECTOR',
    );
  }
}

/**
 * Verify that a map exists and return it with relations.
 *
 * @param mapId - The map ID.
 * @throws {AppError} 404 if the map does not exist.
 */
async function findMapOrThrow(mapId: string) {
  const map = await prisma.gameMap.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new AppError('Map not found', 404, 'MAP_NOT_FOUND');
  }
  return map;
}

/**
 * Check that the user is the director of the room that owns the given map's
 * session.
 *
 * @param mapId - The map ID.
 * @param userId - The authenticated user's ID.
 * @returns The map record.
 * @throws {AppError} 404 if map/session not found, 403 if not director.
 */
export async function requireMapDirector(mapId: string, userId: string) {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    include: { session: { include: { room: true } } },
  });

  if (!map) {
    throw new AppError('Map not found', 404, 'MAP_NOT_FOUND');
  }

  if (map.session.room.directorId !== userId) {
    throw new AppError(
      'Only the session director can perform this action',
      403,
      'MAP_NOT_DIRECTOR',
    );
  }

  return map;
}

function serializeMap(map: {
  id: string;
  sessionId: string;
  name: string;
  backgroundUrl: string | null;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  createdAt: Date;
}): MapListItem {
  return {
    id: map.id,
    sessionId: map.sessionId,
    name: map.name,
    backgroundUrl: map.backgroundUrl,
    gridWidth: map.gridWidth,
    gridHeight: map.gridHeight,
    gridSize: map.gridSize,
    createdAt: map.createdAt.toISOString(),
  };
}

function serializeToken(token: {
  id: string;
  mapId: string;
  ownerId: string;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: string;
  visible: boolean;
}): TokenItem {
  return {
    id: token.id,
    mapId: token.mapId,
    ownerId: token.ownerId,
    name: token.name,
    imageUrl: token.imageUrl,
    x: token.x,
    y: token.y,
    width: token.width,
    height: token.height,
    layer: token.layer,
    visible: token.visible,
  };
}

function serializeFogRegion(region: {
  id: string;
  mapId: string;
  name?: string | null;
  points: Prisma.JsonValue;
  revealed: boolean;
}): FogRegionItem {
  return {
    id: region.id,
    mapId: region.mapId,
    ...(region.name != null && { name: region.name }),
    points: region.points as { x: number; y: number }[],
    revealed: region.revealed,
  };
}

// ---------------------------------------------------------------------------
// Map CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new game map within a session.
 *
 * @param sessionId - The game session to attach the map to.
 * @param data - Validated creation payload.
 * @returns The newly created map.
 */
export async function createMap(sessionId: string, data: CreateMapBody): Promise<MapListItem> {
  // Verify session exists
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const map = await prisma.gameMap.create({
    data: {
      sessionId,
      name: data.name,
      gridWidth: data.gridWidth,
      gridHeight: data.gridHeight,
      gridSize: data.gridSize,
    },
  });

  return serializeMap(map);
}

/**
 * List all maps belonging to a session.
 *
 * @param sessionId - The game session ID.
 * @returns Array of serialised map items.
 */
export async function getMaps(sessionId: string): Promise<MapListItem[]> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const maps = await prisma.gameMap.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });

  return maps.map(serializeMap);
}

/**
 * Get detailed map information including tokens and fog regions.
 *
 * @param mapId - The map's unique ID.
 * @returns Map detail with tokens and fog regions.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function getMapDetail(mapId: string): Promise<MapDetail> {
  const map = await prisma.gameMap.findUnique({
    where: { id: mapId },
    include: {
      tokens: { orderBy: { layer: 'asc' } },
      fogRegions: true,
    },
  });

  if (!map) {
    throw new AppError('Map not found', 404, 'MAP_NOT_FOUND');
  }

  return {
    ...serializeMap(map),
    tokens: map.tokens.map(serializeToken),
    fogRegions: map.fogRegions.map(serializeFogRegion),
  };
}

/**
 * Update map properties (name, grid dimensions, etc.).
 *
 * @param mapId - The map to update.
 * @param data - Validated partial update payload.
 * @returns The updated map.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function updateMap(mapId: string, data: UpdateMapBody): Promise<MapListItem> {
  await findMapOrThrow(mapId);

  const map = await prisma.gameMap.update({
    where: { id: mapId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.gridWidth !== undefined && { gridWidth: data.gridWidth }),
      ...(data.gridHeight !== undefined && { gridHeight: data.gridHeight }),
      ...(data.gridSize !== undefined && { gridSize: data.gridSize }),
    },
  });

  return serializeMap(map);
}

/**
 * Delete a map and all its associated tokens and fog regions (cascade).
 *
 * @param mapId - The map to delete.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function deleteMap(mapId: string): Promise<void> {
  await findMapOrThrow(mapId);
  await prisma.gameMap.delete({ where: { id: mapId } });
}

/**
 * Set the background image URL for a map.
 *
 * @param mapId - The map to update.
 * @param fileUrl - The URL/path of the uploaded background image.
 * @returns The updated map.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function uploadMapBackground(mapId: string, fileUrl: string): Promise<MapListItem> {
  await findMapOrThrow(mapId);

  const map = await prisma.gameMap.update({
    where: { id: mapId },
    data: { backgroundUrl: fileUrl },
  });

  return serializeMap(map);
}

// ---------------------------------------------------------------------------
// Token operations
// ---------------------------------------------------------------------------

/**
 * Add a new token to a map.
 *
 * @param mapId - The map to add the token to.
 * @param data - Validated token payload.
 * @returns The newly created token.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function addToken(mapId: string, data: AddTokenBody): Promise<TokenItem> {
  await findMapOrThrow(mapId);

  const token = await prisma.token.create({
    data: {
      mapId,
      name: data.name,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      layer: data.layer,
      ownerId: data.ownerId ?? '',
      imageUrl: data.imageUrl ?? null,
      visible: data.visible,
    },
  });

  return serializeToken(token);
}

/**
 * Move a token to a new position.
 *
 * @param tokenId - The token to move.
 * @param x - New x coordinate.
 * @param y - New y coordinate.
 * @returns The updated token.
 * @throws {AppError} 404 if the token does not exist.
 */
export async function moveToken(tokenId: string, x: number, y: number): Promise<TokenItem> {
  const existing = await prisma.token.findUnique({ where: { id: tokenId } });
  if (!existing) {
    throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
  }

  const token = await prisma.token.update({
    where: { id: tokenId },
    data: { x, y },
  });

  return serializeToken(token);
}

/**
 * Remove a token from its map.
 *
 * @param tokenId - The token to remove.
 * @throws {AppError} 404 if the token does not exist.
 */
export async function removeToken(tokenId: string): Promise<void> {
  const existing = await prisma.token.findUnique({ where: { id: tokenId } });
  if (!existing) {
    throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
  }

  await prisma.token.delete({ where: { id: tokenId } });
}

/**
 * Toggle token visibility for players.
 *
 * @param tokenId - The token to update.
 * @param visible - Whether the token should be visible.
 * @returns The updated token.
 * @throws {AppError} 404 if the token does not exist.
 */
export async function updateTokenVisibility(tokenId: string, visible: boolean): Promise<TokenItem> {
  const existing = await prisma.token.findUnique({ where: { id: tokenId } });
  if (!existing) {
    throw new AppError('Token not found', 404, 'TOKEN_NOT_FOUND');
  }

  const token = await prisma.token.update({
    where: { id: tokenId },
    data: { visible },
  });

  return serializeToken(token);
}

// ---------------------------------------------------------------------------
// Fog region operations
// ---------------------------------------------------------------------------

/**
 * Get all fog regions for a map.
 *
 * @param mapId - The map ID.
 * @returns Array of fog region items.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function getFogRegions(mapId: string): Promise<FogRegionItem[]> {
  await findMapOrThrow(mapId);

  const regions = await prisma.fogRegion.findMany({
    where: { mapId },
  });

  return regions.map(serializeFogRegion);
}

/**
 * Update a fog region's revealed status.
 *
 * @param mapId - The map the region belongs to.
 * @param regionId - The fog region to update.
 * @param revealed - Whether the region should be revealed.
 * @returns The updated fog region.
 * @throws {AppError} 404 if the region does not exist.
 */
export async function updateFogRegion(
  mapId: string,
  regionId: string,
  revealed: boolean,
): Promise<FogRegionItem> {
  const region = await prisma.fogRegion.findFirst({
    where: { id: regionId, mapId },
  });

  if (!region) {
    throw new AppError('Fog region not found', 404, 'FOG_REGION_NOT_FOUND');
  }

  const updated = await prisma.fogRegion.update({
    where: { id: regionId },
    data: { revealed },
  });

  return serializeFogRegion(updated);
}

/**
 * Create a new fog region on a map.
 *
 * @param mapId - The map to add the fog region to.
 * @param data - Validated fog region payload with polygon points.
 * @returns The newly created fog region.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function createFogRegion(
  mapId: string,
  data: CreateFogRegionBody,
): Promise<FogRegionItem> {
  await findMapOrThrow(mapId);

  const region = await prisma.fogRegion.create({
    data: {
      mapId,
      ...(data.name !== undefined && { name: data.name }),
      points: data.points as unknown as Prisma.InputJsonValue,
      revealed: data.revealed,
    },
  });

  return serializeFogRegion(region);
}

/**
 * Get the complete map state for syncing a newly connected player. Includes
 * the map properties, all tokens, and all fog regions.
 *
 * @param mapId - The map to fetch state for.
 * @returns Full map state suitable for client hydration.
 * @throws {AppError} 404 if the map does not exist.
 */
export async function getMapState(mapId: string): Promise<MapState> {
  return getMapDetail(mapId);
}

/**
 * Clone a map (with all tokens and fog regions) into a new session.
 * The background image URL, grid settings, tokens, and fog regions are all
 * copied to the new map. Token and fog-region IDs are regenerated.
 *
 * @param sourceMapId - The map to clone from.
 * @param targetSessionId - The session to create the cloned map in.
 * @returns The newly created map (serialised without relations).
 * @throws {AppError} 404 if the source map does not exist.
 */
export async function cloneMap(sourceMapId: string, targetSessionId: string): Promise<MapListItem> {
  const source = await prisma.gameMap.findUnique({
    where: { id: sourceMapId },
    include: {
      tokens: true,
      fogRegions: true,
    },
  });

  if (!source) {
    throw new AppError('Source map not found', 404, 'MAP_NOT_FOUND');
  }

  // Create the new map with the same settings
  const newMap = await prisma.gameMap.create({
    data: {
      sessionId: targetSessionId,
      name: source.name,
      backgroundUrl: source.backgroundUrl,
      gridWidth: source.gridWidth,
      gridHeight: source.gridHeight,
      gridSize: source.gridSize,
    },
  });

  // Clone all tokens
  if (source.tokens.length > 0) {
    await prisma.token.createMany({
      data: source.tokens.map((t) => ({
        mapId: newMap.id,
        ownerId: t.ownerId,
        name: t.name,
        imageUrl: t.imageUrl,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        layer: t.layer,
        visible: t.visible,
      })),
    });
  }

  // Clone all fog regions
  if (source.fogRegions.length > 0) {
    await prisma.fogRegion.createMany({
      data: source.fogRegions.map((r) => ({
        mapId: newMap.id,
        ...((r as { name?: string | null }).name != null && {
          name: (r as { name?: string | null }).name,
        }),
        points: r.points as Prisma.InputJsonValue,
        revealed: r.revealed,
      })),
    });
  }

  return serializeMap(newMap);
}
