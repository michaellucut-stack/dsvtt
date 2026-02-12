# DSVTT — Phase 1 Architecture Review

**Author:** Arch (Tech Lead)
**Date:** 2026-02-11
**Sprint:** 7 — "Ship It v1.0"
**Purpose:** Post-Phase 1 architecture review identifying what went well, technical debt accumulated, and recommendations for Phase 2.

---

## What Went Well

### Clean Monorepo Structure with Well-Defined Package Boundaries

The Turborepo + pnpm workspace setup has proven effective. Each package has a clear responsibility and explicit dependency graph:

- `@dsvtt/shared` — zero external dependencies, types and constants only
- `@dsvtt/events` — depends on `shared` only; defines the full Socket.IO protocol contract
- `@dsvtt/dice-engine` — zero dependencies, pure logic; highly testable and reusable
- `@dsvtt/game-engine` — depends on `shared` and `events`; contains state management, event reducers, and turn logic
- `@dsvtt/auth` — depends on `shared`, Passport, JWT, bcrypt; encapsulates all auth concerns
- `apps/web` and `apps/server` consume packages through clean `@dsvtt/*` imports

This structure made parallel development across tracks feasible — frontend and backend teams could work against the same type definitions in `@dsvtt/shared` and `@dsvtt/events` without stepping on each other.

### Event Sourcing Provides Full Session History

The decision to adopt full event sourcing (ADR-005) has been one of the strongest architectural choices. Every state-changing game action is logged with monotonically increasing sequence numbers per session. This enables:

- Complete session replay from any point
- Debugging of game state issues by examining the event log
- Future audit/dispute resolution capabilities
- A foundation for analytics on player behavior and game patterns

The snapshot system (every 100 events) keeps replay reconstruction performant, and the fire-and-forget logging pattern ensures event recording does not impact real-time gameplay latency.

### Socket.IO Protocol Well-Defined in `packages/events`

Having a single source of truth for all client-server and server-client event types — with Zod schemas for payload validation — eliminated a class of integration bugs. Both `apps/web` (Socket.IO client) and `apps/server` (Socket.IO server) import from `@dsvtt/events`, ensuring type safety across the wire. The protocol covers all Phase 1 domains: rooms, game lifecycle, tokens, dice, chat, turns, fog, NPCs, characters, and notes.

### Prisma Schema Covers All Phase 1 Needs

The database schema (`prisma/schema.prisma`) is comprehensive and well-indexed. All 14 models required for Phase 1 are in place: `User`, `Room`, `RoomPlayer`, `GameSession`, `GameEventLog`, `GameMap`, `Token`, `FogRegion`, `ChatMessage`, `DiceRollLog`, `Npc`, `Character`, `SharedNote`, `StateSnapshot`. Full-text search support via `tsvector` columns with GIN indexes on `ChatMessage`, `Character`, and `SharedNote` was a pragmatic choice that avoids an external search dependency for game content.

### Solid Middleware Stack

The backend middleware is well-layered: auth (JWT verification), RBAC (Director/Player enforcement), rate limiting (token bucket with presets for auth/API/WS), Zod validation, CSRF protection, security headers, and request timeouts. Each concern is isolated in its own file under `apps/server/src/middleware/`.

### Comprehensive E2E and Test Infrastructure

Playwright E2E tests cover all major Phase 1 flows: auth, lobby, room join, map interaction, dice/chat, director tools, game sessions, and session replay. The dice engine has thorough unit tests including statistical fairness validation. k6 load tests are in place for both API and WebSocket endpoints. The testing pyramid (unit → integration → E2E → load) is well-established.

### Infrastructure Maturity

Docker multi-stage builds, Jenkins CI/CD, Nginx reverse proxy with SSL, and the ELK stack for operational logging are all in place from Sprint 1-2. This early investment in infrastructure meant every subsequent sprint could deploy and monitor without friction.

---

## Technical Debt Identified

### TD-01: In-Memory Rate Limiter (High Priority)

**File:** `apps/server/src/middleware/rate-limit.ts`
**Issue:** The rate limiter uses an in-process `Map<string, TokenBucket>` for tracking request rates. The code itself documents this limitation: *"Not suitable for multi-process / clustered deployments."* In a multi-instance deployment behind a load balancer, each instance maintains its own independent rate limit state, effectively multiplying the allowed request rate by the number of instances.
**Impact:** Cannot safely scale horizontally without introducing a shared rate limit store.
**Recommendation:** Migrate to Redis-backed rate limiting using `ioredis` or adopt a library like `rate-limiter-flexible` with a Redis store.

