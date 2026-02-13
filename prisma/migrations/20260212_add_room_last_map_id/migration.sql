-- AlterTable: Add lastMapId to rooms for cross-session map persistence
ALTER TABLE "rooms" ADD COLUMN "lastMapId" UUID;
