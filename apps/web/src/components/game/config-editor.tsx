'use client';

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface RuleOverride {
  constraintId: string;
  name: string;
  scope: string;
  enabled: boolean;
  description?: string;
}

interface GameSystemConfigEntry {
  key: string;
  value: unknown;
  label?: string;
  description?: string;
  editable: boolean;
  defaultValue: unknown;
}

interface ConfigEditorProps {
  /** Active constraint overrides. */
  overrides: RuleOverride[];
  /** Game system configuration entries. */
  configs: GameSystemConfigEntry[];
  /** Called when a constraint override is toggled. */
  onToggleOverride: (constraintId: string, enabled: boolean) => void;
  /** Called when a config value is changed. */
  onConfigChange: (key: string, value: unknown) => void;
  /** Called to reset a config to its default value. */
  onResetConfig: (key: string) => void;
  /** Whether the current user is the Director. */
  isDirector: boolean;
  className?: string;
}

// ── Main Component ──────────────────────────────────────────────────────────

/**
 * ConfigEditor - Director-only panel for toggling rule overrides and tweaking
 * game system configuration values.
 *
 * This component allows the Director to:
 * - Enable/disable individual constraints (e.g., turn off movement speed limits)
 * - Adjust configuration values (e.g., change max actions per turn)
 * - Reset configs to their default values
 */
export function ConfigEditor({
  overrides,
  configs,
  onToggleOverride,
  onConfigChange,
  onResetConfig,
  isDirector,
  className = '',
}: ConfigEditorProps) {
  const [activeSection, setActiveSection] = useState<'overrides' | 'config'>('overrides');

  if (!isDirector) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        Only the Director can modify game rules.
      </div>
    );
  }

  return (
    <div className={`config-editor bg-gray-900 rounded-lg ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900 to-red-800 px-4 py-2">
        <h3 className="text-sm font-bold text-red-100">Rules Configuration</h3>
        <p className="text-xs text-red-300">Director-only controls</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        <button
          type="button"
          onClick={() => setActiveSection('overrides')}
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeSection === 'overrides'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Rule Overrides ({overrides.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('config')}
          className={`flex-1 px-3 py-2 text-sm font-medium ${
            activeSection === 'config'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Settings ({configs.length})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto p-3">
        {activeSection === 'overrides' ? (
          <OverridesList overrides={overrides} onToggle={onToggleOverride} />
        ) : (
          <ConfigList configs={configs} onChange={onConfigChange} onReset={onResetConfig} />
        )}
      </div>
    </div>
  );
}

// ── Overrides List ──────────────────────────────────────────────────────────

function OverridesList({
  overrides,
  onToggle,
}: {
  overrides: RuleOverride[];
  onToggle: (id: string, enabled: boolean) => void;
}) {
  if (overrides.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-4">No constraints to override</div>;
  }

  // Group by scope
  const byScope = new Map<string, RuleOverride[]>();
  for (const override of overrides) {
    const group = byScope.get(override.scope) ?? [];
    group.push(override);
    byScope.set(override.scope, group);
  }

  return (
    <div className="space-y-3">
      {Array.from(byScope.entries()).map(([scope, items]) => (
        <div key={scope}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{scope}</h4>
          <div className="space-y-1">
            {items.map((override) => (
              <label
                key={override.constraintId}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={override.enabled}
                  onChange={(e) => onToggle(override.constraintId, e.target.checked)}
                  className="h-3.5 w-3.5 accent-red-500"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-200">{override.name}</span>
                  {override.description && (
                    <p className="text-xs text-gray-500">{override.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Config List ─────────────────────────────────────────────────────────────

function ConfigList({
  configs,
  onChange,
  onReset,
}: {
  configs: GameSystemConfigEntry[];
  onChange: (key: string, value: unknown) => void;
  onReset: (key: string) => void;
}) {
  if (configs.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-4">No settings available</div>;
  }

  return (
    <div className="space-y-2">
      {configs.map((config) => (
        <div key={config.key} className="px-2 py-1.5 rounded hover:bg-gray-800">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-200">{config.label ?? config.key}</label>
            {config.editable &&
              JSON.stringify(config.value) !== JSON.stringify(config.defaultValue) && (
                <button
                  type="button"
                  onClick={() => onReset(config.key)}
                  className="text-xs text-gray-500 hover:text-red-400"
                >
                  Reset
                </button>
              )}
          </div>
          {config.description && <p className="text-xs text-gray-500 mb-1">{config.description}</p>}
          {config.editable ? (
            <ConfigInput config={config} onChange={onChange} />
          ) : (
            <div className="text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded">
              {String(config.value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ConfigInput({
  config,
  onChange,
}: {
  config: GameSystemConfigEntry;
  onChange: (key: string, value: unknown) => void;
}) {
  const value = config.value;

  if (typeof value === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(config.key, e.target.checked)}
        className="h-4 w-4 accent-red-500"
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(config.key, parseInt(e.target.value, 10) || 0)}
        className="w-full px-2 py-1 text-sm bg-gray-800 text-gray-100 rounded border border-gray-600 focus:border-red-500 focus:outline-none"
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(config.key, e.target.value)}
      className="w-full px-2 py-1 text-sm bg-gray-800 text-gray-100 rounded border border-gray-600 focus:border-red-500 focus:outline-none"
    />
  );
}

export default ConfigEditor;