### TD-02: No Database Connection Pooler (High Priority)

**Issue:** There is no PgBouncer or equivalent connection pooler between the application and PostgreSQL. Prisma manages its own connection pool, but under high concurrency (50+ users with active WebSocket connections generating DB writes), connection exhaustion becomes a risk — particularly as each Socket.IO event handler may execute database operations concurrently.
**Impact:** Database connection limits could be hit under production load, causing request failures.
**Recommendation:** Add PgBouncer in transaction pooling mode to the Docker Compose production configuration. Configure Prisma's connection pool size to stay within PgBouncer limits.

### TD-03: Socket.IO Rooms Not Persisted (Medium Priority)

**Issue:** Socket.IO room memberships exist only in the server's memory. A server restart (planned deployment or crash) causes all clients to lose their room associations. While clients will reconnect via Socket.IO's automatic reconnection, they do not automatically rejoin their game rooms.
**Impact:** Server restarts during active game sessions require all players to manually rejoin rooms.
**Recommendation:** Adopt the `@socket.io/redis-adapter` to persist room memberships in Redis. This also enables horizontal scaling with multiple Socket.IO server instances.

### TD-04: No OpenAPI Specifications Generated (Medium Priority)

**File:** `apps/server/openapi/` (directory exists in project structure spec but is empty in practice)
**Issue:** The project structure document specifies an `openapi/` directory for OpenAPI 3.1 specs, and the Definition of Done requires "API documentation updated (OpenAPI spec)" for every feature. In practice, no OpenAPI specs were generated during Phase 1. Zod schemas exist for all API inputs, but they are not translated to OpenAPI format.
**Impact:** No machine-readable API documentation for external consumers or automated SDK generation. Manual API testing relies on knowledge of the codebase rather than a published contract.
**Recommendation:** Use `zod-to-openapi` to generate OpenAPI 3.1 specs from existing Zod schemas. Integrate spec generation into the build pipeline.

### TD-05: Limited Test Coverage in Some Areas (Medium Priority)

**Issue:** While the dice engine, event reducers, and API routes have good test coverage, several areas are undertested:
- Map rendering components (react-konva canvas, token layer, fog layer) have no component tests or Storybook stories
- The replay viewer components have no dedicated tests
- Socket.IO event handler integration tests cover only rooms and dice/chat (`__tests__/room-events.test.ts`, `__tests__/dice-chat-events.test.ts`); map, turn, NPC, character, and notes event handlers lack integration tests
**Impact:** Regressions in map rendering or replay playback may not be caught until E2E tests run, which are slower and less precise in diagnosing failures.
**Recommendation:** Add component-level tests for map and replay components. Backfill integration tests for remaining Socket.IO event handlers.

### TD-06: No Database Backup Strategy Documented (Medium Priority)

**Issue:** There is no documented procedure for PostgreSQL backups, point-in-time recovery, or disaster recovery. The production Docker Compose starts a PostgreSQL container, but persistent volume management and backup automation are not configured.
**Impact:** A database failure or accidental data loss in production has no recovery path.
**Recommendation:** Document and automate: daily `pg_dump` backups to object storage, WAL archiving for point-in-time recovery, and a tested restore procedure. Add backup verification to the deployment runbook.

### TD-07: Frontend State Management Lacks Optimistic Updates (Low Priority)

**Issue:** Zustand stores currently follow a request-then-update pattern: the client sends an action via Socket.IO, waits for the server acknowledgment, and only then updates local state. This introduces perceptible latency on token moves, chat messages, and dice rolls — especially on higher-latency connections.
**Impact:** Slight UI lag between user action and visual feedback, particularly noticeable for token drag-and-drop on the map.
**Recommendation:** Implement optimistic updates in Zustand stores: apply the change locally on user action, then reconcile with the server response (rollback on error). The event sourcing model makes rollback straightforward since the authoritative state is server-side.

### TD-08: No Structured Error Codes Documentation (Low Priority)

**Issue:** The backend uses `AppError` with structured codes (e.g., `ROOM_NOT_FOUND`, `OUT_OF_TURN_ACTION`, `RATE_LIMIT_EXCEEDED`), but there is no published reference document listing all error codes, their HTTP status mappings, and when they occur. Frontend error handling is ad-hoc — each component handles errors based on response shape rather than against a known catalog.
**Impact:** Frontend developers must read backend source to understand possible error responses. Third-party API consumers (if any in future) have no error reference.
**Recommendation:** Create a `docs/api/error-codes.md` catalog auto-generated from the codebase. Consider defining error codes in `@dsvtt/shared` so both frontend and backend can reference them.

