# DSVTT (VTT Forge) — v1.0 Release Notes

**Release Date:** 2026-02-11
**Phase:** 1 — Generic VTT Engine
**Sprint:** 7 — "Ship It v1.0"

---

## Release Summary

DSVTT v1.0 is the first public release of VTT Forge, a fully functional virtual tabletop platform for playing any tabletop role-playing game online. This release delivers a complete, system-agnostic VTT engine — including real-time maps with tokens and fog of war, a dice rolling engine with full formula support, text chat with in-character and out-of-character channels, turn management, Director tools for running games, character sheets, shared notes, and full session recording with replay. v1.0 is designed as a platform: it enforces no game-specific rules, leaving all adjudication to the Director, and provides the foundational infrastructure on which game system support (v2.0) and AI-assisted play (v3.0) will be built.

---

## Features

### Authentication & Authorization
- Email/password registration and login
- JWT-based session management with token refresh
- Role-based access control (RBAC) with Director and Player roles
- Passport.js local strategy integration
- Secure password hashing with bcrypt

### Lobby & Rooms
- Real-time room list with live status updates via Socket.IO
- Room creation with configurable name and max player count (default 8)
- Join/leave room flow with role assignment
- Room status lifecycle: Waiting, Active, Paused, Ended
- Director ownership model — one Director per room

### 2D Grid Maps
- react-konva HTML5 canvas with configurable grid overlay
- Token placement, selection, and drag-and-drop with snap-to-grid
- Token layers (Background, Token, Effect, GM-only)
- Pan (drag) and zoom (mousewheel) navigation
- Multi-client real-time sync — token moves broadcast to all players
- Map toolbar for token management

### Fog of War
- Director-controlled visibility regions
- Polygon-based fog regions stored per map
- Reveal/hide toggle per region
- Players see only revealed areas; Director sees all
- Real-time fog updates broadcast to connected clients

### Map Background Upload
- Image upload for battle map backgrounds
- Background rendered as bottom layer beneath grid and tokens
- Configurable grid dimensions (width, height, cell size)

### Dice Rolling Engine
- Full formula parser supporting standard notation: `2d6+3`, `1d20`, `4d8kh3`
- Keep highest/lowest modifiers (`kh`, `kl`)
- Exploding dice support
- Arithmetic operators and complex expressions
- Private (Director-only) rolls
- Roll history with individual die results and totals
- Deterministic seeded mode for testing
- Statistical fairness validated

### Text Chat
- In-Character (IC) and Out-of-Character (OOC) channels
- Whisper messages (private player-to-player or Director-to-player)
- System message channel for automated notifications
- Message persistence with full-text search (PostgreSQL tsvector)
- Real-time broadcast via Socket.IO
- Timestamps and sender identification

### Turn Management
- Initiative order tracking with customizable values
- Round counter with automatic advancement
- Current turn highlight in the turn tracker bar
- Skip and delay actions for flexible turn order
- Director controls for starting, pausing, and resetting initiative
- Real-time sync of turn state across all clients

### Director Control Panel
- NPC creation and management (name, stats JSON, notes)
- NPC token assignment — place NPC tokens on the map
- World event triggers and narrative tools
- Secret notes visible only to the Director
- Director-only sidebar tab with full game management controls

### Character Sheets
- Free-form character creation (name, stats JSON, notes, inventory JSON)
- Per-player character ownership
- Real-time sync of character data across clients
- Full-text search across character names, notes, and stats
- CRUD operations via REST API and Socket.IO events

### Shared Notes
- Collaborative documents scoped per game session
- Create, edit, and delete notes
- Real-time updates broadcast to all session participants
- Full-text search across note titles and content
- `updatedBy` tracking for edit attribution

### Event Sourcing
- Centralized `EventStore` service logging all game actions
- Monotonically increasing sequence numbers per session
- Comprehensive event type coverage: lifecycle, chat, dice, tokens, maps, fog, turns, NPCs, characters, notes, player connectivity
- Fire-and-forget logging — does not block real-time gameplay
- Pure event reducers for state reconstruction
- Periodic state snapshots (every 100 events) for efficient replay

### Session Replay
- Read-only playback viewer at dedicated replay route
- Paginated event retrieval via REST API
- State reconstruction at any sequence number
- Timeline scrubber with playback controls (play, pause, step, speed)
- Simplified map view and event log sidebar
- Manual snapshot creation (Director only)

### Full-Text Search
- PostgreSQL-native full-text search using `tsvector` columns and GIN indexes
- Search across chat messages, shared notes, and character data
- Filterable by content type (`chat`, `note`, `character`)
- Search bar integrated into game room UI with results panel
- Auto-populated search vectors via database triggers

---

## Technical Highlights

### Architecture
- **Monorepo** managed by Turborepo + pnpm workspaces
- Clean package boundaries: `@dsvtt/shared`, `@dsvtt/events`, `@dsvtt/game-engine`, `@dsvtt/dice-engine`, `@dsvtt/auth`, `@dsvtt/ui`
- TypeScript strict mode across all packages
- Zod runtime validation on all API inputs and Socket.IO event payloads
- Conventional Commits enforced via commitlint + Husky

