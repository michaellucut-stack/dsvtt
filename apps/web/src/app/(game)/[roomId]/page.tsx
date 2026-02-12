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
import { useNpcStore } from '@/stores/npc-store';
import { useCharacterStore } from '@/stores/character-store';
import { useNotesStore } from '@/stores/notes-store';
import { MapCanvas } from '@/components/map/map-canvas';
import { DiceRoller } from '@/components/game/dice-roller';
import { ChatPanel } from '@/components/game/chat-panel';
import { TurnTracker } from '@/components/game/turn-tracker';
import { DirectorPanel } from '@/components/game/director-panel';
import { CharacterSheet } from '@/components/game/character-sheet';
import { SharedNotes } from '@/components/game/shared-notes';
import { SearchBar } from '@/components/game/search-bar';
import { ResizablePanels } from '@/components/layout/resizable-panels';
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

type SidebarTab = 'chat' | 'dice' | 'characters' | 'notes' | 'director';

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
        'flex flex-1 items-center justify-center gap-1 border-b-2 px-2 py-2 text-[10px] font-semibold tracking-wider transition-colors',
        tab === activeTab
          ? tab === 'director'
            ? 'border-crimson-500 text-crimson-400'
            : 'border-gold-500 text-gold-400'
          : 'border-transparent text-parchment-400 hover:text-parchment-200',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── SVG Icons ──────────────────────────────────────────────────────────────

const ChatIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const DiceIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="20" height="20" rx="3" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const PartyIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const NotesIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const DirectorIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

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
  const subscribeNpc = useNpcStore((s) => s.subscribeToSocket);
  const subscribeCharacter = useCharacterStore((s) => s.subscribeToSocket);
  const subscribeNotes = useNotesStore((s) => s.subscribeToSocket);

  const fetchNpcs = useNpcStore((s) => s.fetchNpcs);
  const fetchCharacters = useCharacterStore((s) => s.fetchCharacters);
  const fetchNotes = useNotesStore((s) => s.fetchNotes);

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

  // Fetch Sprint 5 data (NPCs, characters, notes)
  useEffect(() => {
    if (!sessionId) return;
    fetchNpcs(sessionId);
    fetchCharacters(sessionId);
    fetchNotes(sessionId);
  }, [sessionId, fetchNpcs, fetchCharacters, fetchNotes]);

  // Subscribe to all socket events (Sprint 4 + Sprint 5)
  useEffect(() => {
    const unsubDice = subscribeDice();
    const unsubChat = subscribeChat();
    const unsubTurn = subscribeTurn();
    const unsubNpc = subscribeNpc();
    const unsubCharacter = subscribeCharacter();
    const unsubNotes = subscribeNotes();

    return () => {
      unsubDice();
      unsubChat();
      unsubTurn();
      unsubNpc();
      unsubCharacter();
      unsubNotes();
    };
  }, [subscribeDice, subscribeChat, subscribeTurn, subscribeNpc, subscribeCharacter, subscribeNotes]);

  // ── Sidebar content ─────────────────────────────────────────────────────

  const sidebarContent = (
    <aside className="flex h-full flex-col border-l border-charcoal-800 bg-charcoal-900/60">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-charcoal-800">
        <SidebarTabButton tab="chat" activeTab={activeTab} onClick={setActiveTab} label="CHAT" icon={ChatIcon} />
        <SidebarTabButton tab="dice" activeTab={activeTab} onClick={setActiveTab} label="DICE" icon={DiceIcon} />
        <SidebarTabButton tab="characters" activeTab={activeTab} onClick={setActiveTab} label="PARTY" icon={PartyIcon} />
        <SidebarTabButton tab="notes" activeTab={activeTab} onClick={setActiveTab} label="NOTES" icon={NotesIcon} />
        {isDirector && (
          <SidebarTabButton tab="director" activeTab={activeTab} onClick={setActiveTab} label="DM" icon={DirectorIcon} />
        )}
      </div>

      {/* Tab content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'chat' && <ChatPanel sessionId={sessionId} />}
        {activeTab === 'dice' && <DiceRoller sessionId={sessionId} />}
        {activeTab === 'characters' && <CharacterSheet sessionId={sessionId} />}
        {activeTab === 'notes' && <SharedNotes sessionId={sessionId} />}
        {activeTab === 'director' && isDirector && (
          <DirectorPanel sessionId={sessionId} />
        )}
      </div>
    </aside>
  );

  // ── Map content ─────────────────────────────────────────────────────────

  const mapContent = (
    <main className="relative flex h-full flex-col overflow-hidden">
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
  );

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
          <SearchBar sessionId={sessionId} />
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

      {/* ── Main Content with Resizable Panels ───────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {sidebarCollapsed ? (
          /* No sidebar — map fills the entire space */
          <div className="h-full">{mapContent}</div>
        ) : (
          <ResizablePanels
            storageKey="dsvtt-game-panels"
            panels={[
              {
                id: 'map',
                flex: true,
                children: mapContent,
              },
              {
                id: 'sidebar',
                defaultWidth: 360,
                minWidth: 280,
                maxWidth: 600,
                children: sidebarContent,
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
