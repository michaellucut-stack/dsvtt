import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validation.js';
import { createNoteSchema, updateNoteSchema } from './notes.schemas.js';
import * as notesService from './notes.service.js';

// ---------------------------------------------------------------------------
// Session-scoped note routes  (mounted at /api/sessions/:sessionId/notes)
// ---------------------------------------------------------------------------

/** Notes router — session-scoped routes. */
export const notesRouter = Router({ mergeParams: true });

notesRouter.use(authenticateToken);

/**
 * POST /api/sessions/:sessionId/notes
 *
 * Create a new shared note in the session.
 */
notesRouter.post(
  '/',
  validate(createNoteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const userId = req.user!.sub;
      const note = await notesService.createNote(sessionId, userId, req.body);
      res.status(201).json({ ok: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sessions/:sessionId/notes
 *
 * List all shared notes in the session.
 */
notesRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const notes = await notesService.listNotes(sessionId);
      res.status(200).json({ ok: true, data: notes });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Standalone note routes  (mounted at /api/notes)
// ---------------------------------------------------------------------------

/** Notes detail router — standalone routes. */
export const notesDetailRouter = Router();

notesDetailRouter.use(authenticateToken);

/**
 * GET /api/notes/:id
 *
 * Get a shared note by ID.
 */
notesDetailRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await notesService.getNote(req.params['id'] as string);
      res.status(200).json({ ok: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/notes/:id
 *
 * Update a shared note. Any session member can edit; updatedBy is tracked.
 */
notesDetailRouter.put(
  '/:id',
  validate(updateNoteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noteId = req.params['id'] as string;
      const userId = req.user!.sub;
      const note = await notesService.updateNote(noteId, userId, req.body);
      res.status(200).json({ ok: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/notes/:id
 *
 * Delete a shared note. Director only.
 */
notesDetailRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noteId = req.params['id'] as string;
      const userId = req.user!.sub;
      await notesService.deleteNote(noteId, userId);
      res.status(200).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);
