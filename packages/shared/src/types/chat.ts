/**
 * Chat channel type.
 * - `ic`: In-character speech
 * - `ooc`: Out-of-character table talk
 * - `whisper`: Private message between two players
 * - `system`: System-generated messages
 */
export type ChatChannel = 'ic' | 'ooc' | 'whisper' | 'system';

/** A single chat message within a game session. */
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  content: string;
  /** Required when channel is 'whisper'. */
  recipientId?: string;
  timestamp: Date;
}
