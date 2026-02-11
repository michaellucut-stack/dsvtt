'use client';

import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useDiceStore, type DiceRollEntry } from '@/stores/dice-store';
import { useAuthStore } from '@/stores/auth-store';
import { DICE_FORMULA_MAX_LENGTH } from '@dsvtt/shared';

// ─── Quick-roll dice definitions ────────────────────────────────────────────

interface QuickDie {
  label: string;
  formula: string;
  /** SVG path for the die shape silhouette. */
  shape: string;
}

const QUICK_DICE: QuickDie[] = [
  {
    label: 'd4',
    formula: '1d4',
    shape: 'M12 2L2 22h20L12 2z',
  },
  {
    label: 'd6',
    formula: '1d6',
    shape: 'M4 4h16v16H4z',
  },
  {
    label: 'd8',
    formula: '1d8',
    shape: 'M12 1L1 12l11 11 11-11L12 1z',
  },
  {
    label: 'd10',
    formula: '1d10',
    shape: 'M12 1L2 9l4 14h12l4-14L12 1z',
  },
  {
    label: 'd12',
    formula: '1d12',
    shape: 'M12 1l-8 5.5v11L12 23l8-5.5v-11L12 1z',
  },
  {
    label: 'd20',
    formula: '1d20',
    shape: 'M12 1L1.5 8v8L12 23l10.5-7V8L12 1z',
  },
  {
    label: 'd100',
    formula: '1d100',
    shape: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDieResults(entry: DiceRollEntry): string {
  return entry.results
    .map((d) => {
      let s = String(d.result);
      if (d.dropped) s = `~${s}~`;
      if (d.exploded) s = `${s}!`;
      return s;
    })
    .join(', ');
}

// ─── Quick Die Button ───────────────────────────────────────────────────────

function QuickDieButton({
  die,
  onClick,
  disabled,
}: {
  die: QuickDie;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Roll ${die.formula}`}
      className={[
        'group relative flex h-10 w-10 flex-col items-center justify-center rounded-card',
        'border border-charcoal-600 bg-charcoal-800/80',
        'text-[10px] font-bold uppercase tracking-wide text-parchment-300',
        'transition-all duration-150',
        'hover:border-gold-600 hover:bg-charcoal-700 hover:text-gold-400 hover:shadow-glow',
        'active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
      ].join(' ')}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-30 transition-opacity group-hover:opacity-50"
      >
        <path d={die.shape} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
        {die.label}
      </span>
    </button>
  );
}

// ─── Roll History Entry ─────────────────────────────────────────────────────

function RollHistoryItem({ entry, isOwn }: { entry: DiceRollEntry; isOwn: boolean }) {
  return (
    <div
      className={[
        'rounded-card border px-3 py-2',
        entry.isPrivate
          ? 'border-purple-700/40 bg-purple-950/20'
          : 'border-charcoal-700 bg-charcoal-800/40',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={[
            'text-xs font-semibold',
            isOwn ? 'text-gold-400' : 'text-parchment-300',
          ].join(' ')}
        >
          {entry.playerName}
        </span>
        <div className="flex items-center gap-1.5">
          {entry.isPrivate && (
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
          )}
          <span className="text-[10px] text-charcoal-400">
            {formatTime(entry.timestamp)}
          </span>
        </div>
      </div>

      {/* Formula + result */}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-xs text-parchment-400">{entry.formula}</span>
        <span className="text-[10px] text-charcoal-400">
          [{formatDieResults(entry)}]
        </span>
      </div>

      {/* Total */}
      <div className="mt-1">
        <span className="font-heading text-lg font-bold text-gold-400">
          {entry.total}
        </span>
      </div>
    </div>
  );
}

// ─── Rolling Animation ──────────────────────────────────────────────────────

function RollingIndicator() {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="animate-spin text-gold-400"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <span className="animate-pulse text-sm font-semibold text-gold-400">
        Rolling...
      </span>
    </div>
  );
}

// ─── Main Dice Roller Component ─────────────────────────────────────────────

interface DiceRollerProps {
  sessionId: string;
}

export function DiceRoller({ sessionId }: DiceRollerProps) {
  const [formula, setFormula] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const rollHistory = useDiceStore((s) => s.rollHistory);
  const isRolling = useDiceStore((s) => s.isRolling);
  const roll = useDiceStore((s) => s.roll);
  const userId = useAuthStore((s) => s.user?.id);

  const handleRoll = useCallback(
    (diceFormula: string) => {
      const trimmed = diceFormula.trim();
      if (!trimmed || trimmed.length > DICE_FORMULA_MAX_LENGTH) return;
      roll(sessionId, trimmed, isPrivate);
      setFormula('');
    },
    [sessionId, isPrivate, roll],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      handleRoll(formula);
    },
    [formula, handleRoll],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRoll(formula);
      }
    },
    [formula, handleRoll],
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── Quick-roll buttons ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-charcoal-800 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-charcoal-400">
          Quick Roll
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DICE.map((die) => (
            <QuickDieButton
              key={die.label}
              die={die}
              onClick={() => handleRoll(die.formula)}
              disabled={isRolling}
            />
          ))}
        </div>
      </div>

      {/* ── Formula input bar ───────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-b border-charcoal-800 p-3"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="2d6+3"
            maxLength={DICE_FORMULA_MAX_LENGTH}
            disabled={isRolling}
            className={[
              'flex-1 rounded-card border bg-charcoal-800/80 px-3 py-2',
              'font-mono text-sm text-parchment-100 placeholder:text-charcoal-500',
              'border-charcoal-600 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40',
              'disabled:opacity-50',
            ].join(' ')}
          />
          <button
            type="submit"
            disabled={isRolling || !formula.trim()}
            className={[
              'shrink-0 rounded-card border border-gold-600 bg-gold-600 px-4 py-2',
              'font-heading text-xs font-bold uppercase tracking-wider text-charcoal-950',
              'transition-all duration-150',
              'hover:bg-gold-500 hover:shadow-glow',
              'active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            Roll
          </button>
        </div>

        {/* Private roll checkbox */}
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-charcoal-600 bg-charcoal-800 text-gold-600 focus:ring-gold-500/40"
          />
          <span className="flex items-center gap-1 text-xs text-parchment-400">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Private roll (Director only)
          </span>
        </label>
      </form>

      {/* ── Rolling indicator ───────────────────────────────────────────── */}
      {isRolling && <RollingIndicator />}

      {/* ── Roll history ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {rollHistory.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-2 text-charcoal-600"
            >
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="16" cy="8" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="8" cy="16" r="1.5" fill="currentColor" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" />
            </svg>
            <p className="text-xs text-charcoal-500">No rolls yet</p>
            <p className="text-[10px] text-charcoal-600">
              Use the buttons above or type a formula
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rollHistory.map((entry) => (
              <RollHistoryItem
                key={entry.id}
                entry={entry}
                isOwn={entry.playerId === userId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
