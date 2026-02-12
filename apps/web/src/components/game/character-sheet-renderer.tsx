'use client';

import React, { useCallback, useMemo, useState } from 'react';

// ── Template Types (matching rule-parser) ───────────────────────────────────

type FieldSection =
  | 'header'
  | 'characteristics'
  | 'combat'
  | 'heroic_resource'
  | 'skills'
  | 'features'
  | 'inventory'
  | 'notes';

type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'computed'
  | 'boolean'
  | 'textarea'
  | 'resource';

interface TemplateField {
  id: string;
  label: string;
  section: FieldSection;
  type: FieldType;
  computedFrom?: string[];
  defaultValue?: string | number | boolean;
  options?: string[];
  editable: boolean;
  order: number;
  width: string;
  description?: string;
  min?: number;
  max?: number;
}

interface CharacterSheetTemplate {
  gameSystemId: string;
  gameSystemName: string;
  version: string;
  sectionOrder: Array<{ id: FieldSection; label: string }>;
  fields: TemplateField[];
}

// ── Props ───────────────────────────────────────────────────────────────────

interface CharacterSheetRendererProps {
  template: CharacterSheetTemplate;
  data: Record<string, unknown>;
  onFieldChange: (fieldId: string, value: unknown) => void;
  readOnly?: boolean;
  className?: string;
}

// ── Main Component ──────────────────────────────────────────────────────────

/**
 * CharacterSheetRenderer - Renders a character sheet from a template definition.
 * Template-driven: the same component renders any game system's character sheet.
 *
 * Layout matches the Draw Steel PDF template structure:
 * - Header (character info)
 * - Characteristics (five scores)
 * - Combat stats (stamina, speed, etc.)
 * - Heroic Resource (class-specific)
 * - Skills (last in stats block)
 * - Features & Abilities
 * - Inventory
 * - Notes
 */
