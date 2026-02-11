import { create } from 'zustand';
import { getSocket, type TypedSocket } from '@/lib/socket';
import type {
  ChatMessageBroadcastPayload,
  ChatWhisperReceivedPayload,
} from '@dsvtt/events';
import type { ChatChannel } from '@dsvtt/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessageEntry {
  id: string;
  senderId: string;
  senderName: string;
  channel: ChatChannel;
  content: string;
  recipientId?: string;
  recipientName?: string;
  timestamp: string;
}

export interface WhisperTarget {
  id: string;
  name: string;
}

// ─── State interface ────────────────────────────────────────────────────────

interface ChatState {
  /** All chat messages in the current session. */
  messages: ChatMessageEntry[];
  /** Currently active chat channel tab. */
  activeChannel: 'ic' | 'ooc';
  /** Current whisper target (null = not whispering). */
  whisperTarget: WhisperTarget | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Send a chat message via Socket.IO. */
  sendMessage: (sessionId: string, content: string, channel: ChatChannel) => void;

  /** Send a whisper via Socket.IO. */
  sendWhisper: (sessionId: string, content: string, recipientId: string) => void;

  /** Fetch chat history from the server (REST). */
  fetchHistory: (sessionId: string) => Promise<void>;

  /** Switch the active channel tab. */
  setChannel: (channel: 'ic' | 'ooc') => void;

  /** Set or clear whisper target. */
  setWhisperTarget: (target: WhisperTarget | null) => void;

  /** Add a message to the list (used by socket listeners). */
  addMessage: (msg: ChatMessageEntry) => void;

  /** Clear all messages. */
  clearMessages: () => void;

  /** Wire up Socket.IO listeners. Returns cleanup function. */
  subscribeToSocket: () => () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  activeChannel: 'ooc',
  whisperTarget: null,

  sendMessage(sessionId: string, content: string, channel: ChatChannel) {
    const socket = getSocket();
    socket.emit('CHAT_MESSAGE', { sessionId, channel, content });
  },

  sendWhisper(sessionId: string, content: string, recipientId: string) {
    const socket = getSocket();
    socket.emit('CHAT_WHISPER', { sessionId, recipientId, content });
  },

  async fetchHistory(_sessionId: string) {
    // REST endpoint for history — placeholder for when backend is ready.
    // apiClient.get(`/api/sessions/${sessionId}/chat`)
  },

  setChannel(channel: 'ic' | 'ooc') {
    set({ activeChannel: channel });
  },

  setWhisperTarget(target: WhisperTarget | null) {
    set({ whisperTarget: target });
  },

  addMessage(msg: ChatMessageEntry) {
    set((state) => ({
      messages: [...state.messages, msg],
    }));
  },

  clearMessages() {
    set({ messages: [] });
  },

  subscribeToSocket() {
    const socket: TypedSocket = getSocket();

    const handleChatMessage = (payload: ChatMessageBroadcastPayload) => {
      const entry: ChatMessageEntry = {
        id: payload.messageId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        channel: payload.channel,
        content: payload.content,
        timestamp: payload.timestamp,
      };
      get().addMessage(entry);
    };

    const handleWhisperReceived = (payload: ChatWhisperReceivedPayload) => {
      const entry: ChatMessageEntry = {
        id: payload.messageId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        channel: 'whisper',
        content: payload.content,
        timestamp: payload.timestamp,
      };
      get().addMessage(entry);
    };

    socket.on('CHAT_MESSAGE_BROADCAST', handleChatMessage);
    socket.on('CHAT_WHISPER_RECEIVED', handleWhisperReceived);

    return () => {
      socket.off('CHAT_MESSAGE_BROADCAST', handleChatMessage);
      socket.off('CHAT_WHISPER_RECEIVED', handleWhisperReceived);
    };
  },
}));
