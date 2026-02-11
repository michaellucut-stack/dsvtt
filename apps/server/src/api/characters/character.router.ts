import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { createCharacterSchema, updateCharacterSchema } from './character.schemas.js';
import * as characterService from './character.service.js';

// ---------------------------------------------------------------------------
// Session-scoped character routes  (mounted at /api/sessions/:sessionId/characters)
// ---------------------------------------------------------------------------

/** Character router — session-scoped routes. */
export const characterRouter = Router({ mergeParams: true });

characterRouter.use(authenticateToken);

/**
 * POST /api/sessions/:sessionId/characters
 *
 * Create a new character in the session. The character is owned by the
 * authenticated user.
 */
characterRouter.post(
  '/',
  validate(createCharacterSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const character = await characterService.createCharacter(sessionId, userId, req.body);
      res.status(201).json({ ok: true, data: character });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:sessionId/characters
 *
 * List characters in the session. Directors see all; players see own.
 */
characterRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const characters = await characterService.listCharacters(sessionId, userId);
      res.status(200).json({ ok: true, data: characters });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Standalone character routes  (mounted at /api/characters)
// ---------------------------------------------------------------------------

/** Character detail router — standalone routes. */
export const characterDetailRouter = Router();

characterDetailRouter.use(authenticateToken);

/**
 * GET /api/characters/:id
 *
 * Get character detail. Ownership/director check applies.
 */
characterDetailRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const characterId = req.params['id'] as string;
      const userId = req.user!.sub;
      const character = await characterService.getCharacter(characterId, userId);
      res.status(200).json({ ok: true, data: character });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/characters/:id
 *
 * Update a character. Player can update own; director can update any.
 */
characterDetailRouter.put(
  '/:id',
  validate(updateCharacterSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const characterId = req.params['id'] as string;
      const userId = req.user!.sub;
      const character = await characterService.updateCharacter(characterId, userId, req.body);
      res.status(200).json({ ok: true, data: character });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/characters/:id
 *
 * Delete a character. Player can delete own; director can delete any.
 */
characterDetailRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const characterId = req.params['id'] as string;
      const userId = req.user!.sub;
      await characterService.deleteCharacter(characterId, userId);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);
