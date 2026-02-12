'use client';

import React, { useMemo, useState, useCallback } from 'react';

// ── Types matching rule-parser ──────────────────────────────────────────────

type AbilityTab = 'actions' | 'maneuvers' | 'triggered';

interface ClassifiedAbility {
  name: string;
  category: string;
  actionType: string;
  keywords: string[];
  distance: string;
  targets: string;
  powerRollCharacteristic: string | null;
  powerRollTiers: { low: string; mid: string; high: string } | null;
  effect: string | null;
  trigger: string | null;
  special: string | null;
  cost: string | null;
  tab: AbilityTab;
  sourceClass: string | null;
  sourceAncestry: string | null;
  sourceKit: string | null;
  levelRequired: number;
  isSignature: boolean;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface AbilityBrowserProps {
  abilities: ClassifiedAbility[];
  characterLevel: number;
  characterClass?: string;
  characterAncestry?: string;
  className?: string;
}

// ── Tab Labels ──────────────────────────────────────────────────────────────

const TAB_CONFIG: Array<{ id: AbilityTab; label: string; description: string }> = [
  { id: 'actions', label: 'Actions', description: 'Main actions you can take on your turn' },
  { id: 'maneuvers', label: 'Maneuvers', description: 'Quick actions that cost your maneuver' },
  { id: 'triggered', label: 'Triggered', description: 'Reactions that fire on specific triggers' },
];

// ── Main Component ──────────────────────────────────────────────────────────

/**
 * AbilityBrowser - 3-tab ability browser (Actions / Maneuvers / Triggered).
 * Integrated below the stats section in the character sheet panel.
 *
 * Features:
 * - Three tabs matching Draw Steel's action economy
 * - Expandable ability cards with full descriptions
 * - Filtering by class, ancestry, and level
 * - Search across ability names and descriptions
 */
export function AbilityBrowser({
  abilities,
  characterLevel,
  characterClass,
  characterAncestry,
  className = '',
}: AbilityBrowserProps) {
  const [activeTab, setActiveTab] = useState<AbilityTab>('actions');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAbilities, setExpandedAbilities] = useState<Set<string>>(new Set());

  // Filter abilities by level and search
  const filteredAbilities = useMemo(() => {
    return abilities.filter((ability) => {
      // Level filter
      if (ability.levelRequired > characterLevel) return false;

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const text = [
          ability.name,
          ability.effect ?? '',
          ability.trigger ?? '',
          ...ability.keywords,
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(search)) return false;
      }

      return true;
    });
  }, [abilities, characterLevel, searchQuery]);

  // Group by tab
  const tabAbilities = useMemo(() => {
    const groups: Record<AbilityTab, ClassifiedAbility[]> = {
      actions: [],
      maneuvers: [],
      triggered: [],
    };
    for (const ability of filteredAbilities) {
      groups[ability.tab].push(ability);
    }
    return groups;
  }, [filteredAbilities]);

  // Tab counts
  const tabCounts = useMemo(
    () => ({
      actions: tabAbilities.actions.length,
      maneuvers: tabAbilities.maneuvers.length,
      triggered: tabAbilities.triggered.length,
    }),
    [tabAbilities],
  );

  const toggleAbility = useCallback((name: string) => {
    setExpandedAbilities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  return (
    <div className={`ability-browser bg-gray-900 rounded-lg ${className}`}>
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search abilities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-gray-800 text-gray-100 rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title={tab.description}
          >
            {tab.label}
            <span className="ml-1 text-xs opacity-60">({tabCounts[tab.id]})</span>
          </button>
        ))}
      </div>

      {/* Ability list */}
      <div className="max-h-96 overflow-y-auto">
        {tabAbilities[activeTab].length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No {activeTab} available at level {characterLevel}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {tabAbilities[activeTab].map((ability) => (
              <AbilityCard
                key={`${ability.name}-${ability.sourceClass}-${ability.levelRequired}`}
                ability={ability}
                isExpanded={expandedAbilities.has(ability.name)}
                onToggle={() => toggleAbility(ability.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ability Card Component ──────────────────────────────────────────────────

interface AbilityCardProps {
  ability: ClassifiedAbility;
  isExpanded: boolean;
  onToggle: () => void;
}

function AbilityCard({ ability, isExpanded, onToggle }: AbilityCardProps) {
  return (
    <div className="ability-card">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">{getCategoryEmoji(ability.category)}</span>
          <span className="text-sm font-medium text-gray-100">{ability.name}</span>
          {ability.cost && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-900 text-amber-200 rounded">
              {ability.cost}
            </span>
          )}
          {ability.isSignature && (
            <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-200 rounded">
              Signature
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ability.keywords.length > 0 && (
            <span className="text-xs text-gray-500">{ability.keywords.join(', ')}</span>
          )}
          <span className="text-gray-500">{isExpanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 bg-gray-850">
          {/* Action type and keywords */}
          <div className="flex gap-4 text-xs">
            <span className="text-gray-400">
              <strong>Type:</strong> {ability.actionType}
            </span>
            {ability.distance && (
              <span className="text-gray-400">
                <strong>Distance:</strong> {ability.distance}
              </span>
            )}
            {ability.targets && (
              <span className="text-gray-400">
                <strong>Targets:</strong> {ability.targets}
              </span>
            )}
          </div>

          {/* Trigger */}
          {ability.trigger && (
            <div className="text-sm text-yellow-300">
              <strong>Trigger:</strong> {ability.trigger}
            </div>
          )}

          {/* Power Roll */}
          {ability.powerRollTiers && (
            <div className="bg-gray-800 rounded p-2 text-sm">
              <div className="font-medium text-amber-300 mb-1">
                Power Roll + {ability.powerRollCharacteristic}
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div className="text-red-400">
                  <strong>\u226411:</strong> {ability.powerRollTiers.low}
                </div>
                <div className="text-yellow-400">
                  <strong>12-16:</strong> {ability.powerRollTiers.mid}
                </div>
                <div className="text-green-400">
                  <strong>17+:</strong> {ability.powerRollTiers.high}
                </div>
              </div>
            </div>
          )}

          {/* Effect */}
          {ability.effect && (
            <div className="text-sm text-gray-300">
              <strong className="text-gray-400">Effect:</strong> {ability.effect}
            </div>
          )}

          {/* Special */}
          {ability.special && (
            <div className="text-sm text-gray-300">
              <strong className="text-gray-400">Special:</strong> {ability.special}
            </div>
          )}

          {/* Source info */}
          <div className="flex gap-2 text-xs text-gray-600 pt-1 border-t border-gray-800">
            {ability.sourceClass && <span>Class: {ability.sourceClass}</span>}
            {ability.sourceAncestry && <span>Ancestry: {ability.sourceAncestry}</span>}
            {ability.sourceKit && <span>Kit: {ability.sourceKit}</span>}
            <span>Level {ability.levelRequired}+</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'melee':
      return '\u{1F5E1}';
    case 'ranged':
      return '\u{1F3F9}';
    case 'area':
      return '\u{1F533}';
    case 'melee_ranged':
      return '\u2694\uFE0F';
    case 'triggered':
      return '\u2757\uFE0F';
    case 'trait':
      return '\u2B50\uFE0F';
    case 'villain_action':
      return '\u2620\uFE0F';
    case 'move':
      return '\u{1F464}';
    case 'special':
      return '\u2747\uFE0F';
    default:
      return '\u2753';
  }
}

export default AbilityBrowser;
