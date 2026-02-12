import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { searchQuerySchema } from './search.schemas.js';
import * as searchService from './search.service.js';

export const searchRouter = Router({ mergeParams: true });
searchRouter.use(authenticateToken);

/**
 * GET /api/sessions/:sessionId/search?q=dragon&types=chat,note&page=1&limit=20
 * Full-text search across chat messages, shared notes, and characters.
 */
searchRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params['sessionId'] as string;

    const parsed = searchQuerySchema.parse(req.query);
    const types = parsed.types?.split(',').filter(Boolean);

    const result = await searchService.search(
      sessionId,
      parsed.q,
      { types, channel: parsed.channel },
      parsed.page,
      parsed.limit,
    );

    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});
