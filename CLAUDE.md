# CLAUDE.md - DSVTT (VTT Forge)

## Project Overview

A virtual tabletop (VTT) application for playing tabletop RPGs online. Built as a TypeScript monorepo (Turborepo + pnpm) with strict mode, Vitest for testing, ESLint + Prettier for formatting.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, react-konva, Zustand, Socket.IO client
- **Backend:** Express, Socket.IO, Prisma, PostgreSQL
- **Packages:** dice-engine, rule-parser, game-engine, events, shared, auth, ui
- **Testing:** Vitest (263+ tests across rule-parser and game-engine)
- **Validation:** Zod for runtime validation on all API endpoints and socket events

## Monorepo Structure

```
apps/
  web/          → Next.js frontend
  server/       → Express + Socket.IO backend
packages/
  auth/         → JWT, Passport, RBAC
  dice-engine/  → Dice formula parser (zero deps)
  events/       → Socket.IO event schemas
  game-engine/  → Constraint engine, action pipeline, game state
  rule-parser/  → Markdown rule file parser (sections, tables, abilities, stat blocks)
  shared/       → Types and constants (no external deps)
  ui/           → React components, shadcn/ui
prisma/         → Database schema
game_rules/     → TTRPG rule files (Draw Steel markdown + PDF)
docs/adr/       → Architecture Decision Records
```

## Key Commands

```bash
pnpm install                        # Install all dependencies
pnpm turbo run build test           # Build and test everything
pnpm --filter @dsvtt/rule-parser test   # Test rule-parser only
pnpm --filter @dsvtt/game-engine test   # Test game-engine only
pnpm --filter @dsvtt/server test        # Test server only
```

## Package Boundaries

- `packages/shared` → NO external dependencies, types and constants only
- `packages/events` → depends on shared only
- `packages/game-engine` → depends on shared and events only (isomorphic)
- `packages/dice-engine` → ZERO dependencies (pure logic)
- `packages/rule-parser` → depends on yaml only
- `apps/web` → can depend on any package
- `apps/server` → can depend on any package except ui

## Conventions

- See CONVENTIONS.md for full coding standards
- Conventional commits: `feat(scope): description`
- Files: kebab-case. Components: PascalCase. Types: PascalCase
- No `any` — use `unknown` + Zod validation
- Tests co-located with source in `__tests__/` directories

## Current State

- **Phase 1 (v1.0):** Complete — generic VTT engine (auth, lobby, maps, dice, chat, turns, event sourcing)
- **Phase 2 (v2.0):** Complete — game system loader (rule parser, constraint engine, character sheets, ability browser, Draw Steel support with 75 creatures)
- **Phase 3 (v3.0):** Not started — AI Director, adventure loader, multi-provider AI (see workflow-and-sprints.md)

## Known Gaps

- 6 missing API routes for Phase 2 (game-systems, character templates, character data, abilities, config overrides)
- No Prisma migration for Phase 2 models
- No Zustand store or parent container for game system UI components
- Character data binding / real-time sync not wired
- No frontend tests for Phase 2 React components

---

## Future Feature Roadmap

### Important

- **Multi-Map Management and Map Switching**
  Directors currently load a single map per session. They need the ability to manage multiple maps simultaneously, switch between them during play, and have players automatically transition to the correct map when the Director switches. This is essential for any adventure with more than one encounter area.
  _Area: frontend (map store, map canvas), backend (socket events, session service)_

- **Initiative Roller with System-Aware Formulas**
  The turn tracker exists but initiative must be rolled manually and entered by hand. Adding a "Roll Initiative" button that auto-populates initiative order using the loaded game system's initiative formula (e.g., Draw Steel's 2d10+agility test) and supports re-rolling and inserting combatants mid-encounter would dramatically reduce Director friction.
  _Area: frontend (turn-tracker), backend (dice-engine integration, turn-events), packages (game-engine/turns)_