### TD-09: Missing ADRs 001-004 (Low Priority)

**Issue:** The sprint plan (workflow-and-sprints.md) scheduled four ADRs in Sprints 1-3:
- ADR-001: Monorepo with Turborepo (Sprint 1)
- ADR-002: Event Sourcing (Sprint 1)
- ADR-003: Socket.IO Protocol (Sprint 2)
- ADR-004: Map Rendering Architecture (Sprint 3)

Only ADR-005 (Event Sourcing Implementation, Sprint 6) exists in `docs/adr/`. The project structure document references these ADRs under `docs/architecture/adr/` (a different path than the actual `docs/adr/`), and none of ADR-001 through ADR-004 were written.
**Impact:** Architectural decisions made in early sprints are not formally recorded. New team members or future agents must infer rationale from the code and conventions.
**Recommendation:** Backfill ADRs 001-004 retroactively. Consolidate the ADR directory to a single canonical location (`docs/adr/`).

### TD-10: `packages/ui` Is Essentially Empty (Low Priority)

**File:** `packages/ui/src/index.ts` — exports only `cn` utility
**Issue:** The project structure defines `packages/ui` as the shared UI component library (shadcn/ui primitives, theme, reusable components). In practice, it contains only a `cn()` class-name utility. All actual shared UI components (Button, Card, Input, Modal, Badge, Toast, Skeleton, Loading, EmptyState, ErrorBoundary, ConnectionStatus) live in `apps/web/src/components/ui/`.
**Impact:** If a second frontend app were added (e.g., a mobile web client or admin dashboard), UI components would need to be duplicated or extracted. The `packages/ui` package does not fulfill its intended role.
**Recommendation:** Migrate shared primitives from `apps/web/src/components/ui/` into `packages/ui/src/components/`. Keep app-specific compositions in `apps/web`. This becomes more urgent if Phase 2 or 3 introduces additional frontend surfaces.

### TD-11: ADR Directory Path Inconsistency (Low Priority)

**Issue:** The project structure document specifies ADRs at `docs/architecture/adr/`, but the actual ADR-005 is at `docs/adr/`. The broader `docs/architecture/`, `docs/database/`, `docs/security/`, `docs/testing/`, and `docs/infrastructure/` subdirectories specified in the project structure do not exist.
**Impact:** Documentation is not organized as designed. Contributors may create files in inconsistent locations.
**Recommendation:** Either create the full `docs/` subdirectory structure as specified or update the project structure document to reflect the actual flat layout. Prefer the former to maintain organizational intent.

---

## Recommendations for Phase 2

### R-01: Add Redis for Rate Limiting, Session Store, and Socket.IO Adapter

Redis should be introduced as a shared infrastructure component serving three purposes:
1. **Rate limiting** — Replace the in-memory token bucket with a Redis-backed rate limiter (addresses TD-01)
2. **Socket.IO adapter** — Use `@socket.io/redis-adapter` to persist room memberships and enable multi-instance Socket.IO (addresses TD-03)
3. **Session/cache store** — Cache frequently accessed game state (active room lists, turn order) to reduce database load

Add a Redis service to `docker-compose.dev.yml` and `docker-compose.prod.yml`. Use `ioredis` as the client library for its Cluster and Sentinel support.

### R-02: Create PgBouncer Configuration for Connection Management

Add PgBouncer to the production Docker Compose stack in transaction pooling mode. Configure:
- `default_pool_size` based on expected concurrent connections
- `max_client_conn` to handle Socket.IO connection bursts
- Prisma `connection_limit` to stay within PgBouncer's pool

This is important for Phase 2 because the constraint engine will add additional database reads on every validated game action.

### R-03: Generate OpenAPI Specs from Zod Schemas

Use `zod-to-openapi` (or `@asteasolutions/zod-to-openapi`) to derive OpenAPI 3.1 specifications from the existing Zod schemas in each API module's `*.schemas.ts` files. Steps:
1. Add OpenAPI metadata (descriptions, examples) to existing Zod schemas
2. Create a spec generation script that collects all route schemas
3. Output to `apps/server/openapi/v1.yaml`
4. Serve the spec via Swagger UI at `/api/docs` in development
5. Add spec generation to the CI pipeline to catch drift

### R-04: Backfill Missing ADRs

