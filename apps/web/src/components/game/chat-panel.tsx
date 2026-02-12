'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useChatStore, type ChatMessageEntry, type WhisperTarget } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { MAX_CHAT_MESSAGE_LENGTH } from '@dsvtt/shared';
import type { ChatChannel } from '@dsvtt/shared';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Check if a message content looks like a dice roll result (e.g., "rolled 2d6+3: [4, 2] = 9"). */
function isDiceRollMessage(content: string): boolean {
  return /^rolled\s+\d+d\d+/i.test(content);
}

// ─── Channel Tab Button ─────────────────────────────────────────────────────

function ChannelTab({
  channel,
  activeChannel,
  onClick,
  label,
}: {
  channel: 'ic' | 'ooc';
  activeChannel: 'ic' | 'ooc';
  onClick: (ch: 'ic' | 'ooc') => void;
  label: string;
}) {
  const isActive = channel === activeChannel;

  return (
    <button
      type="button"
      onClick={() => onClick(channel)}
      className={[
        'flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
        isActive
          ? channel === 'ic'
            ? 'bg-leather-900/40 text-parchment-200 border-b-2 border-leather-500'
            : 'bg-charcoal-800/60 text-parchment-200 border-b-2 border-gold-500'
          : 'text-charcoal-400 hover:text-parchment-300 border-b-2 border-transparent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Chat Message Bubble ────────────────────────────────────────────────────

function ChatBubble({
  msg,
  isOwn,
  currentUserId,
}: {
  msg: ChatMessageEntry;
  isOwn: boolean;
  currentUserId: string | undefined;
}) {
  // System messages
  if (msg.channel === 'system') {
    return (
      <div className="px-3 py-1.5 text-center">
        <span className="text-[11px] italic text-charcoal-400">{msg.content}</span>
      </div>
    );
  }

  // Whisper messages
  if (msg.channel === 'whisper') {
    const isFromMe = msg.senderId === currentUserId;
    const label = isFromMe
      ? `whisper to ${msg.recipientName ?? 'someone'}`
      : `whisper from ${msg.senderName}`;

    return (
      <div className="group px-3 py-1.5">
        <div className="rounded-card border border-purple-800/30 bg-purple-950/20 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-400"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              {label}
            </span>
            <span className="ml-auto text-[10px] text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <p className="mt-1 text-sm text-purple-200">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Dice roll messages (special formatting)
  if (isDiceRollMessage(msg.content)) {
    return (
      <div className="group px-3 py-1.5">
        <div className="rounded-card border border-gold-800/30 bg-gold-950/10 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-gold-400"
            >
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" />
            </svg>
            <span
              className={[
                'text-[10px] font-semibold',
                isOwn ? 'text-gold-400' : 'text-parchment-300',
              ].join(' ')}
            >
              {msg.senderName}
            </span>
            <span className="ml-auto text-[10px] text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-gold-300">{msg.content}</p>
        </div>
      </div>
    );
  }

  // IC messages — parchment/serif style
  if (msg.channel === 'ic') {
    return (
      <div className="group px-3 py-1.5">
        <div className="rounded-card border border-leather-800/30 bg-leather-950/15 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'font-heading text-[11px] font-semibold',
                isOwn ? 'text-gold-400' : 'text-parchment-200',
              ].join(' ')}
            >
              {msg.senderName}
            </span>
            <span className="ml-auto text-[10px] text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <p className="mt-1 font-heading text-sm leading-relaxed text-parchment-300 italic">
            &ldquo;{msg.content}&rdquo;
          </p>
        </div>
      </div>
    );
  }

  // OOC messages — normal style
  return (
    <div className="group px-3 py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span
          className={['text-xs font-semibold', isOwn ? 'text-gold-400' : 'text-parchment-300'].join(
            ' ',
          )}
        >
          {msg.senderName}
        </span>
        <span className="text-[10px] text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(msg.timestamp)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-parchment-200">{msg.content}</p>
    </div>
  );
}

// ─── Whisper Indicator Bar ──────────────────────────────────────────────────

function WhisperIndicator({ target, onCancel }: { target: WhisperTarget; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-purple-800/30 bg-purple-950/20 px-3 py-1.5">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-purple-400"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="text-xs text-purple-300">
        Whispering to <strong className="text-purple-200">{target.name}</strong>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto text-[10px] text-purple-400 transition-colors hover:text-purple-200"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Main Chat Panel ────────────────────────────────────────────────────────

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((s) => s.messages);
  const activeChannel = useChatStore((s) => s.activeChannel);
  const whisperTarget = useChatStore((s) => s.whisperTarget);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendWhisper = useChatStore((s) => s.sendWhisper);
  const setChannel = useChatStore((s) => s.setChannel);
  const setWhisperTarget = useChatStore((s) => s.setWhisperTarget);

  const userId = useAuthStore((s) => s.user?.id);

  // Filter messages by active channel + always show system and whisper
  const filteredMessages = messages.filter((m) => {
    if (m.channel === 'system') return true;
    if (m.channel === 'whisper') return true;
    return m.channel === activeChannel;
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  const sessionReady = !!sessionId;

  const handleSend = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return;
      if (!sessionId) return; // Guard: session not loaded yet

      if (whisperTarget) {
        sendWhisper(sessionId, trimmed, whisperTarget.id);
      } else {
        const channel: ChatChannel = activeChannel;
        sendMessage(sessionId, trimmed, channel);
      }

      setInput('');
    },
    [input, sessionId, activeChannel, whisperTarget, sendMessage, sendWhisper],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(e as unknown as FormEvent);
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── Channel tabs ────────────────────────────────────────────────── */}
      <div className="flex shrink-0">
        <ChannelTab
          channel="ic"
          activeChannel={activeChannel}
          onClick={setChannel}
          label="In Character"
        />
        <ChannelTab channel="ooc" activeChannel={activeChannel} onClick={setChannel} label="OOC" />
      </div>

      {/* ── Message list ────────────────────────────────────────────────── */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-2 text-charcoal-600"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-xs text-charcoal-500">No messages yet</p>
            <p className="text-[10px] text-charcoal-600">
              {activeChannel === 'ic'
                ? 'Speak in character to begin'
                : 'Start chatting with your party'}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {filteredMessages.map((msg) => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.senderId === userId}
                currentUserId={userId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Whisper indicator ───────────────────────────────────────────── */}
      {whisperTarget && (
        <WhisperIndicator target={whisperTarget} onCancel={() => setWhisperTarget(null)} />
      )}

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSend} className="shrink-0 border-t border-charcoal-800 p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !sessionReady
                ? 'Connecting to session...'
                : whisperTarget
                  ? `Whisper to ${whisperTarget.name}...`
                  : activeChannel === 'ic'
                    ? 'Speak in character...'
                    : 'Type a message...'
            }
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            className={[
              'flex-1 rounded-card border bg-charcoal-800/80 px-3 py-2',
              'text-sm text-parchment-100 placeholder:text-charcoal-500',
              'focus:outline-none focus:ring-1',
              whisperTarget
                ? 'border-purple-700/40 focus:border-purple-600 focus:ring-purple-500/40'
                : activeChannel === 'ic'
                  ? 'border-leather-800/40 focus:border-leather-600 focus:ring-leather-500/40'
                  : 'border-charcoal-600 focus:border-gold-600 focus:ring-gold-500/40',
            ].join(' ')}
          />
          <button
            type="submit"
            disabled={!input.trim() || !sessionReady}
            className={[
              'shrink-0 rounded-card px-3 py-2',
              'transition-all duration-150',
              'disabled:cursor-not-allowed disabled:opacity-40',
              whisperTarget
                ? 'bg-purple-700 text-purple-100 hover:bg-purple-600'
                : 'bg-charcoal-700 text-parchment-300 hover:bg-charcoal-600 hover:text-parchment-100',
            ].join(' ')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
