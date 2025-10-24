-- CreateTable: AudioGroup
-- This migration adds support for Atlas audio groups (combined zone groups)
-- Groups allow controlling multiple zones together as a single unit

CREATE TABLE IF NOT EXISTS "AudioGroup" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "processorId" TEXT NOT NULL,
  "groupNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" INTEGER DEFAULT 0 NOT NULL,
  "currentSource" TEXT,
  "gain" REAL DEFAULT -10 NOT NULL,
  "muted" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("processorId") REFERENCES "AudioProcessor"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AudioGroup_processorId_groupNumber_key" ON "AudioGroup"("processorId", "groupNumber");