Write ADRs 001-004 retroactively to document the decisions made in Sprints 1-3:
- **ADR-001:** Monorepo with Turborepo — why monorepo over polyrepo, why Turborepo over Nx
- **ADR-002:** Event Sourcing as core pattern — why event sourcing over CRUD-only, tradeoffs accepted
- **ADR-003:** Socket.IO Protocol design — why Socket.IO over raw WebSocket/tRPC subscriptions, event naming conventions
- **ADR-004:** Map Rendering with react-konva — why Canvas over SVG/DOM, performance characteristics, layer architecture

Consolidate all ADRs into `docs/adr/` as the canonical location.

### R-05: Add Storybook for Component Library

Set up Storybook in `packages/ui` (or `apps/web` initially) to:
- Document and visually test all shared UI primitives (Button, Card, Input, Modal, etc.)
- Provide a development environment for map components (grid, tokens, fog) in isolation
- Enable visual regression testing with Chromatic or Percy
- Serve as a living style guide for the TTRPG theme

This becomes especially valuable in Phase 2 when the character sheet renderer introduces many new component variations.

### R-06: Consider a Message Queue for Event Processing at Scale

Currently, event sourcing writes directly to PostgreSQL from socket handlers in a fire-and-forget pattern. This works at the Phase 1 scale (50 concurrent users), but Phase 2's constraint engine will increase the per-event processing cost. Consider:
- Introducing a lightweight message queue (BullMQ with Redis, or a simple PostgreSQL-based job queue)
- Decoupling event logging from the hot path: socket handler publishes to queue, a worker persists to the event log
- This also enables future event processing pipelines (analytics, real-time alerts, AI context feeding in Phase 3)

This is not urgent for Phase 2 but should be evaluated if load testing reveals event logging as a latency bottleneck.

### R-07: Plan Database Migration Strategy for Game Systems Tables

Phase 2 introduces several new tables: `game_systems`, `rule_constraints`, `game_system_configs`, `character_templates`, `character_data`, and `abilities`. Plan:
- Prisma migration naming convention for Phase 2 tables
- Seed data strategy for the initial game system (Draw Steel or test system)
- Data migration path: existing Phase 1 `Character` records (free-form JSON stats) will need to coexist with Phase 2 template-based characters
- Consider adding a `gameSystemId` nullable foreign key to `Room` and `GameSession` now (via migration) to avoid a breaking schema change later

### R-08: Populate the Docs Directory Structure

Create the documentation subdirectories specified in the project structure but not yet realized:
- `docs/architecture/` — C4 diagrams, architecture overview
- `docs/database/` — ERD, data dictionary
- `docs/security/` — threat model, incident response
- `docs/testing/` — test strategy
- `docs/infrastructure/` — deployment runbook, ELK setup

Even if these start as stubs, having the structure in place sets expectations for Phase 2 documentation.

### R-09: Document and Automate Database Backups

Before Phase 2 adds game system data that Directors invest significant time configuring, establish:
- Automated daily `pg_dump` with rotation
- WAL archiving configuration for point-in-time recovery
- A tested restore procedure documented in the deployment runbook
- Backup monitoring alerts in the ELK stack

---

## Risk Assessment for Phase 2

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Constraint engine adds latency to game actions | Medium | High | Performance budget of <50ms per validation; benchmark early in Sprint 8 |
| Prisma migration conflicts between Phase 1 and Phase 2 schemas | Low | Medium | Plan migrations carefully; test against existing data |
| Rule parser cannot handle diverse Markdown formats | Medium | Medium | Define strict MD format spec; validate early with real game system files |
| Character sheet renderer complexity exceeds estimates | Medium | Medium | Start with minimal viable sheet; iterate in Sprint 9-10 |
| Existing Phase 1 free-form characters incompatible with Phase 2 templates | Low | Low | Support both free-form (system-agnostic) and template-based characters |

---

## Summary

Phase 1 delivered a solid, functional VTT platform with strong architectural foundations. The monorepo structure, event sourcing model, typed Socket.IO protocol, and comprehensive database schema provide a reliable base for Phase 2. The primary technical debts to address are infrastructure-related (Redis for rate limiting and Socket.IO persistence, PgBouncer for connection management, database backups) and documentation gaps (missing ADRs, OpenAPI specs, error code catalog). None of these debts are blocking for Phase 2 development, but addressing TD-01 (rate limiter) and TD-03 (Socket.IO persistence) should be prioritized in Sprint 8 to prepare for production scaling.
