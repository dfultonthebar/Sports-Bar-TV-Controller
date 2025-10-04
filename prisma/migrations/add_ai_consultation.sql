-- Add AI Consultation table for multi-AI diagnostics
CREATE TABLE IF NOT EXISTS "AIConsultation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" TEXT,
    "query" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "providers" TEXT,
    "consensusLevel" TEXT,
    "confidence" REAL,
    "hasDisagreements" INTEGER DEFAULT 0,
    "votingWinner" TEXT,
    "processingTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AIConsultation_timestamp_idx" ON "AIConsultation"("timestamp");
CREATE INDEX IF NOT EXISTS "AIConsultation_issueId_idx" ON "AIConsultation"("issueId");

-- Add AI recommendation fields to Issue table
ALTER TABLE "Issue" ADD COLUMN "aiRecommendation" TEXT;
ALTER TABLE "Issue" ADD COLUMN "aiConfidence" REAL;
ALTER TABLE "Issue" ADD COLUMN "needsReview" INTEGER DEFAULT 0;

-- Add AI fields to Fix table
ALTER TABLE "Fix" ADD COLUMN "aiRecommended" INTEGER DEFAULT 0;
ALTER TABLE "Fix" ADD COLUMN "aiConfidence" REAL;

-- Add AI fields to SystemHealthCheck table
ALTER TABLE "SystemHealthCheck" ADD COLUMN "aiAnalyzed" INTEGER DEFAULT 0;
ALTER TABLE "SystemHealthCheck" ADD COLUMN "aiInsights" TEXT;
