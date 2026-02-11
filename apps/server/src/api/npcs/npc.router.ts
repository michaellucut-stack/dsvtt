import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { createNpcSchema, updateNpcSchema, assignTokenSchema } from './npc.schemas.js';
import * as npcService from './npc.service.js';

// ---------------------------------------------------------------------------
// Session-scoped NPC routes  (mounted at /api/sessions/:sessionId/npcs)
// ---------------------------------------------------------------------------

/** NPC router — session-scoped routes. */
export const npcRouter = Router({ mergeParams: true });

npcRouter.use(authenticateToken);

/**
 * POST /api/sessions/:sessionId/npcs
 *
 * Create a new NPC in the session. Director only.
 */
npcRouter.post(
  '/',
  validate(createNpcSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const npc = await npcService.createNpc(sessionId, userId, req.body);
      res.status(201).json({ ok: true, data: npc });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:sessionId/npcs
 *
 * List all NPCs in the session.
 */
npcRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const npcs = await npcService.listNpcs(sessionId);
      res.status(200).json({ ok: true, data: npcs });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Standalone NPC routes  (mounted at /api/npcs)
// ---------------------------------------------------------------------------

/** NPC detail router — standalone routes. */
export const npcDetailRouter = Router();

npcDetailRouter.use(authenticateToken);

/**
 * GET /api/npcs/:id
 *
 * Get NPC detail by ID.
 */
npcDetailRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const npc = await npcService.getNpc(req.params['id'] as string);
      res.status(200).json({ ok: true, data: npc });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/npcs/:id
 *
 * Update an NPC. Director only.
 */
npcDetailRouter.put(
  '/:id',
  validate(updateNpcSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const npcId = req.params['id'] as string;
      const userId = req.user!.sub;
      const npc = await npcService.updateNpc(npcId, userId, req.body);
      res.status(200).json({ ok: true, data: npc });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/npcs/:id
 *
 * Delete an NPC. Director only.
 */
npcDetailRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const npcId = req.params['id'] as string;
      const userId = req.user!.sub;
      await npcService.deleteNpc(npcId, userId);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/npcs/:id/assign-token
 *
 * Assign a map token to an NPC. Director only.
 */
npcDetailRouter.post(
  '/:id/assign-token',
  validate(assignTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const npcId = req.params['id'] as string;
      const userId = req.user!.sub;
      const { tokenId } = req.body;
      const npc = await npcService.assignToken(npcId, userId, tokenId);
      res.status(200).json({ ok: true, data: npc });
    } catch (err) {
      next(err);
    }
  },
);
