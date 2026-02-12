# ADR-005: Event Sourcing Implementation

**Status:** Accepted
**Date:** 2026-02-11
**Sprint:** 6 — "Time Capsule"

## Context

Prior to Sprint 6, only the `GAME_ACTION` socket handler logged events to the `GameEventLog` table. Chat messages, dice rolls, token movements, fog updates, turn changes, NPC actions, character updates, and note edits were persisted to their respective domain tables but **not** recorded in the unified event log. This meant session replay was impossible and there was no single audit trail of all game activity.

## Decision

Adopt **full event sourcing** where every state-changing and notable game operation is logged through a centralized `EventStore` service.

### Core Architecture

1. **Centralized Event Store** (`apps/server/src/services/event-store.ts`):
   - Single `logEvent()` function through which ALL game events are logged.
   - Uses atomic `$transaction` to assign monotonically increasing sequence numbers per session.
   - Fire-and-forget from socket handlers — logging failures do not block real-time gameplay.

2. **Event Type Constants** (`packages/shared/src/constants/event-types.ts`):
   - Exhaustive `GameEventType` const object covering all loggable actions.
   - Types: lifecycle (start/pause/resume/end), chat, dice, tokens, maps, fog, turns, NPCs, characters, notes, player connectivity.

3. **Pure Event Reducers** (`packages/game-engine/src/events/reducers.ts`):
   - One reducer per state-changing event type.
   - Registered in a global `eventReducers` Map at server startup.
   - Non-state events (chat, dice, notes) have no reducer — they appear in the timeline but do not modify `GameState`.

4. **Snapshot System** (`apps/server/src/services/snapshot.service.ts`):
   - Periodic snapshots every 100 events.
   - Snapshots store serialized `GameState` (Maps converted to objects for JSON storage).
   - State reconstruction: find closest snapshot, then replay events from snapshot to target sequence.

5. **Replay API** (REST, not WebSocket):
   - `GET /api/sessions/:id/replay/events` — paginated event retrieval.
   - `GET /api/sessions/:id/replay/state?sequenceNumber=N` — state reconstruction at any point.
   - `GET /api/sessions/:id/replay/snapshots` — list snapshots.
   - `POST /api/sessions/:id/replay/snapshots` — manual snapshot creation (director only).

6. **Full-Text Search** (PostgreSQL native, not Elasticsearch):
   - `tsvector` columns with GIN indexes on `chat_messages`, `shared_notes`, `characters`.
   - Auto-populated via database triggers on INSERT/UPDATE.
   - Search API at `GET /api/sessions/:id/search?q=...&types=chat,note,character`.
   - Elasticsearch/ELK remains for operational log analysis only.

### Event Replay Protocol

The frontend replay viewer:
1. Loads events via paginated REST (`/replay/events?fromSequence=0&limit=1000`).
2. Steps through events using playback controls (play/pause/step/speed).
3. For each step, fetches reconstructed state from `/replay/state?sequenceNumber=N`.
4. Renders a read-only map view and event timeline sidebar.
5. The replay page is a separate route (`/[roomId]/replay?sessionId=...`), fully decoupled from the live game.

## Consequences

### Positive
- Complete session recording enables replay, debugging, and dispute resolution.
- Snapshots bound replay cost to at most 99 events of replay work.
- PostgreSQL-native FTS avoids external dependency for game content search.
- Non-blocking logging preserves real-time game performance.

### Negative
- Event log grows with gameplay — storage monitoring needed for long campaigns.
- Snapshot interval of 100 is a tuning parameter that may need adjustment.
- Some events could theoretically be lost under extreme DB pressure (fire-and-forget).
- Reducers must be maintained in sync with any new game action types.

### Neutral
- Domain tables (ChatMessage, DiceRollLog, etc.) remain the primary read path for live gameplay. The event log is secondary/audit.
- Replay viewer uses simplified CSS rendering, not the full Konva canvas — sufficient for review purposes.
