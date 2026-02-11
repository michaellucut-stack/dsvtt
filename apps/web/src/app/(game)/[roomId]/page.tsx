'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { useSocketStore } from '@/stores/socket-store';
import { useMapStore } from '@/stores/map-store';
import { useDiceStore } from '@/stores/dice-store';
import { useChatStore } from '@/stores/chat-store';
import { useTurnStore } from '@/stores/turn-store';
import { MapCanvas } from '@/components/map/map-canvas';
import { DiceRoller } from '@/components/game/dice-roller';
import { ChatPanel } from '@/components/game/chat-panel';
import { TurnTracker } from '@/components/game/turn-tracker';
import { Loading } from '@/components/ui/loading';

// ─── Connection Status Indicator ────────────────────────────────────────────

function ConnectionIndicator() {
  const connected = useSocketStore((s) => s.connected);
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={[
          'h-2.5 w-2.5 rounded-full',
          connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(23,177,100,0.5)]' : 'bg-crimson-500',
        ].join(' ')}
      />
      <span className="text-xs text-parchment-400">
        {connected ? 'Connected' : 'Reconnecting...'}
      </span>
    </div>
  );
}

// ─── Sidebar Tab ────────────────────────────────────────────────────────────

type SidebarTab = 'chat' | 'dice' | 'characters';

function SidebarTabButton({
  tab,
  activeTab,
  onClick,
  label,
  icon,
}: {
  tab: SidebarTab;
  activeTab: SidebarTab;
  onClick: (tab: SidebarTab) => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={[
        'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold tracking-wider transition-colors',
        tab === activeTab
          ? 'border-gold-500 text-gold-400'
          : 'border-transparent text-parchment-400 hover:text-parchment-200',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Sidebar Placeholder Panel (Characters — still pending) ─────────────────

function CharactersPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mb-2 text-parchment-500"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <p className="text-sm text-parchment-400">Characters coming in Sprint 5</p>
    </div>
  );
}

// ─── Main Game Room Page ────────────────────────────────────────────────────

export default function GameRoomPage() {
  const params = useParams<{ roomId: string }>();
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const userId = useAuthStore((s) => s.user?.id);
  const mapLoading = useMapStore((s) => s.loading);
  const fetchMapState = useMapStore((s) => s.fetchMapState);

  const subscribeDice = useDiceStore((s) => s.subscribeToSocket);
  const subscribeChat = useChatStore((s) => s.subscribeToSocket);
  const subscribeTurn = useTurnStore((s) => s.subscribeToSocket);

  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isDirector = currentRoom?.directorId === userId;

  // Use roomId as a stand-in sessionId until game session management is wired.
  const sessionId = params.roomId;

  // Fetch map state for the room
  useEffect(() => {
    if (params.roomId) {
      fetchMapState(params.roomId);
    }
  }, [params.roomId, fetchMapState]);

  // Subscribe to Sprint 4 socket events (dice, chat, turn)
  useEffect(() => {
    const unsubDice = subscribeDice();
    const unsubChat = subscribeChat();
    const unsubTurn = subscribeTurn();

    return () => {
      unsubDice();
      unsubChat();
      unsubTurn();
    };
  }, [subscribeDice, subscribeChat, subscribeTurn]);

  return (
    <div className="flex h-screen w-screen flex-col bg-charcoal-950">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-charcoal-800 bg-charcoal-900/95 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-sm font-semibold text-parchment-100 tracking-wide">
            {currentRoom?.name ?? 'Game Room'}
          </h1>
          {currentRoom?.status && (
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
                currentRoom.status === 'active'
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : currentRoom.status === 'paused'
                    ? 'bg-gold-900/40 text-gold-400'
                    : 'bg-charcoal-700 text-parchment-400',
              ].join(' ')}
            >
              {currentRoom.status}
            </span>
          )}
          {isDirector && (
            <span className="rounded-full bg-crimson-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-crimson-400">
              Director
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <ConnectionIndicator />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="text-parchment-400 transition-colors hover:text-parchment-100"
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map Panel + Turn Tracker (~70%) */}
        <main
          className={[
            'relative flex flex-1 flex-col overflow-hidden',
            sidebarCollapsed ? '' : 'min-w-0',
          ].join(' ')}
        >
          {/* Turn tracker bar above the map */}
          <TurnTracker sessionId={sessionId} />

          {/* Map area */}
          <div className="relative flex-1 overflow-hidden">
            {mapLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loading size={48} />
              </div>
            ) : (
              <MapCanvas />
            )}
          </div>
        </main>

        {/* Sidebar (~30%) */}
        {!sidebarCollapsed && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-charcoal-800 bg-charcoal-900/60">
            {/* Tab bar */}
            <div className="flex shrink-0 border-b border-charcoal-800">
              <SidebarTabButton
                tab="chat"
                activeTab={activeTab}
                onClick={setActiveTab}
                label="CHAT"
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                }
              />
              <SidebarTabButton
                tab="dice"
                activeTab={activeTab}
                onClick={setActiveTab}
                label="DICE"
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                  </svg>
                }
              />
              <SidebarTabButton
                tab="characters"
                activeTab={activeTab}
                onClick={setActiveTab}
                label="PARTY"
                icon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                }
              />
            </div>

            {/* Tab content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {activeTab === 'chat' && <ChatPanel sessionId={sessionId} />}
              {activeTab === 'dice' && <DiceRoller sessionId={sessionId} />}
              {activeTab === 'characters' && <CharactersPlaceholder />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
