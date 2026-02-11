import { z } from 'zod';
import { MAX_CHAT_MESSAGE_LENGTH } from '@dsvtt/shared';

// ---------------------------------------------------------------------------
// Chat message schemas
// ---------------------------------------------------------------------------

/** Zod schema for sending a chat message via REST API. */
export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_CHAT_MESSAGE_LENGTH,
      `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
    )
    .trim(),
  channel: z.enum(['IC', 'OOC', 'WHISPER', 'SYSTEM']),
  recipientId: z.string().uuid('Invalid recipient ID').optional(),
}).refine(
  (data) => {
    // recipientId is required when channel is WHISPER
    if (data.channel === 'WHISPER' && !data.recipientId) {
      return false;
    }
    return true;
  },
  {
    message: 'recipientId is required for whisper messages',
    path: ['recipientId'],
  },
);

/** Inferred type for a validated send-message payload. */
export type SendMessageBody = z.infer<typeof sendMessageSchema>;

/** Zod schema for the chat history query string. */
export const chatHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  channel: z.enum(['IC', 'OOC', 'WHISPER', 'SYSTEM']).optional(),
});

/** Inferred type for validated chat history query params. */
export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>;