- **Prisma Migration for Phase 2 Models**
  The Prisma schema defines GameSystem, RuleConstraint, CharacterTemplate, CharacterData, Ability, and GameSystemConfig models, but no migration has been generated or applied. Without this, no Phase 2 data can be persisted to PostgreSQL, blocking all game-system-aware features in production.
  _Area: backend (prisma migrations), infra (database)_

- **Missing API Layer for Phase 2 (6 endpoints)**
  The sprint plan called for game-systems CRUD, character template API, character data CRUD, ability query API, config/constraint override API, and game system selection on room creation. None of these API routes exist in `apps/server/src/api/`. Without them, the frontend Phase 2 components (CharacterSheetRenderer, AbilityBrowser, ConfigEditor) have no backend to connect to.
  _Area: backend (Express routers, services, schemas, Zod validation)_

- **Game System Zustand Store and Parent Container**
  CharacterSheetRenderer, AbilityBrowser, and ConfigEditor are built as standalone components but have no parent container wiring them together, no Zustand store for game system state (loaded constraints, templates, abilities, configs), and no Socket.IO subscription for real-time game system events (CONFIG_UPDATE, CONSTRAINT_VIOLATION, ABILITY_USE). Players and Directors cannot actually interact with the rules engine from the UI.
  _Area: frontend (new game-system-store.ts, parent GameSystemPanel component, socket subscriptions)_

- **Character Data Binding and Real-Time Sync**
  The CharacterSheetRenderer accepts data props and emits onChange events, but there is no mechanism to persist character data to the server, sync edits across clients in real time, or associate a character sheet with the game-system-aware CharacterData model. Editing a character sheet currently has no effect beyond local state.
  _Area: frontend (character-store integration), backend (character data CRUD + socket events)_

- **Condition Tracker with Visual Indicators**
  Draw Steel conditions (Bleeding, Dazed, Frightened, Grabbed, Prone, Restrained, Slowed, Taunted, Weakened) have constraint implementations but no UI for applying, tracking, or removing them from tokens/characters. A visible condition badge system on tokens and character sheets, with automatic mechanical effects, is critical for rules-enforced play.
  _Area: frontend (token-layer overlays, character sheet badges), backend (condition state in game-engine), packages (game-engine condition reducers)_

- **Damage and Healing Pipeline**
  There is no mechanism for applying damage, temporary stamina, healing, or recoveries through the UI or action pipeline. The constraint engine validates movement and action economy, but the core combat loop of dealing damage, tracking stamina, and triggering "bloodied" or "dying" states is not wired up.
  _Area: frontend (stamina controls on character sheet, damage dialog), backend (new combat event types, reducers), packages (game-engine combat events)_

- **Token-to-Character/NPC Association**
  Tokens on the map and characters/NPCs in the sidebar are separate entities with no programmatic link. Selecting a token should highlight its character sheet, moving a token should check that character's speed constraint, and clicking an NPC in the Director panel should center the map on its token. This association is fundamental to rules enforcement on the map.
  _Area: frontend (map-store + character-store cross-references), backend (token ownership model, constraint context enrichment)_

- **OAuth and Social Login (Google, Discord)**
  The VTT only supports email/password authentication. Every major competing VTT supports Discord login at minimum, and most support Google. Adding OAuth via the existing auth package with Passport strategies would dramatically lower the barrier to entry for new users, especially given the TTRPG community's heavy Discord usage.
  _Area: backend (packages/auth strategies), frontend (login page OAuth buttons), infra (OAuth credential management)_

- **WebSocket Reconnection State Recovery**
  The Socket.IO client has auto-reconnection, but when a player disconnects and reconnects, they get no state recovery -- their local Zustand stores may be stale. Implementing a "catch-up" protocol that replays missed events or sends a full state snapshot after reconnection would prevent the common problem of desynchronized clients.
  _Area: backend (socket connection.ts, event-store replay), frontend (socket-store reconnection handler)_

