import type { ChatChannel, Prisma } from '@prisma/client';
import { MAX_CHAT_MESSAGE_LENGTH } from '@dsvtt/shared';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialised chat message. */
export interface ChatMessageItem {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  channel: string;
  content: string;
  recipientId: string | null;
  timestamp: string;
}

function serializeChatMessage(msg: {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  content: string;
  recipientId: string | null;
  timestamp: Date;
}): ChatMessageItem {
  return {
    id: msg.id,
    sessionId: msg.sessionId,
    senderId: msg.senderId,
    senderName: msg.senderName,
    channel: msg.channel,
    content: msg.content,
    recipientId: msg.recipientId,
    timestamp: msg.timestamp.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Persist a chat message to the database.
 *
 * @param sessionId - The game session ID.
 * @param senderId - The sender's user ID.
 * @param senderName - The sender's display name.
 * @param channel - The chat channel (IC, OOC, WHISPER, SYSTEM).
 * @param content - The message content.
 * @param recipientId - The recipient user ID (required for WHISPER).
 * @returns The persisted chat message.
 * @throws {AppError} 404 if session not found.
 * @throws {AppError} 400 if content exceeds max length.
 * @throws {AppError} 400 if whisper recipient not found in session.
 */
export async function sendMessage(
  sessionId: string,
  senderId: string,
  senderName: string,
  channel: ChatChannel,
  content: string,
  recipientId?: string,
): Promise<ChatMessageItem> {
  // Validate content length
  if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new AppError(
      `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      400,
      'CHAT_MESSAGE_TOO_LONG',
    );
  }

  // Verify session exists
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { room: { select: { id: true } } },
  });

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  // For whispers, validate the recipient exists in the room
  if (channel === 'WHISPER') {
    if (!recipientId) {
      throw new AppError(
        'recipientId is required for whisper messages',
        400,
        'CHAT_WHISPER_NO_RECIPIENT',
      );
    }

    const recipientMembership = await prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId: session.room.id,
          userId: recipientId,
        },
      },
    });

    if (!recipientMembership) {
      throw new AppError(
        'Whisper recipient is not in this room',
        400,
        'CHAT_WHISPER_RECIPIENT_NOT_FOUND',
      );
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      senderId,
      senderName,
      channel,
      content,
      recipientId: recipientId ?? null,
    },
  });

  return serializeChatMessage(message);
}

/**
 * Send a system message (server-generated).
 *
 * @param sessionId - The game session ID.
 * @param content - The system message content.
 * @returns The persisted chat message.
 */
export async function sendSystemMessage(
  sessionId: string,
  content: string,
): Promise<ChatMessageItem> {
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      senderId: 'SYSTEM',
      senderName: 'System',
      channel: 'SYSTEM',
      content,
    },
  });

  return serializeChatMessage(message);
}

/**
 * Retrieve paginated chat message history for a session.
 *
 * @param sessionId - The game session ID.
 * @param userId - The requesting user's ID.
 * @param isDirector - Whether the user is the room's director.
 * @param page - Page number (1-based).
 * @param limit - Items per page.
 * @param channel - Optional channel filter.
 * @returns Paginated chat message history.
 */
export async function getChatHistory(
  sessionId: string,
  userId: string,
  isDirector: boolean,
  page: number,
  limit: number,
  channel?: ChatChannel,
): Promise<{ messages: ChatMessageItem[]; total: number; page: number; limit: number }> {
  // Build where clause:
  // - Directors see all messages.
  // - Players see all non-whisper messages + whispers they sent or received.
  const baseWhere: Prisma.ChatMessageWhereInput = {
    sessionId,
    ...(channel ? { channel } : {}),
  };

  const where: Prisma.ChatMessageWhereInput = isDirector
    ? baseWhere
    : {
        AND: [
          baseWhere,
          {
            OR: [
              { channel: { not: 'WHISPER' } },
              { channel: 'WHISPER', senderId: userId },
              { channel: 'WHISPER', recipientId: userId },
            ],
          },
        ],
      };

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chatMessage.count({ where }),
  ]);

  return {
    messages: messages.map(serializeChatMessage),
    total,
    page,
    limit,
  };
}
