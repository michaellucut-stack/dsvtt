# ADR-007: Phase 2 Architecture Review

## Status

Accepted

## Date

2026-02-12

## Context

Phase 2 (Sprints 8-12) added a game system loader, constraint engine, character sheet renderer, ability browser, and rules enforcement pipeline. Before shipping v2.0, we need to review the architecture for extensibility toward Phase 3 (AI Director) and document known technical debt.

## Decision

### Architecture Summary

Phase 2 introduced two new packages and significantly extended `game-engine`:

1. **`@dsvtt/rule-parser`** - Pure TypeScript package with zero runtime dependencies (except `yaml`). Parses markdown game rules with YAML frontmatter into typed data structures. Contains: frontmatter parser, section parser, ability parser, table parser, statblock parser, condition parser, document parser, folder validator, game system loader, character template parser, ability classifier.

2. **`@dsvtt/game-engine` extensions** - Constraint engine (registry + evaluator), Draw Steel constraint definitions, action pipeline with Director overrides, performance budget monitoring.

3. **Frontend components** - Character sheet renderer (template-driven), 3-tab ability browser (Actions/Maneuvers/Triggered), Director config editor.

### Key Design Decisions

- **Constraint engine is scope-based**: Actions are classified by type (movement, action_economy, ability_use, combat, condition, resource) and only relevant constraints are evaluated. This keeps evaluation fast (<1ms typical, well under 50ms budget).
- **Director overrides are per-session**: Stored in-memory on ActionPipeline. If the server restarts, overrides are lost. This is acceptable for now but should be persisted in Phase 3.
- **Echelon is computed from level, not directory structure**: The `getEchelon()` function maps level ranges to echelons (1-4=1, 5-7=2, 8-10=3, 11+=4). This doesn't perfectly match the game data where 4th Echelon Rivals are level 10. A future improvement could derive echelon from the `file_dpath` field.
- **Stat block type normalization**: Real game files use `type: monster` in frontmatter, but our parser normalizes to `type: monster/statblock` when stat fields are detected. This allows clean type discrimination downstream.

### Phase 2 Test Coverage

| Package           | Test Files | Tests   | Coverage                                                                                                                          |
| ----------------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| rule-parser       | 9          | 109     | Frontmatter, abilities, tables, sections, conditions, character templates, ability classifier, integration (real files), security |
| game-engine       | 5          | 69      | Constraint engine, Draw Steel constraints, action pipeline, performance budget, event reducers                                    |
| **Phase 2 total** | **14**     | **178** |                                                                                                                                   |
| **Full monorepo** | **all**    | **558** | Phase 1 + Phase 2 combined                                                                                                        |

### Known Technical Debt for Phase 3

| ID       | Severity | Description                                                                                                          |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| TD-P2-01 | Medium   | Director overrides are in-memory only; should persist to DB for session recovery                                     |
| TD-P2-02 | Low      | Echelon computation from level doesn't match directory-derived echelons for edge cases (level 10 = echelon 3, not 4) |
| TD-P2-03 | Low      | `classes` and `ancestries` arrays in GameSystemData are empty stubs; full class/ancestry parsing deferred            |
| TD-P2-04 | Medium   | Character sheet renderer has no dark mode or print-friendly CSS (Sprint 12 stretch goal, not critical)               |
| TD-P2-05 | Low      | Ability browser lacks virtualized rendering for very large ability lists (>500 abilities)                            |
| TD-P2-06 | Low      | No file size limit enforcement in game system loader; relies on OS-level protections                                 |

### Extensibility for Phase 3

The architecture is ready for Phase 3 (AI Director):

- **GameSystemData** provides all parsed rules, creatures, conditions that the AI context window will need
- **ActionPipeline** can be extended with AI-proposed actions that go through the same constraint validation
- **ConstraintEngine** supports adding new constraint scopes (e.g., `narrative`, `ai_action`)
- **Director overrides** already support the "human approves AI action" workflow

## Consequences

- Phase 2 ships as v2.0 with 558 tests passing across the monorepo
- 6 items of tech debt documented for future sprints
- Architecture is extensible for Phase 3 without requiring restructuring
- Performance budget (50ms) met with significant headroom (<1ms typical)
