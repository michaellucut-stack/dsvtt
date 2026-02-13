'use client';

import { useState, useCallback, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useNpcStore, type Npc, type NpcStat } from '@/stores/npc-store';
import { useNotesStore, type SharedNote } from '@/stores/notes-store';
import { useMapStore } from '@/stores/map-store';
import { useChatStore } from '@/stores/chat-store';
import { useDiceStore } from '@/stores/dice-store';
import { useTurnStore } from '@/stores/turn-store';
import { useCharacterStore } from '@/stores/character-store';
import { apiClient } from '@/lib/api';
import { evaluateDice } from '@dsvtt/dice-engine';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────────────────

type DirectorTab = 'npcs' | 'events' | 'secrets' | 'combat';

interface DirectorPanelProps {
  sessionId: string;
}

// ─── Tab Button ─────────────────────────────────────────────────────────────

function TabButton({
  tab,
  activeTab,
  onClick,
  label,
}: {
  tab: DirectorTab;
  activeTab: DirectorTab;
  onClick: (tab: DirectorTab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={[
        'flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
        tab === activeTab
          ? 'border-b-2 border-crimson-500 text-crimson-400'
          : 'border-b-2 border-transparent text-parchment-400 hover:text-parchment-200',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── NPC Inline Form ────────────────────────────────────────────────────────

function NpcForm({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const createNpc = useNpcStore((s) => s.createNpc);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<NpcStat[]>([{ key: '', value: '' }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddStat = () => {
    setStats((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleStatChange = (index: number, field: 'key' | 'value', val: string) => {
    setStats((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: val } : s)));
  };

  const handleRemoveStat = (index: number) => {
    setStats((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createNpc({
        sessionId,
        name: name.trim(),
        stats: stats.filter((s) => s.key.trim()),
        notes,
      });
      onDone();
    } catch {
      // error is set in store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-card border border-charcoal-700 bg-charcoal-800/50 p-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="NPC Name"
        className="w-full rounded-card border border-charcoal-600 bg-charcoal-900 px-3 py-1.5 text-sm text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-parchment-400">
            Stats
          </span>
          <button
            type="button"
            onClick={handleAddStat}
            className="text-[10px] text-gold-500 hover:text-gold-400"
          >
            + Add
          </button>
        </div>
        {stats.map((stat, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={stat.key}
              onChange={(e) => handleStatChange(i, 'key', e.target.value)}
              placeholder="Stat"
              className="w-1/2 rounded border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-xs text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
            />
            <input
              type="text"
              value={stat.value}
              onChange={(e) => handleStatChange(i, 'value', e.target.value)}
              placeholder="Value"
              className="w-1/2 rounded border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-xs text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleRemoveStat(i)}
              className="shrink-0 text-charcoal-500 hover:text-crimson-400"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes..."
        rows={2}
        className="w-full rounded-card border border-charcoal-600 bg-charcoal-900 px-3 py-1.5 text-sm text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !name.trim()} className="text-xs px-3 py-1.5">
          {submitting ? 'Creating...' : 'Create NPC'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="text-xs px-3 py-1.5">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── NPC Card ───────────────────────────────────────────────────────────────

function NpcCard({
  npc,
  expanded,
  onToggle,
  tokens,
}: {
  npc: Npc;
  expanded: boolean;
  onToggle: () => void;
  tokens: { id: string; name: string }[];
}) {
  const updateNpc = useNpcStore((s) => s.updateNpc);
  const deleteNpc = useNpcStore((s) => s.deleteNpc);
  const assignToken = useNpcStore((s) => s.assignToken);

  const [editName, setEditName] = useState(npc.name);
  const [editStats, setEditStats] = useState<NpcStat[]>(npc.stats);
  const [editNotes, setEditNotes] = useState(npc.notes);

  const handleSave = async () => {
    await updateNpc(npc.id, {
      name: editName,
      stats: editStats,
      notes: editNotes,
    });
  };

  const handleStatChange = (index: number, field: 'key' | 'value', val: string) => {
    setEditStats((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: val } : s)));
  };

  const handleTokenAssign = (e: ChangeEvent<HTMLSelectElement>) => {
    const tokenId = e.target.value || null;
    assignToken(npc.id, tokenId);
  };

  const statsPreview = npc.stats
    .slice(0, 3)
    .map((s) => `${s.key}: ${s.value}`)
    .join(' | ');

  return (
    <div className="rounded-card border border-charcoal-700/60 bg-charcoal-800/40">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-charcoal-700/30"
      >
        <div className="min-w-0">
          <span className="font-heading text-sm font-semibold text-parchment-100">{npc.name}</span>
          {!expanded && statsPreview && (
            <p className="truncate text-[10px] text-parchment-500 mt-0.5">{statsPreview}</p>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={[
            'shrink-0 text-parchment-500 transition-transform',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded edit area */}
      {expanded && (
        <div className="space-y-3 border-t border-charcoal-700/40 px-3 py-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-sm text-parchment-100 focus:border-gold-600 focus:outline-none"
          />

          {/* Stats editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-parchment-400">
                Stats
              </span>
              <button
                type="button"
                onClick={() => setEditStats((prev) => [...prev, { key: '', value: '' }])}
                className="text-[10px] text-gold-500 hover:text-gold-400"
              >
                + Add
              </button>
            </div>
            {editStats.map((stat, i) => (
              <div key={i} className="flex gap-1">
                <input
                  type="text"
                  value={stat.key}
                  onChange={(e) => handleStatChange(i, 'key', e.target.value)}
                  placeholder="Stat"
                  className="w-1/2 rounded border border-charcoal-600 bg-charcoal-900 px-2 py-0.5 text-[11px] text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => handleStatChange(i, 'value', e.target.value)}
                  placeholder="Value"
                  className="w-1/2 rounded border border-charcoal-600 bg-charcoal-900 px-2 py-0.5 text-[11px] text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEditStats((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-charcoal-500 hover:text-crimson-400"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="NPC notes..."
            rows={2}
            className="w-full rounded-card border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-xs text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
          />

          {/* Token assignment */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-parchment-400">
              Assign to Token
            </label>
            <select
              value={npc.tokenId ?? ''}
              onChange={handleTokenAssign}
              className="mt-1 w-full rounded border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-xs text-parchment-100 focus:border-gold-600 focus:outline-none"
            >
              <option value="">None</option>
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} className="text-xs px-3 py-1">
              Save
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => deleteNpc(npc.id)}
              className="text-xs px-3 py-1"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NPCs Tab ───────────────────────────────────────────────────────────────

function NpcsTab({ sessionId }: { sessionId: string }) {
  const npcs = useNpcStore((s) => s.npcs);
  const tokens = useMapStore((s) => s.tokens);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tokenOptions = tokens.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
          NPCs ({npcs.length})
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] font-semibold text-gold-500 hover:text-gold-400"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add NPC
          </button>
        )}
      </div>

      {showForm && <NpcForm sessionId={sessionId} onDone={() => setShowForm(false)} />}

      {npcs.length === 0 && !showForm ? (
        <p className="py-4 text-center text-xs text-charcoal-500">
          No NPCs yet. Click &ldquo;Add NPC&rdquo; to create one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {npcs.map((npc) => (
            <NpcCard
              key={npc.id}
              npc={npc}
              expanded={expandedId === npc.id}
              onToggle={() => setExpandedId((prev) => (prev === npc.id ? null : npc.id))}
              tokens={tokenOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── World Events Tab ───────────────────────────────────────────────────────

function WorldEventsTab({ sessionId }: { sessionId: string }) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const roll = useDiceStore((s) => s.roll);
  const [narrativeText, setNarrativeText] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const handleNarrate = useCallback(() => {
    const text = narrativeText.trim();
    if (!text) return;
    // Send as system message via chat
    sendMessage(sessionId, text, 'system');
    setNarrativeText('');
  }, [narrativeText, sessionId, sendMessage]);

  const handleTriggerRoll = useCallback(() => {
    roll(sessionId, '1d20', false);
  }, [sessionId, roll]);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
    const text = isPaused
      ? 'The Director has resumed the game.'
      : 'The Director has paused the game.';
    sendMessage(sessionId, text, 'system');
  }, [isPaused, sessionId, sendMessage]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
        World Events
      </h3>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleTriggerRoll}
          className="flex items-center gap-1.5 rounded-card border border-charcoal-600 bg-charcoal-800/60 px-3 py-1.5 text-xs text-parchment-200 transition-colors hover:border-gold-600 hover:bg-charcoal-700/60"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          </svg>
          Roll d20
        </button>

        <button
          type="button"
          onClick={handlePauseToggle}
          className={[
            'flex items-center gap-1.5 rounded-card border px-3 py-1.5 text-xs transition-colors',
            isPaused
              ? 'border-emerald-700 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
              : 'border-gold-700 bg-gold-900/30 text-gold-400 hover:bg-gold-900/50',
          ].join(' ')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {isPaused ? (
              <polygon points="5 3 19 12 5 21 5 3" />
            ) : (
              <>
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </>
            )}
          </svg>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Narrative text */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-parchment-400">
          Narrate Event
        </label>
        <textarea
          value={narrativeText}
          onChange={(e) => setNarrativeText(e.target.value)}
          placeholder="Describe what happens in the world..."
          rows={3}
          className="w-full rounded-card border border-charcoal-600 bg-charcoal-900 px-3 py-2 text-sm text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
        />
        <Button
          type="button"
          onClick={handleNarrate}
          disabled={!narrativeText.trim()}
          className="text-xs px-3 py-1.5"
        >
          Send as Narration
        </Button>
      </div>
    </div>
  );
}

// ─── Secret Notes Tab ───────────────────────────────────────────────────────

function SecretNotesTab({ sessionId }: { sessionId: string }) {
  const notes = useNotesStore((s) => s.notes);
  const createNote = useNotesStore((s) => s.createNote);
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);

  const directorNotes = notes.filter((n) => n.isDirectorOnly);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeSecretNote = directorNotes.find((n) => n.id === activeId) ?? null;
  const [editContent, setEditContent] = useState('');

  const handleCreate = async () => {
    try {
      const note = await createNote({
        sessionId,
        title: 'Untitled Secret Note',
        isDirectorOnly: true,
      });
      setActiveId(note.id);
      setEditContent('');
    } catch {
      // error set in store
    }
  };

  const handleSelectNote = (note: SharedNote) => {
    setActiveId(note.id);
    setEditContent(note.content);
  };

  const handleSave = () => {
    if (!activeSecretNote) return;
    updateNote(activeSecretNote.id, { content: editContent });
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
          Secret Notes
        </h3>
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-1 text-[10px] font-semibold text-gold-500 hover:text-gold-400"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>

      {/* Note list */}
      {directorNotes.length === 0 ? (
        <p className="py-4 text-center text-xs text-charcoal-500">
          No secret notes yet. Your private notes are hidden from players.
        </p>
      ) : (
        <div className="space-y-1">
          {directorNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => handleSelectNote(note)}
              className={[
                'w-full rounded-card px-3 py-2 text-left text-xs transition-colors',
                activeId === note.id
                  ? 'bg-crimson-900/30 text-parchment-100 border border-crimson-700/40'
                  : 'bg-charcoal-800/40 text-parchment-300 border border-transparent hover:bg-charcoal-700/40',
              ].join(' ')}
            >
              <span className="font-semibold">{note.title}</span>
              <span className="ml-2 text-[10px] text-charcoal-500">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      {activeSecretNote && (
        <div className="space-y-2 rounded-card border border-charcoal-700 bg-charcoal-800/30 p-3">
          <input
            type="text"
            value={activeSecretNote.title}
            onChange={(e) => updateNote(activeSecretNote.id, { title: e.target.value })}
            className="w-full rounded border border-charcoal-600 bg-charcoal-900 px-2 py-1 text-sm font-semibold text-parchment-100 focus:border-gold-600 focus:outline-none"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="w-full rounded-card border border-charcoal-600 bg-charcoal-900 px-3 py-2 text-sm text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
            placeholder="Write your secret notes here..."
          />
          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} className="text-xs px-3 py-1">
              Save
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                deleteNote(activeSecretNote.id);
                setActiveId(null);
              }}
              className="text-xs px-3 py-1"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Combat Tab ─────────────────────────────────────────────────────────────

interface Combatant {
  /** Unique identifier — matches userId for players, npcId for NPCs, or a random id for custom entries. */
  id: string;
  name: string;
  initiative: number;
  isNpc: boolean;
}

function CombatTab({ sessionId }: { sessionId: string }) {
  const isActive = useTurnStore((s) => s.isActive);
  const turnOrder = useTurnStore((s) => s.turnOrder);
  const roundNumber = useTurnStore((s) => s.roundNumber);
  const tokens = useMapStore((s) => s.tokens);
  const characters = useCharacterStore((s) => s.characters);
  const npcs = useNpcStore((s) => s.npcs);

  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [isPopulated, setIsPopulated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate combatants from characters (players) + NPCs on the map
  const populateCombatants = useCallback(() => {
    const entries: Combatant[] = [];
    const seenIds = new Set<string>();

    // Add player characters
    for (const char of characters) {
      if (!seenIds.has(char.userId)) {
        seenIds.add(char.userId);
        entries.push({
          id: char.userId,
          name: char.name,
          initiative: 0,
          isNpc: false,
        });
      }
    }

    // Add NPCs that have tokens on the map
    for (const npc of npcs) {
      if (!seenIds.has(npc.id)) {
        seenIds.add(npc.id);
        entries.push({
          id: npc.id,
          name: npc.name,
          initiative: 0,
          isNpc: true,
        });
      }
    }

    // Add any tokens that aren't already accounted for (e.g., map-placed NPCs without NPC records)
    for (const token of tokens) {
      if (!seenIds.has(token.id) && !seenIds.has(token.ownerId)) {
        seenIds.add(token.id);
        entries.push({
          id: token.id,
          name: token.name,
          initiative: 0,
          isNpc: token.layer === 'gm',
        });
      }
    }

    setCombatants(entries);
    setIsPopulated(true);
  }, [characters, npcs, tokens]);

  // Roll 2d10 for all combatants (Draw Steel initiative)
  const rollAllInitiative = useCallback(() => {
    setCombatants((prev) =>
      prev.map((c) => ({
        ...c,
        initiative: evaluateDice('2d10').total,
      })),
    );
  }, []);

  // Update a single combatant's initiative
  const updateInitiative = useCallback((id: string, value: number) => {
    setCombatants((prev) => prev.map((c) => (c.id === id ? { ...c, initiative: value } : c)));
  }, []);

  // Remove a combatant
  const removeCombatant = useCallback((id: string) => {
    setCombatants((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Add a custom combatant
  const addCustomCombatant = useCallback(() => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCombatants((prev) => [...prev, { id, name: 'New Combatant', initiative: 0, isNpc: true }]);
  }, []);

  // Toggle NPC status
  const toggleNpc = useCallback((id: string) => {
    setCombatants((prev) => prev.map((c) => (c.id === id ? { ...c, isNpc: !c.isNpc } : c)));
  }, []);

  // Update combatant name
  const updateName = useCallback((id: string, name: string) => {
    setCombatants((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  // Start combat — POST to set-order
  const startCombat = useCallback(async () => {
    if (combatants.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${sessionId}/turns/set-order`, {
        entries: combatants.map((c) => ({
          userId: c.id,
          name: c.name,
          initiative: c.initiative,
          isNpc: c.isNpc,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start combat');
    } finally {
      setSubmitting(false);
    }
  }, [combatants, sessionId]);

  // End combat — POST to clear
  const endCombat = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${sessionId}/turns/clear`);
      setCombatants([]);
      setIsPopulated(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end combat');
    } finally {
      setSubmitting(false);
    }
  }, [sessionId]);

  // Sort combatants by initiative descending for display
  const sortedCombatants = useMemo(
    () => [...combatants].sort((a, b) => b.initiative - a.initiative),
    [combatants],
  );

  // ── Active combat view ──────────────────────────────────────────────────

  if (isActive && turnOrder.length > 0) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
            Combat Active
          </h3>
          <span className="rounded-full bg-crimson-900/40 px-2 py-0.5 text-[10px] font-bold uppercase text-crimson-400">
            Round {roundNumber}
          </span>
        </div>

        {/* Active turn order (read-only) */}
        <div className="space-y-1">
          {turnOrder.map((entry, idx) => (
            <div
              key={entry.id}
              className={[
                'flex items-center gap-2 rounded-card border px-3 py-1.5',
                idx === useTurnStore.getState().currentTurnIndex
                  ? 'border-gold-600 bg-gold-900/20'
                  : entry.isNpc
                    ? 'border-charcoal-700/40 bg-crimson-950/10'
                    : 'border-charcoal-700/40 bg-charcoal-800/30',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                  idx === useTurnStore.getState().currentTurnIndex
                    ? 'bg-gold-600 text-charcoal-950'
                    : 'bg-charcoal-700 text-parchment-400',
                ].join(' ')}
              >
                {entry.initiative}
              </span>
              <span className="flex-1 text-xs font-semibold text-parchment-200">{entry.name}</span>
              {entry.isNpc && (
                <span className="text-[9px] font-bold uppercase text-crimson-500">NPC</span>
              )}
              {idx === useTurnStore.getState().currentTurnIndex && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="shrink-0 text-gold-400"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-crimson-400">{error}</p>}

        <Button
          type="button"
          variant="danger"
          onClick={endCombat}
          disabled={submitting}
          className="text-xs"
        >
          {submitting ? 'Ending...' : 'End Combat'}
        </Button>
      </div>
    );
  }

  // ── Setup combat view ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-parchment-300">
          Combat Setup
        </h3>
      </div>

      {!isPopulated ? (
        // Initial state — prompt to populate
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-center text-xs text-parchment-400">
            Populate the combatant list from characters and NPCs on the map, then set initiative
            order.
          </p>
          <Button type="button" onClick={populateCombatants} className="text-xs">
            Populate Combatants
          </Button>
        </div>
      ) : (
        <>
          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={rollAllInitiative}
              className="flex items-center gap-1 rounded-card border border-gold-700/50 bg-gold-900/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-400 transition-colors hover:bg-gold-900/40"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                <circle cx="16" cy="16" r="1.5" fill="currentColor" />
              </svg>
              Roll All (2d10)
            </button>
            <button
              type="button"
              onClick={addCustomCombatant}
              className="flex items-center gap-1 rounded-card border border-charcoal-600 bg-charcoal-800/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-parchment-400 transition-colors hover:border-charcoal-500 hover:text-parchment-200"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Custom
            </button>
            <button
              type="button"
              onClick={populateCombatants}
              className="flex items-center gap-1 rounded-card border border-charcoal-600 bg-charcoal-800/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-parchment-400 transition-colors hover:border-charcoal-500 hover:text-parchment-200"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Re-scan
            </button>
          </div>

          {/* Combatant list */}
          {sortedCombatants.length === 0 ? (
            <p className="py-4 text-center text-xs text-charcoal-500">
              No combatants found. Add characters or NPCs to the session first.
            </p>
          ) : (
            <div className="space-y-1">
              {sortedCombatants.map((c) => (
                <div
                  key={c.id}
                  className={[
                    'flex items-center gap-1.5 rounded-card border px-2 py-1.5',
                    c.isNpc
                      ? 'border-crimson-900/30 bg-crimson-950/10'
                      : 'border-charcoal-700/40 bg-charcoal-800/30',
                  ].join(' ')}
                >
                  {/* Initiative input */}
                  <input
                    type="number"
                    value={c.initiative}
                    onChange={(e) => updateInitiative(c.id, parseInt(e.target.value, 10) || 0)}
                    className="w-10 rounded border border-charcoal-600 bg-charcoal-900 px-1.5 py-0.5 text-center text-xs font-bold text-gold-400 focus:border-gold-600 focus:outline-none"
                  />

                  {/* Name (editable) */}
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateName(c.id, e.target.value)}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold text-parchment-200 hover:border-charcoal-600 focus:border-gold-600 focus:bg-charcoal-900 focus:outline-none"
                  />

                  {/* NPC toggle */}
                  <button
                    type="button"
                    onClick={() => toggleNpc(c.id)}
                    className={[
                      'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors',
                      c.isNpc
                        ? 'bg-crimson-900/40 text-crimson-400 hover:bg-crimson-900/60'
                        : 'bg-charcoal-700/40 text-parchment-500 hover:bg-charcoal-700/60',
                    ].join(' ')}
                  >
                    {c.isNpc ? 'NPC' : 'PC'}
                  </button>

                  {/* Roll single initiative */}
                  <button
                    type="button"
                    onClick={() => updateInitiative(c.id, evaluateDice('2d10').total)}
                    title="Roll 2d10"
                    className="shrink-0 text-parchment-500 transition-colors hover:text-gold-400"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="3" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeCombatant(c.id)}
                    className="shrink-0 text-charcoal-500 transition-colors hover:text-crimson-400"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-crimson-400">{error}</p>}

          {/* Start Combat button */}
          <Button
            type="button"
            onClick={startCombat}
            disabled={submitting || combatants.length === 0}
            className="text-xs"
          >
            {submitting ? 'Starting...' : `Start Combat (${combatants.length})`}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Director Panel ─────────────────────────────────────────────────────────

export function DirectorPanel({ sessionId }: DirectorPanelProps) {
  const [activeTab, setActiveTab] = useState<DirectorTab>('npcs');

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-charcoal-800">
        <TabButton tab="combat" activeTab={activeTab} onClick={setActiveTab} label="Combat" />
        <TabButton tab="npcs" activeTab={activeTab} onClick={setActiveTab} label="NPCs" />
        <TabButton tab="events" activeTab={activeTab} onClick={setActiveTab} label="Events" />
        <TabButton tab="secrets" activeTab={activeTab} onClick={setActiveTab} label="Secrets" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'combat' && <CombatTab sessionId={sessionId} />}
        {activeTab === 'npcs' && <NpcsTab sessionId={sessionId} />}
        {activeTab === 'events' && <WorldEventsTab sessionId={sessionId} />}
        {activeTab === 'secrets' && <SecretNotesTab sessionId={sessionId} />}
      </div>
    </div>
  );
}
