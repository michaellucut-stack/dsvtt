'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useCharacterStore,
  type Character,
  type CharacterStat,
  type InventoryItem,
} from '@/stores/character-store';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { DrawSteelWizard, type DrawSteelCharacterData } from '@/components/game/draw-steel-wizard';
import { useMapStore } from '@/stores/map-store';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1_000;

const TOKEN_PALETTE = [
  '#c0392b',
  '#e74c3c',
  '#9b59b6',
  '#8e44ad',
  '#2980b9',
  '#3498db',
  '#1abc9c',
  '#16a085',
  '#27ae60',
  '#2ecc71',
  '#f39c12',
  '#e67e22',
  '#d35400',
  '#e84393',
  '#6c5ce7',
  '#00b894',
  '#fdcb6e',
  '#e17055',
  '#0984e3',
  '#6ab04c',
];

/** Extract up to 2 initials from a name. E.g. "Goblin Scout" -> "GS", "Orc" -> "OR" */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Character Creation Form ────────────────────────────────────────────────

function CreateCharacterForm({ sessionId }: { sessionId: string }) {
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createCharacter({
        sessionId,
        name: name.trim(),
        stats: [],
        notes: '',
        inventory: [],
      });
    } catch {
      // error set in store
    } finally {
      setSubmitting(false);
    }
  };

  const handleWizardComplete = async (wizardData: DrawSteelCharacterData) => {
    setSubmitting(true);
    try {
      await createCharacter({
        sessionId,
        name: name.trim(),
        stats: [
          { key: 'Ancestry', value: wizardData.ancestry },
          { key: 'Class', value: wizardData.class },
          { key: 'Subclass', value: wizardData.subclass },
          { key: 'Kit', value: wizardData.kit },
          { key: 'Culture - Environment', value: wizardData.cultureEnvironment },
          { key: 'Culture - Organization', value: wizardData.cultureOrganization },
          { key: 'Culture - Upbringing', value: wizardData.cultureUpbringing },
          { key: 'Language', value: wizardData.language },
          { key: 'Career', value: wizardData.career },
          { key: 'Complication', value: wizardData.complication || '' },
          { key: 'Heroic Resource', value: wizardData.heroicResource },
          { key: 'Might', value: String(wizardData.might) },
          { key: 'Agility', value: String(wizardData.agility) },
          { key: 'Reason', value: String(wizardData.reason) },
          { key: 'Intuition', value: String(wizardData.intuition) },
          { key: 'Presence', value: String(wizardData.presence) },
          { key: 'Stamina', value: String(wizardData.stamina) },
          { key: 'Recoveries', value: String(wizardData.recoveries) },
          { key: 'Speed', value: String(wizardData.speed) },
        ],
        notes: `Ancestry Traits: ${wizardData.ancestryTraits?.join(', ') || 'None selected'}`,
        inventory: [],
      });
    } catch {
      // error set in store
    } finally {
      setSubmitting(false);
    }
  };

  if (showWizard) {
    return (
      <DrawSteelWizard
        name={name}
        sessionId={sessionId}
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-6 shadow-card">
        <div className="text-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-3 text-gold-500"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <h2 className="font-heading text-lg font-semibold text-parchment-100">
            Create Your Character
          </h2>
          <p className="mt-1 text-xs text-parchment-400">Name your adventurer to begin</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name"
            autoFocus
            className="w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-3.5 py-2.5 text-sm text-parchment-100 placeholder:text-charcoal-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
          />
          <Button type="submit" fullWidth disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Character'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={submitting || !name.trim()}
            onClick={() => setShowWizard(true)}
          >
            {submitting ? 'Creating...' : 'Create Draw Steel Character'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Token Setup Step ────────────────────────────────────────────────────────

interface TokenSetupStepProps {
  character: Character;
  onDone: () => void;
}

function TokenSetupStep({ character, onDone }: TokenSetupStepProps) {
  const [selectedColor, setSelectedColor] = useState<string>(TOKEN_PALETTE[0] ?? '#c0392b');
  const [placing, setPlacing] = useState(false);
  const addToken = useMapStore((s) => s.addToken);
  const currentMap = useMapStore((s) => s.currentMap);

  const initials = useMemo(() => getInitials(character.name), [character.name]);

  const handlePlaceToken = () => {
    if (!currentMap) return;
    setPlacing(true);

    // Place at grid center (roughly) so the token is visible
    const centerX = Math.floor(currentMap.gridWidth / 2);
    const centerY = Math.floor(currentMap.gridHeight / 2);

    addToken({
      mapId: currentMap.id,
      name: character.name,
      imageUrl: selectedColor,
      x: centerX,
      y: centerY,
      width: 1,
      height: 1,
      layer: 'token',
      visible: true,
    });

    // Small delay so the token gets created before we navigate away
    setTimeout(() => {
      setPlacing(false);
      onDone();
    }, 300);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5 rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-6 shadow-card">
        {/* Header */}
        <div className="text-center">
          <h2 className="font-heading text-lg font-semibold text-parchment-100">
            Choose Token Color
          </h2>
          <p className="mt-1 text-xs text-parchment-400">
            Pick a color for {character.name}&apos;s map token
          </p>
        </div>

        {/* Token Preview */}
        <div className="flex justify-center">
          <div
            className="flex items-center justify-center rounded-full shadow-lg transition-colors duration-200"
            style={{
              width: 80,
              height: 80,
              backgroundColor: selectedColor,
              border: '3px solid rgba(255, 204, 32, 0.6)',
            }}
          >
            <span
              className="text-xl font-bold text-white"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            >
              {initials}
            </span>
          </div>
        </div>

        {/* Color Palette Grid */}
        <div className="grid grid-cols-5 gap-2">
          {TOKEN_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className="relative flex h-9 w-full items-center justify-center rounded-md border-2 transition-all duration-150 hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: selectedColor === color ? '#ffcc20' : 'transparent',
                boxShadow: selectedColor === color ? '0 0 8px rgba(255, 204, 32, 0.5)' : 'none',
              }}
              aria-label={`Select color ${color}`}
            >
              {selectedColor === color && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button fullWidth disabled={placing || !currentMap} onClick={handlePlaceToken}>
            {placing ? 'Placing...' : !currentMap ? 'No Map Loaded' : 'Place Token on Map'}
          </Button>
          <Button variant="ghost" fullWidth onClick={onDone}>
            Skip
          </Button>
        </div>

        {!currentMap && (
          <p className="text-center text-[11px] text-parchment-500">
            No map is loaded yet. You can skip and place your token later.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stat Row ───────────────────────────────────────────────────────────────

function StatRow({
  stat,
  onChange,
  onDelete,
}: {
  stat: CharacterStat;
  onChange: (key: string, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2">
      <input
        type="text"
        value={stat.key}
        onChange={(e) => onChange(e.target.value, stat.value)}
        placeholder="Stat name"
        className="w-2/5 rounded border border-charcoal-600 bg-charcoal-800/60 px-2 py-1 font-heading text-xs font-semibold text-parchment-200 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
      />
      <input
        type="text"
        value={stat.value}
        onChange={(e) => onChange(stat.key, e.target.value)}
        placeholder="Value"
        className="w-2/5 rounded border border-charcoal-600 bg-charcoal-800/60 px-2 py-1 text-xs text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-crimson-400"
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
  );
}

// ─── Inventory Item Row ─────────────────────────────────────────────────────

function ItemRow({
  item,
  onChange,
  onDelete,
}: {
  item: InventoryItem;
  onChange: (name: string, description: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange(e.target.value, item.description)}
          placeholder="Item name"
          className="w-full rounded border border-charcoal-600 bg-charcoal-800/60 px-2 py-1 text-xs font-semibold text-parchment-100 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
        />
        <input
          type="text"
          value={item.description}
          onChange={(e) => onChange(item.name, e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded border border-charcoal-600 bg-charcoal-800/60 px-2 py-0.5 text-[11px] text-parchment-300 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="mt-1 shrink-0 text-charcoal-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-crimson-400"
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
  );
}

// ─── Character Sheet Editor ─────────────────────────────────────────────────

function CharacterEditor({ character }: { character: Character }) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const [name, setName] = useState(character.name);
  const [stats, setStats] = useState<CharacterStat[]>(character.stats);
  const [notes, setNotes] = useState(character.notes);
  const [inventory, setInventory] = useState<InventoryItem[]>(character.inventory);

  // Track if we need to sync from incoming socket updates
  const lastCharacterRef = useRef(character);
  useEffect(() => {
    // Only update local state from remote changes (not our own saves)
    if (lastCharacterRef.current.updatedAt !== character.updatedAt) {
      setName(character.name);
      setStats(character.stats);
      setNotes(character.notes);
      setInventory(character.inventory);
      lastCharacterRef.current = character;
    }
  }, [character]);

  // Debounced auto-save
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (changes: {
      name?: string;
      stats?: CharacterStat[];
      notes?: string;
      inventory?: InventoryItem[];
    }) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updateCharacter(character.id, changes);
        debounceTimerRef.current = null;
      }, DEBOUNCE_MS);
    },
    [character.id, updateCharacter],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    scheduleSave({ name: val, stats, notes, inventory });
  };

  const handleStatChange = (index: number, key: string, value: string) => {
    const next = stats.map((s, i) => (i === index ? { key, value } : s));
    setStats(next);
    scheduleSave({ name, stats: next, notes, inventory });
  };

  const handleAddStat = () => {
    const next = [...stats, { key: '', value: '' }];
    setStats(next);
  };

  const handleDeleteStat = (index: number) => {
    const next = stats.filter((_, i) => i !== index);
    setStats(next);
    scheduleSave({ name, stats: next, notes, inventory });
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    scheduleSave({ name, stats, notes: val, inventory });
  };

  const handleItemChange = (index: number, itemName: string, description: string) => {
    const next = inventory.map((item, i) =>
      i === index ? { ...item, name: itemName, description } : item,
    );
    setInventory(next);
    scheduleSave({ name, stats, notes, inventory: next });
  };

  const handleAddItem = () => {
    const next = [...inventory, { id: generateId(), name: '', description: '' }];
    setInventory(next);
  };

  const handleDeleteItem = (index: number) => {
    const next = inventory.filter((_, i) => i !== index);
    setInventory(next);
    scheduleSave({ name, stats, notes, inventory: next });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Parchment-style character sheet */}
      <div className="space-y-4 p-4">
        {/* Character Name */}
        <div className="rounded-panel border border-leather-800/30 bg-gradient-to-b from-leather-950/20 to-charcoal-900/60 p-4 shadow-card">
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full bg-transparent text-center font-heading text-xl font-bold text-parchment-100 placeholder:text-charcoal-500 focus:outline-none"
            placeholder="Character Name"
          />
          <div className="mt-1 h-px bg-gradient-to-r from-transparent via-leather-700/50 to-transparent" />
        </div>

        {/* Stats Section */}
        <div className="rounded-panel border border-leather-800/20 bg-gradient-to-b from-leather-950/10 to-charcoal-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-parchment-300">
              Abilities & Stats
            </h3>
            <button
              type="button"
              onClick={handleAddStat}
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
              Add Stat
            </button>
          </div>
          {stats.length === 0 ? (
            <p className="py-2 text-center text-xs italic text-charcoal-500">
              No stats yet. Click &ldquo;Add Stat&rdquo; to begin.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stats.map((stat, i) => (
                <StatRow
                  key={i}
                  stat={stat}
                  onChange={(key, value) => handleStatChange(i, key, value)}
                  onDelete={() => handleDeleteStat(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="rounded-panel border border-leather-800/20 bg-gradient-to-b from-leather-950/10 to-charcoal-900/40 p-4">
          <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-parchment-300">
            Notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Backstory, goals, important details..."
            rows={4}
            className="w-full rounded-card border border-charcoal-600 bg-charcoal-800/40 px-3 py-2 font-heading text-sm leading-relaxed text-parchment-200 placeholder:text-charcoal-500 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
          />
        </div>

        {/* Inventory Section */}
        <div className="rounded-panel border border-leather-800/20 bg-gradient-to-b from-leather-950/10 to-charcoal-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-parchment-300">
              Inventory
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
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
              Add Item
            </button>
          </div>
          {inventory.length === 0 ? (
            <p className="py-2 text-center text-xs italic text-charcoal-500">
              Your pack is empty. Add items to your inventory.
            </p>
          ) : (
            <div className="space-y-2">
              {inventory.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onChange={(itemName, desc) => handleItemChange(i, itemName, desc)}
                  onDelete={() => handleDeleteItem(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Character Sheet (entry point) ──────────────────────────────────────────

interface CharacterSheetProps {
  sessionId: string;
}

export function CharacterSheet({ sessionId }: CharacterSheetProps) {
  const myCharacter = useCharacterStore((s) => s.myCharacter);
  const characters = useCharacterStore((s) => s.characters);
  const setMyCharacter = useCharacterStore((s) => s.setMyCharacter);
  const userId = useAuthStore((s) => s.user?.id);

  // Track whether the token setup step has been completed (or skipped).
  // `null` means we haven't determined yet; `true` means done; `false` means show setup.
  const [tokenSetupDone, setTokenSetupDone] = useState<boolean | null>(null);

  // When myCharacter is first detected from an existing session (auto-detect),
  // skip the token setup since the character was created in a previous session/refresh.
  const autoDetectedRef = useRef(false);

  // Auto-detect the current player's character from the list
  useEffect(() => {
    if (myCharacter) return;
    if (!userId || characters.length === 0) return;

    const mine = characters.find((c) => c.userId === userId);
    if (mine) {
      autoDetectedRef.current = true;
      setMyCharacter(mine);
    }
  }, [myCharacter, userId, characters, setMyCharacter]);

  // When myCharacter becomes non-null, decide whether to show token setup.
  // If auto-detected (existing character from refresh), skip token setup.
  // If freshly created (not auto-detected), show token setup.
  useEffect(() => {
    if (!myCharacter) {
      setTokenSetupDone(null);
      return;
    }

    if (autoDetectedRef.current) {
      // Character was already in the session — skip token setup
      setTokenSetupDone(true);
    } else if (tokenSetupDone === null) {
      // Freshly created character — show token setup
      setTokenSetupDone(false);
    }
  }, [myCharacter, tokenSetupDone]);

  if (!myCharacter) {
    return <CreateCharacterForm sessionId={sessionId} />;
  }

  if (tokenSetupDone === false) {
    return <TokenSetupStep character={myCharacter} onDone={() => setTokenSetupDone(true)} />;
  }

  return <CharacterEditor character={myCharacter} />;
}
