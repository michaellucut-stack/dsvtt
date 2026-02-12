import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(),
  channel: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
