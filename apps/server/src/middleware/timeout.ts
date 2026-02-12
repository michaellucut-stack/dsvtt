import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Factory that returns Express middleware to abort requests exceeding the
 * given timeout. If the response headers have not been sent when the timer
 * fires, a 408 Request Timeout response is returned. The timer is
 * automatically cleaned up when the response finishes normally.
 *
 * @param ms - Maximum request duration in milliseconds.
 * @returns Express middleware function.
 */
export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timed out after ${ms}ms`, {
          context: 'timeout',
          method: req.method,
          path: req.originalUrl,
          requestId: req.requestId,
        });

        res.status(408).json({
          ok: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request timed out after ${ms}ms`,
          },
        });
      }
    }, ms);

    // Clean up the timer when the response finishes normally
    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
}
