# DSVTT - Workflow & Sprint Planning

## Parallel Track Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COORDINATION TRACK                            │
│              Arch (Opus 4.6) + Sage (Opus 4.6)                  │
│  Sprint planning, ADRs, roadmap, cross-track sync              │
└────────────────────────┬────────────────────────────────────────┘
                         │ Coordinates
          ┌──────────────┼──────────────┬─────────────────┐
          ▼              ▼              ▼                  ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐
│  FRONTEND   │ │   BACKEND    │ │ INFRA TRACK  │ │  QUALITY   │
│   TRACK     │ │    TRACK     │ │              │ │   TRACK    │
│             │ │              │ │              │ │            │
│ Pixel (S45) │ │ Forge (S45)  │ │ Harbor (S45) │ │ Vigil(S45) │
│ React (S45) │ │ Schema (O46) │ │ Sentinel(S45)│ │            │
└─────────────┘ └──────────────┘ └──────────────┘ └────────────┘
      │                │                │                │
      └────────────────┴────────────────┴────────────────┘
               Sync at Sprint Boundaries + Phase Gates

All documentation output → Haiku 4.5
O46 = Opus 4.6 | S45 = Sonnet 4.5
```

## Sprint Cadence (2-week sprints)

### Sprint Ceremonies

| Ceremony          | When                  | Duration | Participants        | Led By |
|-------------------|-----------------------|----------|---------------------|--------|
| Sprint Planning   | Day 1 (Monday)        | 2 hours  | All agents          | Sage   |
| Daily Standup     | Daily                 | 15 min   | All agents          | Arch   |
| Track Sync        | Wed + Fri             | 30 min   | Track leads + Arch  | Arch   |
| Sprint Review     | Last Friday           | 1 hour   | All agents + User   | Sage   |
| Sprint Retro      | Last Friday           | 45 min   | All agents          | Arch   |
| Backlog Grooming  | Mid-sprint Wednesday  | 1 hour   | Sage + Arch + leads | Sage   |
| **Phase Gate**    | **End of Phase**      | **2 hrs**| **All + User**      | **Sage + Arch** |

### Standup Format (per agent)

```
1. What I completed since last standup
2. What I'm working on today
3. Any blockers or cross-track dependencies
```

---

## Project Overview

```
PHASE 1: Generic VTT Engine      (Sprints 1-7)   → v1.0 Release
PHASE 2: Game System Loader       (Sprints 8-12)  → v2.0 Release
PHASE 3: Adventure Loader + AI    (Sprints 13-19) → v3.0 Release

