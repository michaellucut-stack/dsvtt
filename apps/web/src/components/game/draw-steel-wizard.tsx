'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ANCESTRIES,
  CULTURE_ENVIRONMENTS,
  CULTURE_ORGANIZATIONS,
  CULTURE_UPBRINGINGS,
  CAREERS,
  CLASSES,
  KITS,
  COMPLICATIONS,
  LANGUAGES,
} from '@/data/draw-steel-options';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DrawSteelCharacterData {
  ancestry: string;
  ancestryTraits: string[];
  cultureEnvironment: string;
  cultureOrganization: string;
  cultureUpbringing: string;
  language: string;
  career: string;
  class: string;
  subclass: string;
  characteristicArray: string;
  might: number;
  agility: number;
  reason: number;
  intuition: number;
  presence: number;
  kit: string;
  complication: string;
  heroicResource: string;
  stamina: number;
  recoveries: number;
  speed: number;
}

interface DrawSteelWizardProps {
  name: string;
  sessionId: string;
  onComplete: (data: DrawSteelCharacterData) => void;
  onCancel: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Ancestry',
  'Traits',
  'Culture',
  'Career',
  'Class',
  'Subclass',
  'Stats',
  'Kit',
  'Complication',
  'Review',
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a characteristic array string and return stat values. */
function parseCharacteristicArray(
  arrayStr: string,
  keyCharacteristic: string,
): { might: number; agility: number; reason: number; intuition: number; presence: number } {
  const stats = { might: 0, agility: 0, reason: 0, intuition: 0, presence: 0 };
  const keyLower = keyCharacteristic.toLowerCase();

  // Extract the fixed key characteristics (e.g. "Might 2, Agility 2")
  const fixedPart = arrayStr.split(', then')[0] ?? arrayStr;
  const fixedMatches = fixedPart.matchAll(/(\w+)\s+(-?\d+)/g);
  for (const match of fixedMatches) {
    const statName = match[1]!.toLowerCase() as keyof typeof stats;
    if (statName in stats) {
      stats[statName] = parseInt(match[2]!, 10);
    }
  }

  // Extract the "then" part for remaining stats
  const thenPart = arrayStr.split(', then ')[1];
  if (thenPart) {
    // Parse values like "2/-1/-1" or "1/1/-1" or "1/0/0" or "2/2/-1/-1"
    const values = thenPart
      .split('/')
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v));

    // Determine which stats are not yet assigned (still 0 and not key characteristics)
    const remaining = (['might', 'agility', 'reason', 'intuition', 'presence'] as const).filter(
      (s) => !keyLower.includes(s),
    );

    for (let i = 0; i < Math.min(values.length, remaining.length); i++) {
      stats[remaining[i]!] = values[i]!;
    }
  }

  return stats;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: StepIndex }) {
  return (
    <div className="flex items-center justify-center gap-1 px-2 py-3">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex flex-col items-center">
            <div
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                isCurrent
                  ? 'bg-gold-500 text-charcoal-950'
                  : isCompleted
                    ? 'bg-gold-700/60 text-parchment-100'
                    : 'bg-charcoal-700/60 text-charcoal-400',
              ].join(' ')}
            >
              {i + 1}
            </div>
            <span
              className={[
                'mt-0.5 text-[8px] leading-tight',
                isCurrent ? 'text-gold-400' : 'text-charcoal-500',
              ].join(' ')}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Option Card ─────────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-panel border p-4 cursor-pointer transition-colors',
        selected
          ? 'border-gold-500 bg-gold-950/20'
          : 'border-charcoal-700/60 bg-charcoal-900/80 hover:border-gold-700/50',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

// ─── Trait Card (for ancestry traits with point tracking) ────────────────────

