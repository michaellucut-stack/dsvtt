-- CreateTable: state_snapshots
CREATE TABLE "state_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "state_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "state_snapshots_session_id_sequence_number_key" ON "state_snapshots"("session_id", "sequence_number");
CREATE INDEX "state_snapshots_session_id_idx" ON "state_snapshots"("session_id");
CREATE INDEX "state_snapshots_created_at_idx" ON "state_snapshots"("created_at");

ALTER TABLE "state_snapshots"
    ADD CONSTRAINT "state_snapshots_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: search_vector on shared_notes
ALTER TABLE "shared_notes" ADD COLUMN "search_vector" tsvector;

-- AddColumn: search_vector on characters
ALTER TABLE "characters" ADD COLUMN "search_vector" tsvector;

-- ─── Full-Text Search: chat_messages ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chat_messages_search
    ON chat_messages USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_chat_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_search_vector ON chat_messages;
CREATE TRIGGER trg_chat_search_vector
    BEFORE INSERT OR UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_search_vector();

-- Backfill existing rows
UPDATE chat_messages SET search_vector = to_tsvector('english', COALESCE(content, ''))
    WHERE search_vector IS NULL;

-- ─── Full-Text Search: shared_notes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shared_notes_search
    ON shared_notes USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_notes_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notes_search_vector ON shared_notes;
CREATE TRIGGER trg_notes_search_vector
    BEFORE INSERT OR UPDATE ON shared_notes
    FOR EACH ROW EXECUTE FUNCTION update_notes_search_vector();

-- Backfill existing rows
UPDATE shared_notes SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, ''))
    WHERE search_vector IS NULL;

-- ─── Full-Text Search: characters ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_characters_search
    ON characters USING gin(search_vector);

CREATE OR REPLACE FUNCTION update_characters_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.notes, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_characters_search_vector ON characters;
CREATE TRIGGER trg_characters_search_vector
    BEFORE INSERT OR UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_characters_search_vector();

-- Backfill existing rows
UPDATE characters SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(notes, ''))
    WHERE search_vector IS NULL;

-- ─── Event Log Optimization ─────────────────────────────────────────────────

-- Composite index for efficient replay queries (events after a snapshot)
CREATE INDEX IF NOT EXISTS idx_game_event_logs_session_seq
    ON game_event_logs (session_id, sequence_number ASC);

-- Index for event type filtering during replay
CREATE INDEX IF NOT EXISTS idx_game_event_logs_session_type
    ON game_event_logs (session_id, event_type);