- **Keyboard Shortcuts and Accessibility**
  The game room has no keyboard shortcuts for common actions (Tab to cycle tools, Enter to end turn, Escape to deselect, Ctrl+R to roll dice). The map canvas also lacks ARIA labels and keyboard navigation for tokens. For both power users and accessibility compliance, this is a significant gap.
  _Area: frontend (hotkey system, ARIA attributes on map/UI components)_

- **Terrain and Difficult Terrain System**
  The sprint plan explicitly notes "no terrain cost system" as a known gap. Draw Steel and most TTRPGs have difficult terrain, hazardous terrain, and special movement costs. Without this, the movement speed constraint is incomplete -- it validates total distance but ignores terrain modifiers.
  _Area: frontend (map terrain layer, terrain painting tool), backend (terrain data model), packages (game-engine terrain-aware movement constraint)_

- **Mobile-Responsive Layout**
  The game room uses a fixed ResizablePanels layout that assumes a desktop viewport. The VTT is unusable on tablets or phones, which is where many players join sessions. A responsive layout with a bottom navigation bar, swipeable panels, and touch-optimized token dragging would expand the accessible user base significantly.
  _Area: frontend (responsive breakpoints, mobile layout, touch event handlers on map canvas)_

- **Invitation Links and Room Sharing**
  Players currently need to manually browse the lobby to find rooms. Adding shareable invitation links (e.g., `/join/abc123`) with optional passwords would match the workflow of every other VTT and eliminate the friction of coordinating game sessions.
  _Area: backend (room invite token generation, join-by-link endpoint), frontend (invite link UI, join flow)_

### Nice-to-Have

- **3D Dice Animation**
  The dice roller shows results as text with a simple animation. Implementing 3D dice physics (using Three.js or @3d-dice/dice-box) that roll across the screen with realistic physics would add significant visual delight and is a hallmark feature of premium VTTs like Foundry.
  _Area: frontend (new dice-animation component, Three.js integration)_

- **Map Drawing and Annotation Tools**
  The map canvas supports backgrounds, tokens, and fog, but has no freehand drawing, shapes, text labels, or measurement rulers. Directors need to sketch walls, mark areas of effect, draw arrows, and annotate maps in real time during play.
  _Area: frontend (new annotation layer in react-konva, drawing tool modes), backend (annotation persistence, socket events)_

- **Audio/Music Integration**
  Background music and ambient sound are a staple of immersive VTT sessions. A simple audio panel where the Director can play/pause shared audio tracks that all players hear simultaneously would significantly enhance atmosphere.
  _Area: frontend (audio player component, Web Audio API), backend (audio state sync via socket), infra (audio file storage)_

- **Custom Token Art Upload**
  Tokens currently accept an imageUrl but there is no UI for players to upload custom token art. A token art picker with upload, crop-to-circle, and a gallery of recently used tokens would improve personalization.
  _Area: frontend (token art upload modal, image cropper), backend (file upload for token art)_

- **Macro System for Repeated Actions**
  Players frequently repeat the same dice rolls and actions. A macro system where players can save named actions that pre-fill dice formulas, apply ability effects, and execute multi-step sequences with one click would dramatically speed up combat.
  _Area: frontend (macro editor, macro bar component), backend (macro storage per character/user)_

- **Session Scheduling and Calendar**
  A built-in session scheduler with recurring game nights, timezone-aware scheduling, and RSVP tracking would help groups coordinate without relying on external tools. Integration with Google Calendar or iCal export would be a bonus.
  _Area: frontend (calendar UI, scheduling modal), backend (session schedule CRUD, notification service)_

- **Combat Log and Damage History**
  A structured combat log that shows "Goblin Archer attacks Thane for 8 damage (stamina: 21 -> 13)" rather than raw event data would help players track what happened during complex encounters, especially when they step away momentarily.
  _Area: frontend (combat log panel, formatted event display), backend (combat event enrichment)_

- **Fog of War with Line-of-Sight Calculation**
  The current fog of war is manually toggled region-by-region. Automatic line-of-sight calculation based on token positions and wall segments would allow dynamic fog that reveals only what each player's character can actually see, matching Foundry VTT's most-loved feature.
  _Area: frontend (wall drawing tool, LOS raycasting per token), backend (wall segment model, per-player fog state)_

