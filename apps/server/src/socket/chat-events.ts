import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@dsvtt/shared';
import { GameEventType, MAX_CHAT_MESSAGE_LENGTH } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { chatMessageSchema, chatWhisperSchema } from '@dsvtt/events';
import type { ChatChannel } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { logEvent } from '../services/event-store.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * Map event-schema channel values (lowercase) to Prisma ChatChannel enum.
 */
const channelMap: Record<string, ChatChannel> = {
  ic: 'IC',
  ooc: 'OOC',
  whisper: 'WHISPER',
  system: 'SYSTEM',
};

/**
 * Register chat-related Socket.IO event handlers on a connected socket.
 *
 * Handles:
 * - `CHAT_MESSAGE`: Client sends a message on a channel. Server persists
 *   and broadcasts CHAT_MESSAGE_BROADCAST to the room.
 * - `CHAT_WHISPER`: Client sends a private whisper. Server persists and
 *   delivers CHAT_WHISPER_RECEIVED only to sender, recipient, and
 *   director.
 *
 * @param io - The Socket.IO server instance.
 * @param socket - The authenticated client socket.
 */
export function registerChatEvents(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user!;

  // ── CHAT_MESSAGE ───────────────────────────────────────────────────
  socket.on('CHAT_MESSAGE', async (payload) => {
    try {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, channel, content } = parsed.data;

      // Validate content length
      if (content.length > MAX_CHAT_MESSAGE_LENGTH) return;

      // Players cannot send SYSTEM messages
      if (channel === 'system') return;

      // Look up session and verify room membership
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Look up display name
      const dbUser = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true },
      });
      if (!dbUser) return;

      // Map channel to Prisma enum
      const prismaChannel = channelMap[channel];
      if (!prismaChannel) return;

      // Persist to database
      const message = await prisma.chatMessage.create({
        data: {
          sessionId,
          senderId: user.sub,
          senderName: dbUser.displayName,
          channel: prismaChannel,
          content,
        },
      });

      // Broadcast to all room members
      io.to(roomId).emit('CHAT_MESSAGE_BROADCAST', {
        messageId: message.id,
        sessionId,
        senderId: user.sub,
        senderName: dbUser.displayName,
        channel: channel as 'ic' | 'ooc' | 'whisper' | 'system',
        content,
        timestamp: message.timestamp.toISOString(),
      });

      // Log event
      logEvent({
        sessionId,
        eventType: GameEventType.CHAT_MESSAGE,
        payload: { messageId: message.id, channel, content, senderName: dbUser.displayName },
        actorId: user.sub,
        actorType: 'PLAYER',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('CHAT_MESSAGE handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });

  // ── CHAT_WHISPER ───────────────────────────────────────────────────
  socket.on('CHAT_WHISPER', async (payload) => {
    try {
      const parsed = chatWhisperSchema.safeParse(payload);
      if (!parsed.success) return;

      const { sessionId, recipientId, content } = parsed.data;

      // Validate content length
      if (content.length > MAX_CHAT_MESSAGE_LENGTH) return;

      // Look up session and room details (including director)
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: { select: { id: true, directorId: true } } },
      });
      if (!session) return;

      const roomId = session.room.id;
      if (!socket.rooms.has(roomId)) return;

      // Verify the recipient is in the room
      const recipientMembership = await prisma.roomPlayer.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: recipientId,
          },
        },
      });

      if (!recipientMembership) return;

      // Look up display name
      const dbUser = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true },
      });
      if (!dbUser) return;

      // Persist to database
      const message = await prisma.chatMessage.create({
        data: {
          sessionId,
          senderId: user.sub,
          senderName: dbUser.displayName,
          channel: 'WHISPER',
          content,
          recipientId,
        },
      });

      const whisperPayload = {
        messageId: message.id,
        sessionId,
        senderId: user.sub,
        senderName: dbUser.displayName,
        content,
        timestamp: message.timestamp.toISOString(),
      };

      // Deliver only to sender, recipient, and director
      const targetUserIds = new Set<string>([
        user.sub,
        recipientId,
        session.room.directorId,
      ]);

      const roomSockets = await io.in(roomId).fetchSockets();
      for (const roomSocket of roomSockets) {
        const socketUserId = roomSocket.data.user?.sub;
        if (socketUserId && targetUserIds.has(socketUserId)) {
          roomSocket.emit('CHAT_WHISPER_RECEIVED', whisperPayload);
        }
      }

      // Log event
      logEvent({
        sessionId,
        eventType: GameEventType.CHAT_WHISPER,
        payload: { messageId: message.id, recipientId, content, senderName: dbUser.displayName },
        actorId: user.sub,
        actorType: 'PLAYER',
      }).catch((err) => logger.error('Event logging failed', { context: 'event-store', error: String(err) }));
    } catch (err) {
      logger.error('CHAT_WHISPER handler error', {
        context: 'socket',
        error: String(err),
      });
    }
  });
}