Total: 19 sprints = 38 weeks (~9.5 months)
```

| Phase | Sprints | Weeks | Deliverable | Description |
|-------|---------|-------|-------------|-------------|
| 1     | 1-7     | 14    | v1.0        | Fully functional VTT for any RPG. No AI. No game-specific rules. |
| 2     | 8-12    | 10    | v2.0        | Load game rules from MD files. Constraint engine. PDF-based character sheets with abilities. |
| 3     | 13-19   | 14    | v3.0        | Adventure loader (PDF + maps). Multi-provider AI. Supervised autopilot AI Director. |

---

# PHASE 1: Generic VTT Engine (Sprints 1-7)

**Goal:** A fully functional virtual tabletop that any group can use to play any RPG system. No AI. No game-specific rules. Pure tabletop platform. Ships as **v1.0**.

**Key Features:**
- Auth (email/password, JWT, Director/Player RBAC)
- Lobby with room creation/joining
- 2D grid maps with tokens, fog of war
- Dice rolling engine with formula parser
- Text chat (IC/OOC channels, whisper)
- Turn management system
- Director control panel (NPCs, world events)
- Minimal character sheet (free-form stats + notes)
- Event sourcing for full session recording + replay
- Full-text search across chat and content

---

### Sprint 1 - "Lay the Foundation"

**Sprint Goal:** Monorepo scaffolded, CI/CD pipeline running, Docker dev env, database schema v1, auth operational.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Define monorepo structure, create turbo.json, base tsconfigs | 5 |
| Coordination | Arch (Opus) | Write ADR-001 (Monorepo), ADR-002 (Event Sourcing) | 3 |
| Coordination | Sage (Opus) | Write Phase 1 user stories + acceptance criteria | 5 |
| Coordination | Sage (Opus) | Define acceptance criteria for auth + lobby | 3 |
| Backend | Schema (Opus) | Design Prisma schema v1 (users, rooms, sessions, events, maps, tokens, chat) | 8 |
| Backend | Schema (Opus) | Create seed data script | 3 |
| Backend | Forge (Sonnet) | Scaffold Express + Socket.IO server | 5 |
| Backend | Forge (Sonnet) | Implement auth endpoints (register, login, refresh JWT) | 8 |
| Frontend | Pixel (Sonnet) | Create Tailwind theme with TTRPG aesthetic | 5 |
| Frontend | Pixel (Sonnet) | Design login/register pages + lobby wireframes | 5 |
| Frontend | React (Sonnet) | Scaffold Next.js 14 app with App Router | 3 |
| Frontend | React (Sonnet) | Implement auth pages (login, register) | 5 |
| Infra | Harbor (Sonnet) | Create Dockerfiles + docker-compose.dev.yml | 8 |
| Infra | Harbor (Sonnet) | Set up Jenkins pipeline (build + lint + test) | 8 |
| Infra | Sentinel (Sonnet) | Set up Passport.js local strategy + JWT | 5 |
| Infra | Sentinel (Sonnet) | Implement RBAC middleware (Director/Player) | 5 |
| Quality | Vigil (Sonnet) | Set up Vitest + Playwright + test infrastructure | 5 |
| Quality | Vigil (Sonnet) | Write auth API integration tests | 5 |
| **Total** | | | **~91** |

---

### Sprint 2 - "Lobby & Rooms"

**Sprint Goal:** Socket.IO real-time connection, lobby with room list, room creation/join, Director/Player role assignment.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Write ADR-003 (Socket.IO Protocol), define all event schemas in packages/events | 8 |
| Coordination | Arch (Opus) | Define shared types package (packages/shared) | 5 |
| Backend | Forge (Sonnet) | Implement Socket.IO connection with auth handshake | 8 |
| Backend | Forge (Sonnet) | Implement room CRUD API (create, list, join, leave, delete) | 8 |
| Backend | Forge (Sonnet) | Implement room Socket.IO events (ROOM_JOIN, ROOM_LEAVE, ROOM_CREATED) | 5 |
| Backend | Schema (Opus) | Finalize room + session schema, add player_sessions junction table | 5 |
| Frontend | Pixel (Sonnet) | Design lobby room list, room creation modal, room detail view | 8 |
| Frontend | React (Sonnet) | Implement Socket.IO client connection + auto-reconnection | 8 |
| Frontend | React (Sonnet) | Implement lobby page with room list + room creation flow | 8 |
| Frontend | React (Sonnet) | Implement room join flow with role selection (Director/Player) | 5 |
| Infra | Harbor (Sonnet) | Set up ELK stack with docker-compose.elk.yml | 8 |
| Infra | Sentinel (Sonnet) | Rate limiting on auth + API endpoints | 5 |
| Infra | Sentinel (Sonnet) | Security headers + CSP, WebSocket origin validation | 5 |
| Quality | Vigil (Sonnet) | Write E2E tests for auth flow + lobby + room join | 8 |
| Quality | Vigil (Sonnet) | Write Socket.IO connection/reconnection tests | 5 |
| **Total** | | | **~101** |

---

### Sprint 3 - "The Map Awakens"

**Sprint Goal:** 2D grid map with token placement, drag-and-drop movement, fog of war, real-time sync across clients.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Write ADR-004 (Map Rendering Architecture), define map event schemas | 5 |
| Backend | Forge (Sonnet) | Map CRUD API (upload background image, set grid size, save/load) | 8 |
| Backend | Forge (Sonnet) | Token Socket.IO events (TOKEN_MOVE, TOKEN_ADD, TOKEN_REMOVE) + broadcast | 8 |
| Backend | Forge (Sonnet) | Map state sync: new player joining gets current map state | 5 |
| Backend | Forge (Sonnet) | Fog of war server-side state (Director controls visibility regions) | 8 |
| Backend | Schema (Opus) | Map + token + fog_of_war database models, image storage strategy | 5 |
| Frontend | Pixel (Sonnet) | Design map canvas UI (toolbar, layers panel, token tray) | 8 |
| Frontend | Pixel (Sonnet) | Design fog of war visual treatment + Director fog editing tools | 5 |
| Frontend | React (Sonnet) | react-konva map canvas with grid overlay, pan, zoom | 13 |
| Frontend | React (Sonnet) | Token rendering, selection, drag-and-drop snap-to-grid | 8 |
| Frontend | React (Sonnet) | Fog of war renderer (player view vs Director view) | 8 |
| Frontend | React (Sonnet) | Map image upload + background layer | 5 |
| Infra | Harbor (Sonnet) | File upload infrastructure (map images storage, serve static assets) | 5 |
| Quality | Vigil (Sonnet) | Map interaction E2E tests (token move, fog toggle, multi-client sync) | 8 |
| Quality | Vigil (Sonnet) | Map component Storybook stories | 3 |
| **Total** | | | **~102** |

---

### Sprint 4 - "Roll for Initiative"

**Sprint Goal:** Dice rolling engine with formula parser, turn management system, text chat (IC/OOC channels, whisper).

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Mid-phase review, adjust Sprint 5-7 priorities based on velocity | 3 |
| Backend | Forge (Sonnet) | Dice formula parser package: "2d6+3", "4d8kh3", exploding dice | 13 |
| Backend | Forge (Sonnet) | Dice rolling Socket.IO events (DICE_ROLL, DICE_RESULT, private rolls) | 5 |
| Backend | Forge (Sonnet) | Turn order management system (initiative, round tracking, skip, delay) | 8 |
| Backend | Forge (Sonnet) | Text chat backend: IC/OOC channels, whisper, message persistence | 8 |
| Backend | Schema (Opus) | Chat messages table (with full-text search tsvector), dice_rolls table | 5 |
| Frontend | Pixel (Sonnet) | Design dice roller UI (input bar, roll results, roll history panel) | 5 |
| Frontend | Pixel (Sonnet) | Design chat panel (IC/OOC tabs, whisper styling, timestamps) | 5 |
| Frontend | Pixel (Sonnet) | Design turn tracker bar (initiative order, current turn highlight) | 5 |
| Frontend | React (Sonnet) | Implement dice roller with formula input + animated results | 8 |
| Frontend | React (Sonnet) | Implement chat panel with IC/OOC channels + whisper | 8 |
| Frontend | React (Sonnet) | Implement turn tracker component | 5 |
| Quality | Vigil (Sonnet) | Dice parser unit tests (all notation variants, edge cases, invalid input) | 8 |
| Quality | Vigil (Sonnet) | Dice fairness/distribution tests (statistical validation) | 3 |
| Quality | Vigil (Sonnet) | Chat + turn management E2E tests | 5 |
| **Total** | | | **~96** |

---

### Sprint 5 - "Director & Player Tools"

**Sprint Goal:** Director control panel (NPC management, world events), Player action panel, minimal character sheet (notes + stats), shared notes, resizable game room layout.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Design game room layout architecture (resizable panel system) | 5 |
| Backend | Forge (Sonnet) | Director API: create/edit NPCs, set NPC tokens, trigger narrative events | 8 |
| Backend | Forge (Sonnet) | Character CRUD API (create, read, update, per-player ownership) | 8 |
| Backend | Forge (Sonnet) | Shared notes API (collaborative document per session) | 5 |
| Backend | Schema (Opus) | Characters table (generic: name, stats JSON, notes, inventory JSON) | 5 |
| Backend | Schema (Opus) | NPCs table, shared_notes table | 3 |
| Frontend | Pixel (Sonnet) | Design Director control panel (NPC list, world event triggers, secret notes) | 8 |
| Frontend | Pixel (Sonnet) | Design minimal character sheet (name, stat block, notes, inventory) | 5 |
| Frontend | Pixel (Sonnet) | Design game room panel layout (resizable: map, chat, sheet, tools) | 5 |
| Frontend | React (Sonnet) | Implement Director control panel | 8 |
| Frontend | React (Sonnet) | Implement minimal character sheet (free-form stats, notes, inventory) | 8 |
| Frontend | React (Sonnet) | Implement resizable panel layout for game room | 8 |
| Frontend | React (Sonnet) | Implement shared notes panel (simple collaborative editor) | 5 |
| Quality | Vigil (Sonnet) | E2E: Director creates NPC, assigns token, player sees on map | 5 |
| Quality | Vigil (Sonnet) | E2E: Character sheet CRUD, shared notes real-time sync | 5 |
| **Total** | | | **~91** |

---

### Sprint 6 - "Time Capsule"

**Sprint Goal:** Event sourcing for full session recording, session replay viewer, full-text search across chat and content.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Write ADR-005 (Event Sourcing Implementation), define event replay protocol | 8 |
| Backend | Forge (Sonnet) | Event store implementation: persist all game events with sequence numbers | 13 |
| Backend | Forge (Sonnet) | Session replay API: load events by session, stream in sequence order | 8 |
| Backend | Forge (Sonnet) | Snapshot system: periodic state snapshots for replay performance | 5 |
| Backend | Forge (Sonnet) | Full-text search API (chat messages, notes, character data) | 5 |
| Backend | Schema (Opus) | Event log table optimization (indexes, partitioning strategy) | 5 |
| Backend | Schema (Opus) | Full-text search indexes (tsvector on chat, notes, characters) | 5 |
| Frontend | Pixel (Sonnet) | Design session replay UI (timeline scrubber, playback controls, speed) | 5 |
| Frontend | Pixel (Sonnet) | Design search UI (global search bar, filtered results panel) | 3 |
| Frontend | React (Sonnet) | Implement session replay viewer (read-only game state playback) | 13 |
| Frontend | React (Sonnet) | Implement search (chat history, notes, characters) | 5 |
| Infra | Harbor (Sonnet) | Configure Logstash pipeline for game event ingestion into ELK | 5 |
| Quality | Vigil (Sonnet) | Event sourcing tests: record session, replay, verify state matches live | 8 |
| Quality | Vigil (Sonnet) | Search accuracy tests (relevance, multi-field, partial match) | 3 |
| **Total** | | | **~91** |

---

### Sprint 7 - "Ship It (v1.0)"

**Sprint Goal:** Security audit, load testing at 50 concurrent users, production deployment, bug fixes, UX polish. **Release v1.0.**

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Final acceptance testing against all Phase 1 user stories | 5 |
| Coordination | Sage (Opus) | Write v1.0 release notes | 2 |
| Coordination | Arch (Opus) | Architecture review: identify tech debt, document for Phase 2 | 5 |
| Backend | Forge (Sonnet) | Bug fixes from QA backlog | 8 |
| Backend | Forge (Sonnet) | API performance optimization (N+1 queries, connection pooling) | 5 |
| Frontend | Pixel (Sonnet) | UX polish pass (animations, loading states, error states, empty states) | 8 |
| Frontend | React (Sonnet) | Bug fixes from QA backlog | 8 |
| Frontend | React (Sonnet) | Performance optimization (canvas rendering, bundle size, lazy loading) | 5 |
| Infra | Harbor (Sonnet) | Production docker-compose.prod.yml + Nginx SSL config | 8 |
| Infra | Harbor (Sonnet) | Jenkins production deploy pipeline (build, test, deploy, rollback) | 8 |
| Infra | Harbor (Sonnet) | ELK monitoring dashboards + alerting rules | 5 |
| Infra | Sentinel (Sonnet) | Full security audit (OWASP Top 10, WebSocket, auth, input validation) | 8 |
| Infra | Sentinel (Sonnet) | Dependency vulnerability scan, Docker hardening | 5 |
| Quality | Vigil (Sonnet) | Full E2E regression suite for all Phase 1 features | 8 |
| Quality | Vigil (Sonnet) | Load test: 50 concurrent users, WebSocket stress test (k6) | 8 |
| Quality | Vigil (Sonnet) | Accessibility audit (axe-core) | 3 |
| **Total** | | | **~101** |

### Phase 1 Gate: v1.0 Release

**Release Criteria:**
- All Phase 1 user stories accepted by Sage
- E2E regression suite green
- Load test passing at 50 concurrent users
- Security audit clean (no critical/high findings)
- Production deployment successful
- Monitoring and alerting operational

---

# PHASE 2: Game System Loader (Sprints 8-12)

**Goal:** Load TTRPG rule files (e.g., MCDM's Draw Steel) from a `game_rules/` folder. VTT parses rules and enforces game-specific constraints. Character sheets rebuilt in React from PDF template layout with stats section (skills last), followed by a 3-tab ability browser (Actions / Maneuvers / Triggered). Ships as **v2.0**.

**Prerequisite:** User places rule MD files + character sheet PDF template in `game_rules/{system-name}/`.

**Key Features:**
- Markdown rule parser -> constraint engine
- `game_rules/` folder loader with validation
- Game system selection on room creation
- Character sheet matching PDF template (stats, skills)
- 3-tab ability browser (Actions / Maneuvers / Triggered) within character sheet
- Ability filtering by class, race, level with expandable descriptions
- Rules enforcement on game actions (movement, combat, action economy)
- Director override for any constraint
- Config editor for rule tweaks

---

### Sprint 8 - "The Rules Engine"

**Sprint Goal:** MD rule parser, game constraint engine core, `game_rules/` folder structure spec and loader with validation.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Analyze provided TTRPG MD files, identify all constrainable behaviors | 8 |
| Coordination | Sage (Opus) | Write Phase 2 user stories + acceptance criteria | 5 |
| Coordination | Arch (Opus) | Write ADR-006 (Rules Engine Architecture), define constraint model | 8 |
| Coordination | Arch (Opus) | Define game_rules/ folder structure spec (required files, naming, validation) | 5 |
| Backend | Forge (Sonnet) | Build MD rule parser (packages/rule-parser): parse sections, tables, stat blocks | 13 |
| Backend | Forge (Sonnet) | Build constraint engine core: evaluate rules against game actions | 13 |
| Backend | Forge (Sonnet) | game_rules/ folder loader: validate structure, register game system in DB | 5 |
| Backend | Schema (Opus) | Game systems table, rule_constraints table, game_system_configs table | 5 |
| Frontend | React (Sonnet) | Game system selection dropdown on room creation | 3 |
| Quality | Vigil (Sonnet) | Rule parser unit tests with sample MD files (various formats, edge cases) | 8 |
| Quality | Vigil (Sonnet) | Constraint engine tests (valid action passes, invalid action blocked, edge cases) | 8 |
| **Total** | | | **~81** |

---

### Sprint 9 - "The Character Sheet"

**Sprint Goal:** PDF template analyzed -> React character sheet renderer built. Stats section with skills as last item. Live data binding to game state with real-time sync.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Write ADR-007 (Character Sheet Rendering), define field mapping spec | 5 |
| Backend | Forge (Sonnet) | Character sheet template API: store field definitions per game system | 8 |
| Backend | Forge (Sonnet) | Character data API: CRUD for system-specific character data with validation | 5 |
| Backend | Schema (Opus) | character_templates table (fields, types, sections per game system) | 5 |
| Backend | Schema (Opus) | character_data table (player character values per template) | 3 |
| Frontend | Pixel (Sonnet) | Design character sheet layout matching PDF template visual style | 8 |
| Frontend | Pixel (Sonnet) | Design stat block component (attributes, derived stats, skills positioned last) | 5 |
| Frontend | React (Sonnet) | Build character sheet renderer engine (template definition -> React components) | 13 |
| Frontend | React (Sonnet) | Implement stat section (attributes with modifiers, derived values, computed fields) | 8 |
| Frontend | React (Sonnet) | Implement skills section (skill list with proficiency/bonuses, last in stats block) | 5 |
| Frontend | React (Sonnet) | Data binding: character sheet fields <-> game state <-> server real-time sync | 8 |
| Quality | Vigil (Sonnet) | Character sheet rendering tests (all field types display, layout matches spec) | 5 |
| Quality | Vigil (Sonnet) | Data binding tests (edit field -> server sync -> other clients see update) | 5 |
| **Total** | | | **~83** |

---

### Sprint 10 - "Abilities Unleashed"

**Sprint Goal:** 3-tab ability browser (Actions / Maneuvers / Triggered) as part of character sheet. Expandable ability cards filtered by class, race, and level with full descriptions from rules.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Define ability categorization rules from MD files (action/maneuver/triggered) | 5 |
| Backend | Forge (Sonnet) | Ability parser: extract abilities from rules MD, categorize by type (A/M/T) | 13 |
| Backend | Forge (Sonnet) | Ability query API: filter by class, race, level, type with pagination | 8 |
| Backend | Forge (Sonnet) | Ability unlock logic: character level + class + race -> available abilities list | 5 |
| Backend | Schema (Opus) | Abilities table (name, type, description, class, race, level_req, game_system) | 5 |
| Frontend | Pixel (Sonnet) | Design 3-tab ability browser (Actions / Maneuvers / Triggered tabs) | 8 |
| Frontend | Pixel (Sonnet) | Design expandable ability card (name, type tags, cost, full rich-text description) | 5 |
| Frontend | React (Sonnet) | Implement 3-tab layout integrated below stats section in character sheet panel | 8 |
| Frontend | React (Sonnet) | Implement expandable ability list with class/race/level filtering | 8 |
| Frontend | React (Sonnet) | Implement ability card component (markdown description rendering from rules) | 5 |
| Frontend | React (Sonnet) | Integrate ability browser below stats section in character sheet view | 5 |
| Quality | Vigil (Sonnet) | Ability parser tests (correct categorization, no missing abilities, all types) | 8 |
| Quality | Vigil (Sonnet) | E2E: level up character -> new abilities appear in correct tabs | 5 |
| **Total** | | | **~88** |

---

### Sprint 11 - "Rules Enforcement"

**Sprint Goal:** Constraints wired into live gameplay. Game system auto-loaded on room creation. Config editor for Director to override/tweak rules. Player actions validated against game system.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Define constraint hook points (turn actions, movement, skill checks, combat) | 8 |
| Backend | Forge (Sonnet) | Wire constraint engine into game action pipeline (validate before apply) | 13 |
| Backend | Forge (Sonnet) | Movement constraints (speed limits, terrain costs, opportunity triggers) | 8 |
| Backend | Forge (Sonnet) | Combat action constraints (action economy per system: actions, maneuvers, triggered) | 8 |
| Backend | Forge (Sonnet) | Director override API (bypass specific constraints for a session/action) | 5 |
| Backend | Forge (Sonnet) | Game config JSON Schema generator from parsed rules (tweakable settings) | 8 |
| Frontend | Pixel (Sonnet) | Design config editor UI (toggleable rule overrides, Director-only panel) | 5 |
| Frontend | React (Sonnet) | Implement config editor (visual JSON Schema form for rule tweaks) | 8 |
| Frontend | React (Sonnet) | Player action validation feedback (greyed-out actions, reason tooltips, cost display) | 5 |
| Quality | Vigil (Sonnet) | Constraint enforcement E2E (player can't exceed movement, action economy works) | 8 |
| Quality | Vigil (Sonnet) | Director override tests (bypass constraint -> action succeeds, re-enable -> blocked) | 5 |
| **Total** | | | **~81** |

---

### Sprint 12 - "Ship It (v2.0)"

**Sprint Goal:** Phase 2 hardening. Full integration test with Draw Steel rules loaded. Security review of rule file parsing. Production deploy v2.0.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Full acceptance test: load Draw Steel rules -> create characters -> play encounter | 8 |
| Coordination | Sage (Opus) | Write v2.0 release notes | 2 |
| Coordination | Arch (Opus) | Architecture review: rules engine extensibility, identify tech debt for Phase 3 | 5 |
| Backend | Forge (Sonnet) | Bug fixes from QA backlog | 8 |
| Backend | Forge (Sonnet) | Performance: rules evaluation latency budget (<50ms per action validation) | 5 |
| Frontend | Pixel (Sonnet) | Character sheet polish (spacing, responsive, dark mode, print-friendly view) | 5 |
| Frontend | React (Sonnet) | Bug fixes from QA backlog | 8 |
| Frontend | React (Sonnet) | Ability list performance (virtualized rendering for large ability lists) | 5 |
| Infra | Harbor (Sonnet) | Update production deployment for Phase 2 services | 5 |
| Infra | Sentinel (Sonnet) | Security review: rule file parsing (path traversal, injection, malicious MD) | 5 |
| Quality | Vigil (Sonnet) | Full regression suite (Phase 1 + Phase 2 combined) | 8 |
| Quality | Vigil (Sonnet) | Load test with game system loaded (constraint eval under concurrent load) | 5 |
| Quality | Vigil (Sonnet) | E2E: create room with Draw Steel -> make characters -> use abilities -> play encounter | 8 |
| **Total** | | | **~77** |

### Phase 2 Gate: v2.0 Release

**Release Criteria:**
- Draw Steel (or test game system) fully loaded and playable
- Character sheet renders matching PDF template layout
- Ability tabs (A/M/T) working with correct filtering
- Constraint engine enforcing rules with <50ms latency
- Director can override any constraint
- Phase 1 + Phase 2 regression suite green
- Security audit clean for file parsing

---

# PHASE 3: Adventure Loader + AI Director (Sprints 13-19)

**Goal:** Directors can load adventure folders (PDFs + map images) following a standard format. Multi-provider AI (Claude, GPT, Ollama) integration. AI Director runs adventures in supervised autopilot mode - it narrates, controls NPCs, manages encounters, but humans can see what AI plans to do and override/intervene at any point. Ships as **v3.0**.

**Key Features:**
- Multi-provider AI abstraction (Anthropic Claude, OpenAI GPT, Ollama local)
- Standard adventure folder format spec
- PDF adventure text extraction + structure detection
- Map image ingestion (associated with encounters)
- Pregen character loader
- Adventure structure model (story arcs, chapters, encounters, NPCs, loot)
- AI Director: supervised autopilot (proposes -> human previews -> approves/modifies)
- AI narrative engine (read-aloud text, scene descriptions, NPC dialogue)
- AI combat management (NPC turns, ability selection, targeting)
- Human override: take over from AI at any point, hand back
- Adventure browser UI (select from loaded adventures or upload new)
- AI provider configuration per session

---

### Sprint 13 - "The AI Awakens"

**Sprint Goal:** Multi-provider AI abstraction layer, streaming responses via Socket.IO, prompt engine foundation, AI security threat model.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Write Phase 3 user stories, define AI Director behavior spec | 8 |
| Coordination | Arch (Opus) | Write ADR-008 (AI Provider Abstraction), ADR-009 (AI Director Architecture) | 8 |
| Coordination | Arch (Opus) | Define adventure folder standard format spec document | 5 |
| Backend | Forge (Sonnet) | Build packages/ai-providers: abstract base provider, factory pattern | 8 |
| Backend | Forge (Sonnet) | Implement Anthropic (Claude) provider with streaming support | 8 |
| Backend | Forge (Sonnet) | Implement OpenAI (GPT) provider with streaming support | 5 |
| Backend | Forge (Sonnet) | Implement Ollama (local LLM) provider | 5 |
| Backend | Forge (Sonnet) | AI response streaming via Socket.IO (AI_STREAM_START, AI_STREAM_CHUNK, AI_STREAM_END) | 8 |
| Backend | Schema (Opus) | AI provider configs table, AI conversation_history table, AI sessions table | 5 |
| Infra | Sentinel (Sonnet) | Prompt injection threat model, input sanitization for AI context, output filtering | 8 |
| Quality | Vigil (Sonnet) | AI provider integration tests (mock + live for each provider) | 8 |
| Quality | Vigil (Sonnet) | Streaming tests (chunks arrive in order, handle disconnects, timeout handling) | 5 |
| **Total** | | | **~81** |

---

### Sprint 14 - "Adventure Format & Parser"

**Sprint Goal:** Standard adventure folder format finalized. PDF text extraction pipeline. Map image ingestion. Pregen character loader. Adventure upload flow.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Finalize adventure folder spec (directory layout, naming, required/optional files) | 5 |
| Backend | Forge (Sonnet) | Adventure folder validator (check structure against spec, report errors) | 5 |
| Backend | Forge (Sonnet) | PDF text extraction pipeline (pdf-parse: extract text, detect sections, tables) | 13 |
| Backend | Forge (Sonnet) | PDF section detector: identify chapters, encounters, NPC stat blocks, read-aloud | 8 |
| Backend | Forge (Sonnet) | Map image ingestion: associate map files with encounters by naming convention | 5 |
| Backend | Forge (Sonnet) | Pregen character loader: parse pregen JSON/MD files -> create characters in system | 8 |
| Backend | Schema (Opus) | Adventures, adventure_chapters, adventure_encounters, adventure_maps, adventure_pregens tables | 8 |
| Frontend | Pixel (Sonnet) | Design adventure upload UI (folder selection, validation progress bar, error display) | 5 |
| Frontend | React (Sonnet) | Implement adventure upload flow with progress indicator and validation feedback | 5 |
| Quality | Vigil (Sonnet) | PDF parser tests with sample adventure PDFs (section detection accuracy) | 8 |
| Quality | Vigil (Sonnet) | Adventure folder validation tests (valid/invalid structures, missing files) | 5 |
| **Total** | | | **~75** |

**Adventure Folder Standard Format:**
```
adventures/{adventure-name}/
├── adventure.json              # Metadata: title, system, level range, description
├── story/
│   └── adventure-book.pdf      # Main adventure PDF
├── maps/
│   ├── enc-01-goblin-cave.png  # Map per encounter (enc-{nn}-{name}.{ext})
│   ├── enc-02-dark-forest.png
│   └── world-map.png           # Optional overview map
├── pregens/                    # Optional pregen characters
│   ├── fighter.json
│   ├── wizard.json
│   └── rogue.json
└── handouts/                   # Optional player handouts
    ├── letter-from-king.png
    └── treasure-map.png