- **Multi-Game-System Support Testing (D&D 5e, Pathfinder 2e)**
  The rule parser and constraint engine are designed to be system-agnostic, but only Draw Steel has been implemented. Creating a second game system definition would validate the extensibility claims, uncover assumptions baked into the Draw Steel implementation, and broaden the potential user base.
  _Area: packages (rule-parser test fixtures), game_rules/ (new system folder), backend (loader validation)_

- **Campaign Persistence Across Sessions**
  Each game session is currently self-contained. Characters, NPC states, map positions, and narrative progress should persist across multiple sessions within a campaign. A campaign model that links rooms to a persistent world state and session history is needed for long-running games.
  _Area: backend (campaign model, cross-session state migration), frontend (campaign dashboard, session history timeline)_

- **Player Handout System**
  The Director should be able to push images, text excerpts, or documents to specific players during play. A handout system with Director-controlled visibility and a player handout gallery would support common narrative techniques.
  _Area: frontend (handout viewer, Director handout push UI), backend (handout CRUD, player-specific visibility)_

- **Dice Roll Modifiers and Advantage/Disadvantage**
  The dice engine supports formula parsing but has no UI for common modifiers like advantage (roll twice, take higher), disadvantage, or situational bonuses. Quick-toggle buttons next to the roll button would speed up gameplay.
  _Area: frontend (modifier toggle UI on dice roller), packages (dice-engine modifier chain)_

- **Export/Import Session Data**
  Directors should be able to export a full session (maps, tokens, characters, chat logs, event history) as a portable archive and import it into another VTT Forge instance. This supports backup, migration, and sharing of game content.
  _Area: backend (export service, archive format), frontend (export/import UI), infra (large file handling)_

- **Spectator Mode**
  Allow read-only spectators to watch a live game session without being able to interact. Useful for streaming, for new players learning the system, or for Directors reviewing another Director's technique.
  _Area: backend (spectator role in RBAC, read-only socket events), frontend (spectator UI with hidden Director-only content)_

- **Plugin/Extension Architecture**
  A plugin system that allows third-party developers to add custom dice notations, character sheet sections, map tools, or constraint types without modifying core code. Could follow Foundry VTT's module system as inspiration.
  _Area: packages (plugin loader, hook system, sandboxed execution), backend (plugin registry), frontend (plugin UI injection points)_

- **Internationalization (i18n)**
  All UI strings are currently hardcoded in English. Extracting strings into locale files and supporting multiple languages would open the VTT to the large non-English TTRPG communities.
  _Area: frontend (i18n framework like next-intl, locale files), packages (localized string keys)_

- **Undo/Redo for Director Actions**
  The event-sourced architecture makes undo/redo theoretically possible. Implementing a Director-accessible undo stack for accidental token deletions, fog reveals, or NPC changes would reduce the cost of mistakes during live sessions.
  _Area: backend (compensating events in event store), frontend (undo/redo controls, Ctrl+Z handling)_

- **Performance Dashboard for Directors**
  A real-time overlay showing WebSocket latency, constraint evaluation time, number of connected clients, and event throughput. The constraint engine already tracks evaluationTimeMs, so surfacing this data is low-hanging fruit.
  _Area: frontend (performance overlay component), backend (metrics endpoint)_

- **Animated Token Effects and Status Rings**
  Visual effects on tokens like pulsing health rings, animated spell effects, and death markers would make the map more readable at a glance. CSS/SVG animations on the Konva canvas for common status indicators are achievable with the existing react-konva setup.
  _Area: frontend (token effect layer, SVG animation components)_

- **Voice and Video Chat Integration**
  While most groups use Discord for voice, embedding WebRTC-based voice/video directly in the VTT would reduce the number of applications players need open. Even a simple push-to-talk audio channel would add value.
  _Area: frontend (WebRTC media components), backend (signaling server), infra (TURN/STUN server)_