### Frontend
- **Next.js 14** with App Router and React Server Components
- **react-konva** for performant HTML5 canvas map rendering
- **Zustand** stores for client state management (auth, room, map, chat, dice, turns, characters, notes, replay, search)
- **shadcn/ui** + Tailwind CSS for the component library
- Resizable panel layout for the game room view
- Lazy-loaded components for optimized bundle size
- Error boundaries and toast notifications for error handling
- Connection status indicator for Socket.IO connectivity

### Backend
- **Express** REST API with modular router architecture
- **Socket.IO** for real-time bidirectional communication
- JWT authentication middleware for both REST and WebSocket
- RBAC middleware enforcing Director/Player permissions
- Structured JSON logging for ELK ingestion
- Modular socket event handlers: room, game, map, chat, dice, turn, character, NPC, notes

### Database
- **PostgreSQL 16** with **Prisma ORM** (v6.19)
- Full schema covering: users, rooms, room_players, game_sessions, game_event_logs, game_maps, tokens, fog_regions, chat_messages, dice_roll_logs, npcs, characters, shared_notes, state_snapshots
- Comprehensive indexing strategy for query performance
- Full-text search preview feature enabled
- Seed script with test accounts (Director + Player)

### Infrastructure
- **Docker** containerization with multi-stage builds (`Dockerfile.web`, `Dockerfile.server`)
- Docker Compose configurations for dev, production, and ELK stack
- **Jenkins** CI/CD pipeline (build, lint, test, deploy, rollback)
- **Nginx** reverse proxy with SSL termination and WebSocket upgrade support
- **ELK Stack** (Elasticsearch, Logstash, Kibana) for operational log analysis and monitoring
- Index lifecycle management for log retention

### Security
- OWASP Top 10 coverage via security audit
- CSRF protection middleware
- Rate limiting on auth (10 req/min), API (60 req/min), and WebSocket (120 req/min) endpoints
- Security headers and Content Security Policy
- WebSocket origin validation
- Input validation on all endpoints via Zod schemas
- Request timeout middleware
- Dependency vulnerability scanning
- Docker image hardening

### Testing
- **Vitest** for unit and integration tests
- **Playwright** for end-to-end testing
- **k6** for load testing (API and WebSocket stress tests)
- E2E coverage: auth, lobby, room join, map interaction, dice/chat, director tools, game session, session replay
- Unit test coverage for dice parser (notation variants, edge cases, fairness), event reducers, API routes
- Load tested at 50 concurrent users

---

## Known Limitations

- **No game-specific rules enforcement** — the VTT does not validate actions against any RPG system's rules. All adjudication is manual by the Director. Game system support is planned for v2.0.
- **No AI integration** — there is no AI-assisted narration, NPC dialogue, or automated Director. AI Director features are planned for v3.0.
- **In-memory rate limiting** — the rate limiter uses a per-process token bucket stored in memory. This is not suitable for multi-process or clustered deployments. Migration to Redis-backed rate limiting is recommended for horizontal scaling.
- **No mobile-optimized layout** — the game room UI is designed for desktop browsers with resizable panels. Mobile/tablet layouts are not yet implemented.
- **Socket.IO rooms not persisted** — room memberships are held in memory by the Socket.IO server. A server restart causes all connected clients to lose their room associations (they must rejoin). Socket.IO Redis adapter is recommended for production resilience.
- **No OpenAPI specifications** — while the `apps/server/openapi/` directory is defined in the project structure, auto-generated OpenAPI specs from Zod schemas have not yet been created.
- **Replay viewer uses simplified rendering** — the session replay map view uses CSS-based rendering rather than the full react-konva canvas, which is sufficient for review but not pixel-identical to live gameplay.
- **No database backup strategy** — automated backup and point-in-time recovery procedures are not yet documented or configured.
- **No structured error code documentation** — while the backend uses structured `AppError` codes internally, a public error code reference for API consumers has not been published.

---

## Upgrade Notes / Breaking Changes

N/A — this is the first release of DSVTT. There are no prior versions to upgrade from.

---

## What's Next

- **v2.0 (Phase 2: Game System Loader)** — Load TTRPG rules from Markdown files, constraint engine for rules enforcement, PDF-based character sheet rendering with ability browser, game system selection on room creation.
- **v3.0 (Phase 3: Adventure Loader + AI Director)** — Adventure folder ingestion (PDF + maps), multi-provider AI integration (Claude, GPT, Ollama), supervised autopilot AI Director with human override.

---

## Contributors

| Agent | Role | Track |
|-------|------|-------|
| Sage | Product Manager | Coordination |
| Arch | Tech Lead / Architect | Coordination |
| Pixel | UI/UX Designer | Frontend |
| React | Frontend Developer | Frontend |
| Forge | Backend Developer | Backend |
| Schema | Database Architect | Backend |
| Harbor | DevOps Engineer | Infrastructure |
| Sentinel | Security Engineer | Infrastructure |
| Vigil | QA / Test Engineer | Quality |