function TraitCard({
  name,
  cost,
  description,
  selected,
  disabled,
  onToggle,
}: {
  name: string;
  cost: number;
  description: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={() => {
        if (!disabled || selected) onToggle();
      }}
      className={[
        'rounded-panel border p-3 cursor-pointer transition-colors',
        selected
          ? 'border-gold-500 bg-gold-950/20'
          : disabled
            ? 'border-charcoal-700/40 bg-charcoal-900/40 opacity-50 cursor-not-allowed'
            : 'border-charcoal-700/60 bg-charcoal-900/80 hover:border-gold-700/50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm font-semibold text-parchment-100">{name}</span>
        <span className="rounded bg-charcoal-700/80 px-2 py-0.5 text-[10px] font-bold text-gold-400">
          {cost} {cost === 1 ? 'pt' : 'pts'}
        </span>
      </div>
      <p className="mt-1 text-xs text-parchment-400">{description}</p>
    </div>
  );
}

// ─── Step Components ─────────────────────────────────────────────────────────

function AncestryStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose Your Ancestry
      </h3>
      <p className="text-xs text-parchment-400">
        Your ancestry determines your heritage, signature abilities, and purchasable traits.
      </p>
      <div className="space-y-2">
        {ANCESTRIES.map((a) => (
          <OptionCard key={a.name} selected={value === a.name} onClick={() => onChange(a.name)}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-heading text-sm font-semibold text-parchment-100">
                {a.name}
              </span>
              <span className="shrink-0 text-[10px] text-charcoal-400">Size {a.size}</span>
            </div>
            <p className="mt-1 text-xs text-parchment-400">{a.description}</p>
            <div className="mt-2 rounded border border-charcoal-600/40 bg-charcoal-800/40 p-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gold-500">
                Signature Trait: {a.signatureTrait.name}
              </span>
              <p className="mt-0.5 text-[11px] text-parchment-300">
                {a.signatureTrait.description}
              </p>
            </div>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function AncestryTraitsStep({
  ancestry,
  selectedTraits,
  onToggle,
}: {
  ancestry: string;
  selectedTraits: string[];
  onToggle: (traitName: string) => void;
}) {
  const ancestryData = ANCESTRIES.find((a) => a.name === ancestry);
  if (!ancestryData) return <p className="text-parchment-400">Select an ancestry first.</p>;

  const maxPoints = ancestryData.ancestryPoints;
  const spent = ancestryData.purchasableTraits
    .filter((t) => selectedTraits.includes(t.name))
    .reduce((sum, t) => sum + t.cost, 0);
  const remaining = maxPoints - spent;

  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose Ancestry Traits
      </h3>
      <p className="text-xs text-parchment-400">
        Spend your ancestry points on purchasable traits. You have{' '}
        <span className="font-bold text-gold-400">{remaining}</span> of{' '}
        <span className="font-bold text-parchment-200">{maxPoints}</span> points remaining.
      </p>
      <div className="flex items-center gap-2 rounded-panel border border-charcoal-700/40 bg-charcoal-800/60 p-2">
        {Array.from({ length: maxPoints }).map((_, i) => (
          <div
            key={i}
            className={[
              'h-3 w-3 rounded-full transition-colors',
              i < spent ? 'bg-gold-500' : 'bg-charcoal-600',
            ].join(' ')}
          />
        ))}
        <span className="ml-2 text-xs text-parchment-300">
          {spent}/{maxPoints} spent
        </span>
      </div>
      <div className="space-y-2">
        {ancestryData.purchasableTraits.map((t) => {
          const isSelected = selectedTraits.includes(t.name);
          const canAfford = remaining >= t.cost;
          return (
            <TraitCard
              key={t.name}
              name={t.name}
              cost={t.cost}
              description={t.description}
              selected={isSelected}
              disabled={!isSelected && !canAfford}
              onToggle={() => onToggle(t.name)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CultureStep({
  environment,
  organization,
  upbringing,
  language,
  onEnvironmentChange,
  onOrganizationChange,
  onUpbringingChange,
  onLanguageChange,
}: {
  environment: string;
  organization: string;
  upbringing: string;
  language: string;
  onEnvironmentChange: (v: string) => void;
  onOrganizationChange: (v: string) => void;
  onUpbringingChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Define Your Culture
      </h3>
      <p className="text-xs text-parchment-400">
        Choose the environment, organization, and upbringing that shaped your character, plus a
        language.
      </p>

      {/* Environment */}
      <div>
        <h4 className="mb-1 font-heading text-sm font-semibold text-gold-400">Environment</h4>
        <div className="space-y-2">
          {CULTURE_ENVIRONMENTS.map((e) => (
            <OptionCard
              key={e.name}
              selected={environment === e.name}
              onClick={() => onEnvironmentChange(e.name)}
            >
              <span className="font-heading text-sm font-semibold text-parchment-100">
                {e.name}
              </span>
              <p className="mt-0.5 text-xs text-parchment-400">{e.skillOptions}</p>
            </OptionCard>
          ))}
        </div>
      </div>

      {/* Organization */}
      <div>
        <h4 className="mb-1 font-heading text-sm font-semibold text-gold-400">Organization</h4>
        <div className="space-y-2">
          {CULTURE_ORGANIZATIONS.map((o) => (
            <OptionCard
              key={o.name}
              selected={organization === o.name}
              onClick={() => onOrganizationChange(o.name)}
            >
              <span className="font-heading text-sm font-semibold text-parchment-100">
                {o.name}
              </span>
              <p className="mt-0.5 text-xs text-parchment-400">{o.skillOptions}</p>
            </OptionCard>
          ))}
        </div>
      </div>

      {/* Upbringing */}
      <div>
        <h4 className="mb-1 font-heading text-sm font-semibold text-gold-400">Upbringing</h4>
        <div className="space-y-2">
          {CULTURE_UPBRINGINGS.map((u) => (
            <OptionCard
              key={u.name}
              selected={upbringing === u.name}
              onClick={() => onUpbringingChange(u.name)}
            >
              <span className="font-heading text-sm font-semibold text-parchment-100">
                {u.name}
              </span>
              <p className="mt-0.5 text-xs text-parchment-400">{u.skillOptions}</p>
            </OptionCard>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <h4 className="mb-1 font-heading text-sm font-semibold text-gold-400">Language</h4>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <OptionCard
              key={lang}
              selected={language === lang}
              onClick={() => onLanguageChange(lang)}
            >
              <span className="font-heading text-xs font-semibold text-parchment-100">{lang}</span>
            </OptionCard>
          ))}
        </div>
      </div>
    </div>
  );
}

function CareerStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose Your Career
      </h3>
      <p className="text-xs text-parchment-400">
        Your career represents what you did before becoming a hero. It grants skills and other
        benefits.
      </p>
      <div className="space-y-2">
        {CAREERS.map((c) => (
          <OptionCard key={c.name} selected={value === c.name} onClick={() => onChange(c.name)}>
            <span className="font-heading text-sm font-semibold text-parchment-100">{c.name}</span>
            <p className="mt-1 text-xs text-parchment-400">{c.skills}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {c.languages && (
                <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-[10px] text-parchment-300">
                  {c.languages}
                </span>
              )}
              {c.renown != null && c.renown > 0 && (
                <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-[10px] text-parchment-300">
                  Renown +{c.renown}
                </span>
              )}
              {c.wealth != null && c.wealth > 0 && (
                <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-[10px] text-parchment-300">
                  Wealth +{c.wealth}
                </span>
              )}
              {c.projectPoints != null && c.projectPoints > 0 && (
                <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-[10px] text-parchment-300">
                  {c.projectPoints} project pts
                </span>
              )}
            </div>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function ClassStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">Choose Your Class</h3>
      <p className="text-xs text-parchment-400">
        Your class defines your combat role, heroic resource, and core abilities.
      </p>
      <div className="space-y-2">
        {CLASSES.map((c) => (
          <OptionCard key={c.name} selected={value === c.name} onClick={() => onChange(c.name)}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-heading text-sm font-semibold text-parchment-100">
                {c.name}
              </span>
              <span className="shrink-0 rounded bg-gold-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-gold-400">
                {c.heroicResource}
              </span>
            </div>
            <p className="mt-1 text-xs text-parchment-400">{c.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-parchment-300">
                Key: {c.keyCharacteristic}
              </span>
              <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-parchment-300">
                Stamina {c.startingStamina}
              </span>
              <span className="rounded bg-charcoal-700/60 px-1.5 py-0.5 text-parchment-300">
                Recoveries {c.recoveries}
              </span>
            </div>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function SubclassStep({
  className,
  value,
  onChange,
}: {
  className: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const classData = CLASSES.find((c) => c.name === className);
  if (!classData) return <p className="text-parchment-400">Select a class first.</p>;

  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose Your {classData.name} Subclass
      </h3>
      <p className="text-xs text-parchment-400">
        Subclasses further specialize your class, granting unique abilities at each level.
      </p>
      <div className="space-y-2">
        {classData.subclasses.map((sub) => (
          <OptionCard key={sub} selected={value === sub} onClick={() => onChange(sub)}>
            <span className="font-heading text-sm font-semibold text-parchment-100">{sub}</span>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function CharacteristicsStep({
  className,
  value,
  onChange,
}: {
  className: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const classData = CLASSES.find((c) => c.name === className);
  if (!classData) return <p className="text-parchment-400">Select a class first.</p>;

  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose Your Characteristic Array
      </h3>
      <p className="text-xs text-parchment-400">
        Pick a stat distribution for your {classData.name}. Key characteristic:{' '}
        <span className="font-semibold text-gold-400">{classData.keyCharacteristic}</span>. The
        remaining values are assigned to your other characteristics.
      </p>
      <div className="space-y-2">
        {classData.characteristicArrays.map((arr) => {
          const parsed = parseCharacteristicArray(arr, classData.keyCharacteristic);
          return (
            <OptionCard key={arr} selected={value === arr} onClick={() => onChange(arr)}>
              <span className="font-heading text-sm font-semibold text-parchment-100">{arr}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['might', 'agility', 'reason', 'intuition', 'presence'] as const).map((stat) => (
                  <div
                    key={stat}
                    className={[
                      'flex flex-col items-center rounded border px-2 py-1',
                      parsed[stat] > 0
                        ? 'border-gold-700/40 bg-gold-950/20'
                        : parsed[stat] < 0
                          ? 'border-crimson-700/40 bg-crimson-950/20'
                          : 'border-charcoal-600/40 bg-charcoal-800/40',
                    ].join(' ')}
                  >
                    <span className="text-[9px] uppercase tracking-wider text-parchment-400">
                      {stat.slice(0, 3)}
                    </span>
                    <span
                      className={[
                        'text-sm font-bold',
                        parsed[stat] > 0
                          ? 'text-gold-400'
                          : parsed[stat] < 0
                            ? 'text-crimson-400'
                            : 'text-parchment-300',
                      ].join(' ')}
                    >
                      {parsed[stat] >= 0 ? `+${parsed[stat]}` : parsed[stat]}
                    </span>
                  </div>
                ))}
              </div>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

function KitStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">Choose Your Kit</h3>
      <p className="text-xs text-parchment-400">
        Your kit determines your armor, weapons, and combat bonuses.
      </p>
      <div className="space-y-2">
        {KITS.map((k) => (
          <OptionCard key={k.name} selected={value === k.name} onClick={() => onChange(k.name)}>
            <span className="font-heading text-sm font-semibold text-parchment-100">{k.name}</span>
            <p className="mt-1 text-xs text-parchment-400">{k.description}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div>
                <span className="text-charcoal-400">Armor: </span>
                <span className="text-parchment-300">{k.armor}</span>
              </div>
              <div>
                <span className="text-charcoal-400">Weapon: </span>
                <span className="text-parchment-300">{k.weapon}</span>
              </div>
              <div>
                <span className="text-charcoal-400">Stamina: </span>
                <span className={k.staminaBonus > 0 ? 'text-gold-400' : 'text-parchment-300'}>
                  +{k.staminaBonus}
                </span>
              </div>
              <div>
                <span className="text-charcoal-400">Speed: </span>
                <span className={k.speedBonus > 0 ? 'text-gold-400' : 'text-parchment-300'}>
                  +{k.speedBonus}
                </span>
              </div>
              {k.meleeDamageBonus !== '-' && (
                <div>
                  <span className="text-charcoal-400">Melee: </span>
                  <span className="text-parchment-300">{k.meleeDamageBonus}</span>
                </div>
              )}
              {k.rangedDamageBonus !== '-' && (
                <div>
                  <span className="text-charcoal-400">Ranged: </span>
                  <span className="text-parchment-300">{k.rangedDamageBonus}</span>
                </div>
              )}
            </div>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function ComplicationStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Choose a Complication (Optional)
      </h3>
      <p className="text-xs text-parchment-400">
        A complication adds narrative depth to your character. You can skip this step.
      </p>
      <OptionCard selected={value === ''} onClick={() => onChange('')}>
        <span className="font-heading text-sm font-semibold text-parchment-300 italic">
          No Complication (Skip)
        </span>
      </OptionCard>
      <div className="grid grid-cols-2 gap-2">
        {COMPLICATIONS.map((c) => (
          <OptionCard key={c} selected={value === c} onClick={() => onChange(c)}>
            <span className="font-heading text-xs font-semibold text-parchment-100">{c}</span>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ data, name }: { data: DrawSteelCharacterData; name: string }) {
  return (
    <div className="space-y-3">
      <h3 className="font-heading text-base font-semibold text-parchment-100">
        Review Your Character
      </h3>
      <p className="text-xs text-parchment-400">
        Confirm your choices before creating{' '}
        <span className="font-semibold text-gold-400">{name}</span>.
      </p>

      <div className="space-y-2">
        <ReviewRow label="Ancestry" value={data.ancestry} />
        <ReviewRow label="Ancestry Traits" value={data.ancestryTraits.join(', ') || 'None'} />
        <ReviewRow
          label="Culture"
          value={`${data.cultureEnvironment} / ${data.cultureOrganization} / ${data.cultureUpbringing}`}
        />
        <ReviewRow label="Language" value={data.language} />
        <ReviewRow label="Career" value={data.career} />
        <ReviewRow label="Class" value={data.class} />
        <ReviewRow label="Subclass" value={data.subclass} />
        <ReviewRow label="Heroic Resource" value={data.heroicResource} />
        <ReviewRow label="Kit" value={data.kit} />
        {data.complication && <ReviewRow label="Complication" value={data.complication} />}

        <div className="rounded-panel border border-charcoal-700/40 bg-charcoal-800/60 p-3">
          <h4 className="mb-2 font-heading text-xs font-semibold uppercase tracking-wider text-gold-400">
            Characteristics
          </h4>
          <div className="flex justify-between gap-2">
            {(
              [
                ['Might', data.might],
                ['Agility', data.agility],
                ['Reason', data.reason],
                ['Intuition', data.intuition],
                ['Presence', data.presence],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-parchment-400">
                  {label.slice(0, 3)}
                </span>
                <span
                  className={[
                    'text-lg font-bold',
                    val > 0 ? 'text-gold-400' : val < 0 ? 'text-crimson-400' : 'text-parchment-300',
                  ].join(' ')}
                >
                  {val >= 0 ? `+${val}` : val}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-panel border border-charcoal-700/40 bg-charcoal-800/60 p-3">
          <h4 className="mb-2 font-heading text-xs font-semibold uppercase tracking-wider text-gold-400">
            Combat Stats
          </h4>
          <div className="flex justify-around">
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-wider text-parchment-400">
                Stamina
              </span>
              <span className="text-lg font-bold text-parchment-100">{data.stamina}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-wider text-parchment-400">
                Recoveries
              </span>
              <span className="text-lg font-bold text-parchment-100">{data.recoveries}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-wider text-parchment-400">Speed</span>
              <span className="text-lg font-bold text-parchment-100">{data.speed}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-panel border border-charcoal-700/40 bg-charcoal-800/60 px-3 py-2">
      <span className="text-xs font-semibold text-parchment-400">{label}</span>
      <span className="text-xs font-semibold text-parchment-100">{value}</span>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function DrawSteelWizard({ name, onComplete, onCancel }: DrawSteelWizardProps) {
  const [step, setStep] = useState<StepIndex>(0);

  // Selection state
  const [ancestry, setAncestry] = useState('');
  const [ancestryTraits, setAncestryTraits] = useState<string[]>([]);
  const [cultureEnvironment, setCultureEnvironment] = useState('');
  const [cultureOrganization, setCultureOrganization] = useState('');
  const [cultureUpbringing, setCultureUpbringing] = useState('');
  const [language, setLanguage] = useState('');
  const [career, setCareer] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [subclass, setSubclass] = useState('');
  const [characteristicArray, setCharacteristicArray] = useState('');
  const [kit, setKit] = useState('');
  const [complication, setComplication] = useState('');

  // Reset dependent selections when class changes
  const handleClassChange = (v: string) => {
    if (v !== selectedClass) {
      setSubclass('');
      setCharacteristicArray('');
    }
    setSelectedClass(v);
  };

  // Reset traits when ancestry changes
  const handleAncestryChange = (v: string) => {
    if (v !== ancestry) {
      setAncestryTraits([]);
    }
    setAncestry(v);
  };

  const handleTraitToggle = (traitName: string) => {
    setAncestryTraits((prev) =>
      prev.includes(traitName) ? prev.filter((t) => t !== traitName) : [...prev, traitName],
    );
  };

  // Derived data
  const classData = useMemo(() => CLASSES.find((c) => c.name === selectedClass), [selectedClass]);
  const kitData = useMemo(() => KITS.find((k) => k.name === kit), [kit]);

  const parsedStats = useMemo(() => {
    if (!classData || !characteristicArray) {
      return { might: 0, agility: 0, reason: 0, intuition: 0, presence: 0 };
    }
    return parseCharacteristicArray(characteristicArray, classData.keyCharacteristic);
  }, [classData, characteristicArray]);

  const stamina = (classData?.startingStamina ?? 0) + (kitData?.staminaBonus ?? 0);
  const speed = 5 + (kitData?.speedBonus ?? 0);
  const recoveries = classData?.recoveries ?? 0;
  const heroicResource = classData?.heroicResource ?? '';

  const wizardData: DrawSteelCharacterData = {
    ancestry,
    ancestryTraits,
    cultureEnvironment,
    cultureOrganization,
    cultureUpbringing,
    language,
    career,
    class: selectedClass,
    subclass,
    characteristicArray,
    ...parsedStats,
    kit,
    complication,
    heroicResource,
    stamina,
    recoveries,
    speed,
  };

  // Validation per step
  const canAdvance = useMemo((): boolean => {
    switch (step) {
      case 0:
        return ancestry !== '';
      case 1:
        return true; // traits are optional (can spend 0 points)
      case 2:
        return (
          cultureEnvironment !== '' &&
          cultureOrganization !== '' &&
          cultureUpbringing !== '' &&
          language !== ''
        );
      case 3:
        return career !== '';
      case 4:
        return selectedClass !== '';
      case 5:
        return subclass !== '';
      case 6:
        return characteristicArray !== '';
      case 7:
        return kit !== '';
      case 8:
        return true; // complication is optional
      case 9:
        return true; // review step
      default:
        return false;
    }
  }, [
    step,
    ancestry,
    cultureEnvironment,
    cultureOrganization,
    cultureUpbringing,
    language,
    career,
    selectedClass,
    subclass,
    characteristicArray,
    kit,
  ]);

  const handleNext = () => {
    if (step < 9) setStep((step + 1) as StepIndex);
  };

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as StepIndex);
  };

  const handleCreate = () => {
    onComplete(wizardData);
  };

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 0:
        return <AncestryStep value={ancestry} onChange={handleAncestryChange} />;
      case 1:
        return (
          <AncestryTraitsStep
            ancestry={ancestry}
            selectedTraits={ancestryTraits}
            onToggle={handleTraitToggle}
          />
        );
      case 2:
        return (
          <CultureStep
            environment={cultureEnvironment}
            organization={cultureOrganization}
            upbringing={cultureUpbringing}
            language={language}
            onEnvironmentChange={setCultureEnvironment}
            onOrganizationChange={setCultureOrganization}
            onUpbringingChange={setCultureUpbringing}
            onLanguageChange={setLanguage}
          />
        );
      case 3:
        return <CareerStep value={career} onChange={setCareer} />;
      case 4:
        return <ClassStep value={selectedClass} onChange={handleClassChange} />;
      case 5:
        return <SubclassStep className={selectedClass} value={subclass} onChange={setSubclass} />;
      case 6:
        return (
          <CharacteristicsStep
            className={selectedClass}
            value={characteristicArray}
            onChange={setCharacteristicArray}
          />
        );
      case 7:
        return <KitStep value={kit} onChange={setKit} />;
      case 8:
        return <ComplicationStep value={complication} onChange={setComplication} />;
      case 9:
        return <ReviewStep data={wizardData} name={name} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-charcoal-700/40 bg-charcoal-900/90 px-4 py-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-parchment-100">
            Draw Steel Character: <span className="text-gold-400">{name}</span>
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-charcoal-400 hover:text-parchment-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
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
        <StepIndicator current={step} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">{renderStep()}</div>

      {/* Navigation footer */}
      <div className="shrink-0 border-t border-charcoal-700/40 bg-charcoal-900/90 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={step === 0 ? onCancel : handleBack}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step === 9 ? (
            <Button onClick={handleCreate}>Create Character</Button>
          ) : (
            <Button onClick={handleNext} disabled={!canAdvance}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
