import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { mapUpload, getFileUrl } from '../../utils/upload.js';
import {
  createMapSchema,
  updateMapSchema,
  addTokenSchema,
  createFogRegionSchema,
  updateFogRegionSchema,
} from './map.schemas.js';
import * as mapService from './map.service.js';

// ---------------------------------------------------------------------------
// Router — session-scoped map routes
// ---------------------------------------------------------------------------

/**
 * Map router — mounts session-scoped routes at `/api/sessions/:sessionId/maps`
 * and standalone routes at `/api/maps/:id`.
 *
 * All routes require JWT authentication. Director-only actions validate
 * ownership via the session → room → director chain.
 */
export const mapRouter = Router({ mergeParams: true });

// Every map route requires authentication
mapRouter.use(authenticateToken);

// ---------------------------------------------------------------------------
// Session-scoped routes  (mounted at /api/sessions/:sessionId/maps)
// ---------------------------------------------------------------------------

/**
 * POST /api/sessions/:sessionId/maps
 *
 * Create a new map within a session. Only the session's director may create
 * maps.
 */
mapRouter.post(
  '/',
  validate(createMapSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      await mapService.requireSessionDirector(sessionId, req.user!.sub);
      const map = await mapService.createMap(sessionId, req.body);
      res.status(201).json({ ok: true, data: map });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:sessionId/maps
 *
 * List all maps belonging to a session.
 */
mapRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;
    const maps = await mapService.getMaps(sessionId);
    res.status(200).json({ ok: true, data: maps });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Standalone map routes  (mounted at /api/maps)
// ---------------------------------------------------------------------------

/** Standalone map router — mounted at `/api/maps`. */
export const mapDetailRouter = Router();

// Every map route requires authentication
mapDetailRouter.use(authenticateToken);

/**
 * GET /api/maps/:id
 *
 * Get detailed map information including all tokens and fog regions.
 */
mapDetailRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const detail = await mapService.getMapDetail(req.params['id'] as string);
      res.status(200).json({ ok: true, data: detail });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/maps/:id/state
 *
 * Get the complete map state (map + tokens + fog) for client hydration.
 */
mapDetailRouter.get(
  '/:id/state',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const state = await mapService.getMapState(req.params['id'] as string);
      res.status(200).json({ ok: true, data: state });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/maps/:id
 *
 * Update map properties. Director only.
 */
mapDetailRouter.put(
  '/:id',
  validate(updateMapSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      await mapService.requireMapDirector(mapId, req.user!.sub);
      const map = await mapService.updateMap(mapId, req.body);
      res.status(200).json({ ok: true, data: map });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/maps/:id
 *
 * Delete a map and cascade-delete all its tokens and fog regions. Director only.
 */
mapDetailRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      await mapService.requireMapDirector(mapId, req.user!.sub);
      await mapService.deleteMap(mapId);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/maps/:id/upload
 *
 * Upload a background image for a map. Accepts a single multipart file with
 * field name `file`. Director only.
 */
mapDetailRouter.post(
  '/:id/upload',
  mapUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      await mapService.requireMapDirector(mapId, req.user!.sub);

      if (!req.file) {
        res.status(400).json({
          ok: false,
          error: { code: 'UPLOAD_NO_FILE', message: 'No file uploaded' },
        });
        return;
      }

      const fileUrl = getFileUrl(req.file);
      const map = await mapService.uploadMapBackground(mapId, fileUrl);
      res.status(200).json({ ok: true, data: map });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Token routes (under /api/maps/:id/tokens)
// ---------------------------------------------------------------------------

/**
 * POST /api/maps/:id/tokens
 *
 * Add a token to a map.
 */
mapDetailRouter.post(
  '/:id/tokens',
  validate(addTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      const token = await mapService.addToken(mapId, req.body);
      res.status(201).json({ ok: true, data: token });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/maps/:id/tokens/:tokenId
 *
 * Remove a token from a map.
 */
mapDetailRouter.delete(
  '/:id/tokens/:tokenId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenId = req.params['tokenId'] as string;
      await mapService.removeToken(tokenId);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Fog region routes (under /api/maps/:id/fog)
// ---------------------------------------------------------------------------

/**
 * POST /api/maps/:id/fog
 *
 * Create a new fog region on a map. Director only.
 */
mapDetailRouter.post(
  '/:id/fog',
  validate(createFogRegionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      await mapService.requireMapDirector(mapId, req.user!.sub);
      const region = await mapService.createFogRegion(mapId, req.body);
      res.status(201).json({ ok: true, data: region });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/maps/:id/fog/:regionId
 *
 * Update a fog region's revealed status. Director only.
 */
mapDetailRouter.patch(
  '/:id/fog/:regionId',
  validate(updateFogRegionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mapId = req.params['id'] as string;
      const regionId = req.params['regionId'] as string;
      await mapService.requireMapDirector(mapId, req.user!.sub);
      const region = await mapService.updateFogRegion(mapId, regionId, req.body.revealed);
      res.status(200).json({ ok: true, data: region });
    } catch (err) {
      next(err);
    }
  },
);