export function CharacterSheetRenderer({
  template,
  data,
  onFieldChange,
  readOnly = false,
  className = '',
}: CharacterSheetRendererProps) {
  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const map = new Map<FieldSection, TemplateField[]>();
    for (const field of template.fields) {
      const existing = map.get(field.section) ?? [];
      existing.push(field);
      map.set(field.section, existing);
    }
    // Sort within each section by order
    for (const [, fields] of map) {
      fields.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [template.fields]);

  // Compute derived values
  const computedValues = useMemo(() => {
    const computed: Record<string, unknown> = {};
    for (const field of template.fields) {
      if (field.type === 'computed') {
        computed[field.id] = computeValue(field.id, data);
      }
    }
    return computed;
  }, [data, template.fields]);

  // Merge data with computed values
  const displayData = useMemo(() => {
    return { ...data, ...computedValues };
  }, [data, computedValues]);

  return (
    <div
      className={`character-sheet bg-gray-900 text-gray-100 rounded-lg overflow-hidden ${className}`}
    >
      {/* Sheet header */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-800 px-4 py-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-100">
          {(displayData['name'] as string) || 'New Character'}
        </h2>
        <span className="text-sm text-amber-200">
          {template.gameSystemName} - {(displayData['class'] as string) || 'No Class'}
        </span>
      </div>

      {/* Render each section in order */}
      <div className="p-4 space-y-4">
        {template.sectionOrder.map((section) => {
          const fields = fieldsBySection.get(section.id);
          if (!fields || fields.length === 0) return null;

          return (
            <SheetSection
              key={section.id}
              sectionId={section.id}
              label={section.label}
              fields={fields}
              data={displayData}
              onFieldChange={onFieldChange}
              readOnly={readOnly}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Section Component ───────────────────────────────────────────────────────

interface SheetSectionProps {
  sectionId: FieldSection;
  label: string;
  fields: TemplateField[];
  data: Record<string, unknown>;
  onFieldChange: (fieldId: string, value: unknown) => void;
  readOnly: boolean;
}

function SheetSection({
  sectionId,
  label,
  fields,
  data,
  onFieldChange,
  readOnly,
}: SheetSectionProps) {
  // Use compact layout for characteristics
  const isCharacteristics = sectionId === 'characteristics';
  const isCombat = sectionId === 'combat';

  return (
    <div className="sheet-section">
      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider border-b border-gray-700 pb-1 mb-2">
        {label}
      </h3>

      <div
        className={`grid gap-2 ${
          isCharacteristics ? 'grid-cols-5' : isCombat ? 'grid-cols-4' : 'grid-cols-4'
        }`}
      >
        {fields.map((field) => (
          <SheetField
            key={field.id}
            field={field}
            value={data[field.id]}
            onChange={onFieldChange}
            readOnly={readOnly}
            compact={isCharacteristics}
          />
        ))}
      </div>
    </div>
  );
}

// ── Field Component ─────────────────────────────────────────────────────────

interface SheetFieldProps {
  field: TemplateField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  readOnly: boolean;
  compact?: boolean;
}

function SheetField({ field, value, onChange, readOnly, compact = false }: SheetFieldProps) {
  const widthClass = getWidthClass(field.width);
  const isDisabled = readOnly || !field.editable;

  const handleChange = useCallback(
    (newValue: unknown) => {
      if (!isDisabled) {
        onChange(field.id, newValue);
      }
    },
    [field.id, onChange, isDisabled],
  );

  // Compact mode for characteristics (centered, larger numbers)
  if (compact) {
    return (
      <div className="flex flex-col items-center p-2 bg-gray-800 rounded">
        <label className="text-xs text-gray-400 mb-1">{field.label}</label>
        <input
          type="number"
          value={(value as number) ?? field.defaultValue ?? 0}
          onChange={(e) => handleChange(parseInt(e.target.value, 10) || 0)}
          disabled={isDisabled}
          className="w-12 h-12 text-center text-xl font-bold bg-gray-700 text-amber-200 rounded border border-gray-600 focus:border-amber-500 focus:outline-none disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className={`sheet-field ${widthClass}`}>
      <label className="block text-xs text-gray-400 mb-0.5" title={field.description}>
        {field.label}
      </label>
      {renderFieldInput(field, value, handleChange, isDisabled)}
    </div>
  );
}

// ── Input Renderers ─────────────────────────────────────────────────────────

function renderFieldInput(
  field: TemplateField,
  value: unknown,
  onChange: (value: unknown) => void,
  disabled: boolean,
) {
  const baseClasses =
    'w-full px-2 py-1 text-sm bg-gray-800 text-gray-100 rounded border border-gray-600 focus:border-amber-500 focus:outline-none disabled:opacity-50';

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={(value as string) ?? (field.defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClasses}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? (field.defaultValue as number) ?? 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          min={field.min}
          max={field.max}
          disabled={disabled}
          className={baseClasses}
        />
      );

    case 'select':
      return (
        <select
          value={(value as string) ?? (field.defaultValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClasses}
        >
          <option value="">-- Select --</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'multiselect': {
      const selectedValues = (value as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {field.options?.map((opt) => {
            const isSelected = selectedValues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const newValues = isSelected
                    ? selectedValues.filter((v) => v !== opt)
                    : [...selectedValues, opt];
                  onChange(newValues);
                }}
                className={`px-1.5 py-0.5 text-xs rounded border ${
                  isSelected
                    ? 'bg-amber-700 border-amber-600 text-amber-100'
                    : 'bg-gray-800 border-gray-600 text-gray-400'
                } hover:border-amber-500 disabled:opacity-50`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case 'computed':
      return (
        <div className="px-2 py-1 text-sm bg-gray-700 text-amber-200 rounded border border-gray-600">
          {String(value ?? '--')}
        </div>
      );

    case 'textarea':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className={`${baseClasses} resize-y`}
        />
      );

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={(value as boolean) ?? (field.defaultValue as boolean) ?? false}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 accent-amber-500"
        />
      );

    case 'resource':
      return (
        <ResourceTracker
          current={(value as number) ?? 0}
          max={field.max ?? 10}
          onChange={onChange}
          disabled={disabled}
        />
      );

    default:
      return <span className="text-sm text-gray-500">Unsupported field type</span>;
  }
}

// ── Resource Tracker ────────────────────────────────────────────────────────

function ResourceTracker({
  current,
  max,
  onChange,
  disabled,
}: {
  current: number;
  max: number;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || current <= 0}
        onClick={() => onChange(current - 1)}
        className="w-6 h-6 text-xs bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
      >
        -
      </button>
      <span className="text-sm font-bold text-amber-200 min-w-[2rem] text-center">
        {current}/{max}
      </span>
      <button
        type="button"
        disabled={disabled || current >= max}
        onClick={() => onChange(current + 1)}
        className="w-6 h-6 text-xs bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWidthClass(width: string): string {
  switch (width) {
    case 'full':
      return 'col-span-4';
    case 'half':
      return 'col-span-2';
    case 'third':
      return 'col-span-1';
    case 'quarter':
      return 'col-span-1';
    default:
      return 'col-span-1';
  }
}

function computeValue(fieldId: string, data: Record<string, unknown>): unknown {
  switch (fieldId) {
    case 'echelon': {
      const level = (data['level'] as number) ?? 1;
      if (level <= 4) return '1st';
      if (level <= 7) return '2nd';
      if (level <= 10) return '3rd';
      return '4th';
    }
    case 'recoveryValue': {
      const maxStamina = (data['maxStamina'] as number) ?? 0;
      return Math.floor(maxStamina / 3);
    }
    default:
      return null;
  }
}

export default CharacterSheetRenderer;
