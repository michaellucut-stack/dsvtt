# ADR-006: Rules Engine Architecture

**Status:** Accepted
**Date:** 2026-02-12
**Author:** Arch (Tech Lead)
**Sprint:** 8 — "The Rules Engine"

## Context

Phase 2 introduces game-system-specific rules enforcement to the VTT. The platform must:

1. Parse TTRPG rule files (Markdown with YAML frontmatter) from a `game_rules/` folder
2. Extract structured data: stat blocks, abilities, conditions, movement rules, combat rules
3. Enforce game-specific constraints on player/NPC actions during live gameplay
4. Allow Directors to override any constraint
5. Support multiple game systems (starting with MCDM Draw Steel)

The existing `packages/game-engine` has a placeholder `validateAction()` that always returns `{ valid: true }`. We need to replace this with a real constraint evaluation pipeline.

## Decision

### 1. New Package: `packages/rule-parser`

A pure parsing library with zero runtime dependencies (beyond `yaml` for frontmatter). Responsibilities:

- **Frontmatter Parser**: Extract YAML frontmatter from MD files into typed objects
- **Section Parser**: Parse markdown headings, blockquotes, tables into a structured AST
- **Stat Block Parser**: Extract creature/character stat blocks (characteristics, stamina, speed, abilities)
- **Ability Parser**: Extract abilities from blockquote format (keywords, action type, distance, targets, power roll tiers, effects)
- **Condition Parser**: Parse condition definitions
- **Table Parser**: Extract markdown pipe-delimited tables into structured data

The parser outputs a `GameSystemData` object containing all parsed rules, stat blocks, abilities, conditions, and constraints.

### 2. Constraint Engine in `packages/game-engine`

The existing game-engine package is extended with a constraint evaluation system:

- **Constraint Model**: Rules are expressed as `Constraint` objects with a `type`, `scope`, and `evaluate()` function
- **Constraint Types**: `movement` (speed limits, terrain), `action_economy` (actions per turn), `ability_use` (resource costs, cooldowns), `combat` (targeting, range), `condition` (status effect enforcement)
- **Evaluation Pipeline**: Before any game action is applied, it passes through the constraint pipeline:
  1. Load active constraints for the game system
  2. Filter to constraints relevant to the action type
  3. Evaluate each constraint against current game state + proposed action
  4. If any constraint fails: return `{ valid: false, reason, constraintId }`
  5. If all pass: return `{ valid: true }`
- **Director Override**: Constraints can be bypassed per-session or per-action via a Director override flag
- **Performance Budget**: <50ms per action validation (constraints are pre-compiled at game system load time)

### 3. Game System Loader

A server-side service that:

1. Scans the `game_rules/` folder for game system directories
2. Validates folder structure against the spec
3. Parses all MD files using `rule-parser`
4. Registers the game system in the database
5. Compiles constraints for runtime evaluation
6. Caches parsed data in memory for the session lifetime

### 4. Database Schema Additions

- `GameSystem`: Registered game systems with metadata
- `RuleConstraint`: Individual constraint definitions per game system
- `GameSystemConfig`: Tweakable settings per game system (Director can modify)
- `Room.gameSystemId`: Links rooms to a specific game system

### 5. Markdown Format Spec (Draw Steel)

Based on analysis of the actual `game_rules/` files:

**Frontmatter fields (stat blocks):**

- `level`, `roles`, `ancestry`, `size`, `speed`, `stamina`, `stability`, `free_strike`
- `might`, `agility`, `reason`, `intuition`, `presence`
- `ev` (encounter value), `source`, `type`

**Ability format (blockquotes):**

- Emoji prefix indicates category: `🗡` melee, `🏹` ranged, `🔳` area, `❗️` triggered, `⭐️` trait, `☠️` villain action
- 2-column table for keywords + action type, distance + targets
- Power Roll with 3 tiers: `≤11`, `12-16`, `17+`
- Effect/Trigger/Special bold-labeled paragraphs

**Condition potency:** `M < WEAK`, `A < AVERAGE`, `P < STRONG` (characteristic abbreviation < threshold)

**Duration:** `(save ends)`, `(EoT)` (end of turn)

## Consequences

### Positive

- Clean separation: parsing (rule-parser) vs evaluation (game-engine) vs loading (server)
- Pre-compiled constraints avoid per-action parsing overhead
- Director overrides built into the model from day one
- Supports multiple game systems without code changes

### Negative

- Increased complexity in the game action pipeline (every action now has a validation step)
- Markdown format is fragile — changes to source files may break parsing
- Memory usage increases with cached game system data

### Risks

- Diverse markdown formats across different game systems may require parser extensions
- Constraint evaluation latency must be monitored (50ms budget)

## Alternatives Considered

1. **JSON-only rule format**: Simpler to parse but requires manual conversion of all MD files. Rejected because the MD files already exist and are maintained upstream.
2. **Runtime MD parsing per action**: No pre-compilation. Rejected due to unacceptable latency.
3. **External rules engine (e.g., JSON Rules Engine)**: Third-party dependency with its own DSL. Rejected to keep full control over TTRPG-specific constraint logic.
