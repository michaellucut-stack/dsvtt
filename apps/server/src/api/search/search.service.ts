import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';

export interface SearchResultItem {
  type: 'chat' | 'note' | 'character';
  id: string;
  sessionId: string;
  title: string;
  excerpt: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

const VALID_TYPES = new Set(['chat', 'note', 'character']);

/**
 * Full-text search across chat messages, shared notes, and characters.
 * Uses PostgreSQL tsvector/tsquery with ts_rank for relevance.
 */
export async function search(
  sessionId: string,
  query: string,
  filters: { types?: string[]; channel?: string },
  page: number,
  limit: number,
): Promise<SearchResponse> {
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');

  // Build tsquery from words joined with &
  const tsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\w]/g, ''))
    .filter(Boolean)
    .join(' & ');

  if (!tsQuery) throw new AppError('Invalid search query', 400, 'INVALID_QUERY');

  const types = (filters.types ?? ['chat', 'note', 'character']).filter((t) => VALID_TYPES.has(t));
  const offset = (page - 1) * limit;

  const results: SearchResultItem[] = [];
  let total = 0;

  // ── Search chat messages ──────────────────────────────────────────
  if (types.includes('chat')) {
    const channelFilter = filters.channel
      ? Prisma.sql`AND channel = ${filters.channel.toUpperCase()}`
      : Prisma.empty;

    const chatResults = await prisma.$queryRaw<
      Array<{
        id: string;
        session_id: string;
        sender_name: string;
        content: string;
        channel: string;
        timestamp: Date;
        rank: number;
      }>
    >`
      SELECT id, session_id, sender_name, content, channel, timestamp,
             ts_rank(search_vector, to_tsquery('english', ${tsQuery})) AS rank
      FROM chat_messages
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
        ${channelFilter}
      ORDER BY rank DESC, timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const chatCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count FROM chat_messages
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
        ${channelFilter}
    `;

    total += Number(chatCount[0]?.count ?? 0);

    for (const row of chatResults) {
      results.push({
        type: 'chat',
        id: row.id,
        sessionId: row.session_id,
        title: row.sender_name,
        excerpt: row.content.slice(0, 200),
        timestamp: row.timestamp.toISOString(),
        metadata: { channel: row.channel.toLowerCase(), rank: row.rank },
      });
    }
  }

  // ── Search shared notes ───────────────────────────────────────────
  if (types.includes('note')) {
    const noteResults = await prisma.$queryRaw<
      Array<{
        id: string;
        session_id: string;
        title: string;
        content: string;
        updated_at: Date;
        rank: number;
      }>
    >`
      SELECT id, session_id, title, content, updated_at,
             ts_rank(search_vector, to_tsquery('english', ${tsQuery})) AS rank
      FROM shared_notes
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC, updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const noteCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count FROM shared_notes
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
    `;

    total += Number(noteCount[0]?.count ?? 0);

    for (const row of noteResults) {
      results.push({
        type: 'note',
        id: row.id,
        sessionId: row.session_id,
        title: row.title,
        excerpt: row.content.slice(0, 200),
        timestamp: row.updated_at.toISOString(),
        metadata: { rank: row.rank },
      });
    }
  }

  // ── Search characters ─────────────────────────────────────────────
  if (types.includes('character')) {
    const charResults = await prisma.$queryRaw<
      Array<{
        id: string;
        session_id: string;
        name: string;
        notes: string | null;
        rank: number;
      }>
    >`
      SELECT id, session_id, name, notes,
             ts_rank(search_vector, to_tsquery('english', ${tsQuery})) AS rank
      FROM characters
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const charCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count FROM characters
      WHERE session_id = ${sessionId}::uuid
        AND search_vector @@ to_tsquery('english', ${tsQuery})
    `;

    total += Number(charCount[0]?.count ?? 0);

    for (const row of charResults) {
      results.push({
        type: 'character',
        id: row.id,
        sessionId: row.session_id,
        title: row.name,
        excerpt: (row.notes ?? '').slice(0, 200),
        timestamp: '',
        metadata: { rank: row.rank },
      });
    }
  }

  // Sort combined results by rank descending
  results.sort((a, b) => ((b.metadata['rank'] as number) ?? 0) - ((a.metadata['rank'] as number) ?? 0));

  return { results: results.slice(0, limit), total, page, limit };
}