```

---

### Sprint 15 - "Adventure Structure"

**Sprint Goal:** Parsed PDF content structured into adventure model (story arcs, encounters, NPCs, loot, read-aloud text). AI-assisted extraction for ambiguous content. Adventure stored ready for AI Director consumption.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Define adventure structure data model (how AI Director will consume it) | 8 |
| Backend | Forge (Sonnet) | Adventure structure builder: parsed PDF text -> structured adventure model in DB | 13 |
| Backend | Forge (Sonnet) | AI-assisted extraction: use AI to identify NPCs, encounters, loot from PDF text | 8 |
| Backend | Forge (Sonnet) | Adventure CRUD API: list, get details, create from upload, update/correct | 5 |
| Backend | Forge (Sonnet) | Encounter model: linked map, NPCs with stat blocks, triggers, conditions, loot tables, read-aloud | 8 |
| Backend | Schema (Opus) | encounter_npcs, encounter_loot, encounter_triggers, read_aloud_text tables | 5 |
| Frontend | Pixel (Sonnet) | Design adventure detail/preview page (chapter list, encounter cards, map thumbnails) | 8 |
| Frontend | React (Sonnet) | Implement adventure detail page (browse chapters, encounters, preview maps) | 8 |
| Quality | Vigil (Sonnet) | Structure extraction accuracy tests (correct encounter count, NPC detection) | 8 |
| Quality | Vigil (Sonnet) | Adventure CRUD API tests | 5 |
| **Total** | | | **~76** |

---

### Sprint 16 - "AI Director Core"

**Sprint Goal:** AI Director supervised autopilot mode operational. Narrative engine produces read-aloud text and scene descriptions. NPC dialogue generation. Human approval workflow for all AI actions.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Arch (Opus) | Define AI Director state machine (adventure position, encounter state, narrative flow) | 8 |
| Backend | Forge (Sonnet) | AI Director engine: loads adventure structure, tracks current chapter/encounter | 13 |
| Backend | Forge (Sonnet) | Narrative generation: AI produces read-aloud text, scene descriptions, transitions | 8 |
| Backend | Forge (Sonnet) | NPC dialogue engine: AI voices NPCs in-character based on adventure data + personality | 8 |
| Backend | Forge (Sonnet) | Approval pipeline: AI proposes action -> preview sent to human -> approve/modify/reject | 8 |
| Backend | Schema (Opus) | ai_director_state table (session, chapter, encounter, context window, pending actions) | 5 |
| Frontend | Pixel (Sonnet) | Design AI Director panel (action queue, approve/reject/edit buttons, AI status) | 8 |
| Frontend | Pixel (Sonnet) | Design AI narration display (read-aloud box with style, NPC speech with portraits) | 5 |
| Frontend | React (Sonnet) | Implement AI Director approval panel (queue of pending AI actions, action on each) | 8 |
| Frontend | React (Sonnet) | Implement AI narration and NPC dialogue display in game room | 5 |
| Quality | Vigil (Sonnet) | AI Director state machine tests (correct progression, state persistence on disconnect) | 8 |
| Quality | Vigil (Sonnet) | Approval pipeline tests (approve -> executes, reject -> discarded, modify -> re-sent) | 5 |
| **Total** | | | **~89** |

---

### Sprint 17 - "AI Director Game Flow"

**Sprint Goal:** AI Director manages full encounters: NPC combat turns (ability selection, targeting), player action response, human can take over and hand back at any point.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Backend | Forge (Sonnet) | AI combat management: AI runs NPC turns, selects abilities from stat blocks, picks targets | 13 |
| Backend | Forge (Sonnet) | AI rules integration: Director AI respects loaded game system constraints for NPCs | 8 |
| Backend | Forge (Sonnet) | Player action response: AI Director reacts to player actions contextually and narratively | 8 |
| Backend | Forge (Sonnet) | Human override: seamless takeover from AI at any point, AI context preserved for resume | 8 |
| Backend | Forge (Sonnet) | AI context management: conversation history pruning, adventure state injection, character summaries | 8 |
| Frontend | Pixel (Sonnet) | Design human override controls (take over / hand back toggle, AI status indicator) | 5 |
| Frontend | React (Sonnet) | Implement override toggle with seamless handoff animation between human/AI Director | 8 |
| Frontend | React (Sonnet) | AI action preview during combat (shows intended NPC ability + target before executing) | 5 |
| Quality | Vigil (Sonnet) | Full encounter E2E: AI starts combat, runs NPC turns, players act, combat resolves | 13 |
| Quality | Vigil (Sonnet) | Override tests: human takes over mid-combat, plays NPC turn, hands back to AI | 5 |
| **Total** | | | **~81** |

---

### Sprint 18 - "Adventure Browser & Polish"

**Sprint Goal:** Adventure selection/browser UI for Directors, adventure upload pipeline polished, AI provider configuration per session, Director landing page.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Define adventure discovery UX (browse, search, metadata display) | 5 |
| Backend | Forge (Sonnet) | Adventure search API (by name, game system, tags, level range) | 5 |
| Backend | Forge (Sonnet) | AI provider configuration API (Director picks provider + model per session) | 5 |
| Backend | Forge (Sonnet) | Adventure processing queue (background job for PDF parsing, async status updates) | 8 |
| Frontend | Pixel (Sonnet) | Design adventure browser (card grid, filters, search, detail modal with chapters) | 8 |
| Frontend | Pixel (Sonnet) | Design AI configuration panel (provider dropdown, model, temperature, context size) | 5 |
| Frontend | Pixel (Sonnet) | Design Director landing page (choose existing adventure OR upload + configure new) | 5 |
| Frontend | React (Sonnet) | Implement adventure browser with search, filters, and adventure cards | 8 |
| Frontend | React (Sonnet) | Implement AI provider configuration panel (per-session settings) | 5 |
| Frontend | React (Sonnet) | Implement Director landing page: adventure selection + "upload new" flow | 8 |
| Frontend | React (Sonnet) | Adventure upload with async processing (progress bar, status polling, ready notification) | 5 |
| Quality | Vigil (Sonnet) | E2E: upload adventure -> processing -> appears in browser -> select -> start session | 8 |
| Quality | Vigil (Sonnet) | AI configuration tests (switch providers mid-session, model selection persists) | 5 |
| **Total** | | | **~80** |

---

### Sprint 19 - "Ship It (v3.0)"

**Sprint Goal:** Full security audit (AI-specific threats), load testing with AI Director sessions, production deploy v3.0. Final release.

| Track | Agent | Tasks | SP |
|-------|-------|-------|----|
| Coordination | Sage (Opus) | Full acceptance: upload adventure -> AI Director runs full session -> players complete encounter | 8 |
| Coordination | Sage (Opus) | Write v3.0 release notes | 2 |
| Coordination | Arch (Opus) | Final architecture review, document future roadmap (Phase 4+ ideas) | 5 |
| Backend | Forge (Sonnet) | Bug fixes from QA backlog | 8 |
| Backend | Forge (Sonnet) | AI response latency optimization, context window management, token budget | 5 |
| Frontend | Pixel (Sonnet) | Full UX polish pass (AI interactions, adventure browser, Director flow, loading states) | 5 |
| Frontend | React (Sonnet) | Bug fixes from QA backlog | 8 |
| Infra | Harbor (Sonnet) | Update production deployment for Phase 3, AI provider secrets management | 5 |
| Infra | Harbor (Sonnet) | ELK dashboards for AI usage monitoring (token counts, latency, cost, errors) | 5 |
| Infra | Sentinel (Sonnet) | AI security audit: prompt injection, data leakage, context poisoning, API key rotation | 8 |
| Infra | Sentinel (Sonnet) | Adventure file upload security (malicious PDFs, oversized files, path traversal) | 5 |
| Quality | Vigil (Sonnet) | Full regression suite (Phase 1 + Phase 2 + Phase 3) | 8 |
| Quality | Vigil (Sonnet) | Load test: AI Director with 5 concurrent sessions, measure token throughput | 5 |
| Quality | Vigil (Sonnet) | E2E: full game - Draw Steel rules + loaded adventure + AI Director + human players | 8 |
| **Total** | | | **~85** |

### Phase 3 Gate: v3.0 Release

**Release Criteria:**
- Adventure upload -> parse -> structure -> AI Director plays it end-to-end
- All three AI providers working (Claude, GPT, Ollama)
- Supervised autopilot: AI proposes, human approves, works seamlessly
- Human override: takeover and hand-back works mid-encounter
- Phase 1 + 2 + 3 full regression suite green
- AI security audit clean (prompt injection, data leakage)
- Production deployment with AI monitoring dashboards

---

## Definition of Done

A feature/story is considered DONE when:

1. Code is written and follows conventions (ESLint clean, TypeScript strict)
2. Unit tests written and passing (80%+ coverage for packages)
3. Integration/E2E tests written for critical paths
4. Code reviewed by at least 1 other agent (PR approved)
5. ADR written if architectural decision was made
6. API documentation updated (OpenAPI spec)
7. No known security vulnerabilities
8. Feature deployed to staging environment
9. Acceptance criteria verified by Sage (PM)
10. No regressions in existing functionality

---

## Velocity Tracking

| Sprint | Phase | Name | Planned SP | Completed SP | Velocity | Notes |
|--------|-------|------|-----------|--------------|----------|-------|
| 1      | 1     | Lay the Foundation | ~91 | ~91 | 91 | Completed |
| 2      | 1     | Lobby & Rooms | ~101 | ~101 | 101 | Completed |
| 3      | 1     | The Map Awakens | ~102 | ~102 | 102 | Completed |
| 4      | 1     | Roll for Initiative | ~96 | ~96 | 96 | Completed |
| 5      | 1     | Director & Player Tools | ~91 | ~91 | 91 | Completed |
| 6      | 1     | Time Capsule | ~91 | ~91 | 91 | Completed |
| 7      | 1     | Ship It (v1.0) | ~101 | ~101 | 101 | **v1.0 Release** |
| 8      | 2     | The Rules Engine | ~81 | - | - | - |
| 9      | 2     | The Character Sheet | ~83 | - | - | - |
| 10     | 2     | Abilities Unleashed | ~88 | - | - | - |
| 11     | 2     | Rules Enforcement | ~81 | - | - | - |
| 12     | 2     | Ship It (v2.0) | ~77 | - | - | **v2.0 Release** |
| 13     | 3     | The AI Awakens | ~81 | - | - | - |
| 14     | 3     | Adventure Format & Parser | ~75 | - | - | - |
| 15     | 3     | Adventure Structure | ~76 | - | - | - |
| 16     | 3     | AI Director Core | ~89 | - | - | - |
| 17     | 3     | AI Director Game Flow | ~81 | - | - | - |
| 18     | 3     | Adventure Browser & Polish | ~80 | - | - | - |
| 19     | 3     | Ship It (v3.0) | ~85 | - | - | **v3.0 Release** |
| **Total** | | | **~1,649** | - | - | **19 sprints / 38 weeks** |
