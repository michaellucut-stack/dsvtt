import { z } from 'zod';

export const getEventsQuerySchema = z.object({
  fromSequence: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const getStateAtQuerySchema = z.object({
  sequenceNumber: z.coerce.number().int().min(0),
});
