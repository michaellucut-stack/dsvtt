-- Phase 2: Game System Models Migration
-- Adds GameSystem, RuleConstraint, CharacterTemplate, CharacterData, Ability,
-- GameSystemConfig tables and the gameSystemId column on rooms.

-- ─── CreateTable: game_systems ───────────────────────────────────────────────

CREATE TABLE "game_systems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "rulesPath" TEXT NOT NULL,
    "parsedData" JSONB NOT NULL DEFAULT '{}',
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_systems_name_key" ON "game_systems"("name");
CREATE INDEX "game_systems_name_idx" ON "game_systems"("name");
CREATE INDEX "game_systems_isReady_idx" ON "game_systems"("isReady");

-- ─── CreateTable: rule_constraints ───────────────────────────────────────────

CREATE TABLE "rule_constraints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gameSystemId" UUID NOT NULL,
    "constraintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "config" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,

    CONSTRAINT "rule_constraints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rule_constraints_gameSystemId_constraintId_key" ON "rule_constraints"("gameSystemId", "constraintId");
CREATE INDEX "rule_constraints_gameSystemId_idx" ON "rule_constraints"("gameSystemId");
CREATE INDEX "rule_constraints_scope_idx" ON "rule_constraints"("scope");

ALTER TABLE "rule_constraints"
    ADD CONSTRAINT "rule_constraints_gameSystemId_fkey"
    FOREIGN KEY ("gameSystemId") REFERENCES "game_systems"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: character_templates ────────────────────────────────────────

CREATE TABLE "character_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gameSystemId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "sectionOrder" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_templates_gameSystemId_version_key" ON "character_templates"("gameSystemId", "version");
CREATE INDEX "character_templates_gameSystemId_idx" ON "character_templates"("gameSystemId");

ALTER TABLE "character_templates"
    ADD CONSTRAINT "character_templates_gameSystemId_fkey"
    FOREIGN KEY ("gameSystemId") REFERENCES "game_systems"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: character_data ─────────────────────────────────────────────

CREATE TABLE "character_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_data_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "character_data_templateId_idx" ON "character_data"("templateId");
CREATE INDEX "character_data_sessionId_idx" ON "character_data"("sessionId");
CREATE INDEX "character_data_userId_idx" ON "character_data"("userId");

ALTER TABLE "character_data"
    ADD CONSTRAINT "character_data_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "character_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "character_data"
    ADD CONSTRAINT "character_data_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "game_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "character_data"
    ADD CONSTRAINT "character_data_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: abilities ──────────────────────────────────────────────────

CREATE TABLE "abilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gameSystemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "distance" TEXT,
    "targets" TEXT,
    "powerRollCharacteristic" TEXT,
    "powerRollTiers" JSONB,
    "effect" TEXT,
    "trigger" TEXT,
    "special" TEXT,
    "cost" TEXT,
    "sourceClass" TEXT,
    "sourceAncestry" TEXT,
    "sourceKit" TEXT,
    "levelRequired" INTEGER NOT NULL DEFAULT 1,
    "isSignature" BOOLEAN NOT NULL DEFAULT false,
    "rawText" TEXT,

    CONSTRAINT "abilities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "abilities_gameSystemId_idx" ON "abilities"("gameSystemId");
CREATE INDEX "abilities_tab_idx" ON "abilities"("tab");
CREATE INDEX "abilities_sourceClass_idx" ON "abilities"("sourceClass");
CREATE INDEX "abilities_levelRequired_idx" ON "abilities"("levelRequired");

ALTER TABLE "abilities"
    ADD CONSTRAINT "abilities_gameSystemId_fkey"
    FOREIGN KEY ("gameSystemId") REFERENCES "game_systems"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CreateTable: game_system_configs ────────────────────────────────────────

CREATE TABLE "game_system_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gameSystemId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "defaultValue" JSONB NOT NULL,
    "label" TEXT,
    "description" TEXT,

    CONSTRAINT "game_system_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_system_configs_gameSystemId_key_key" ON "game_system_configs"("gameSystemId", "key");
CREATE INDEX "game_system_configs_gameSystemId_idx" ON "game_system_configs"("gameSystemId");

ALTER TABLE "game_system_configs"
    ADD CONSTRAINT "game_system_configs_gameSystemId_fkey"
    FOREIGN KEY ("gameSystemId") REFERENCES "game_systems"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── AlterTable: rooms — add gameSystemId ────────────────────────────────────

ALTER TABLE "rooms" ADD COLUMN "gameSystemId" UUID;
CREATE INDEX "rooms_gameSystemId_idx" ON "rooms"("gameSystemId");

ALTER TABLE "rooms"
    ADD CONSTRAINT "rooms_gameSystemId_fkey"
    FOREIGN KEY ("gameSystemId") REFERENCES "game_systems"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
