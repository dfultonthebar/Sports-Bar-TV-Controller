-- Migration: Add Security Validation Logs table
-- Created: 2025-11-02
-- Description: Track all security validation events for audit and monitoring

CREATE TABLE IF NOT EXISTS "SecurityValidationLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "validationType" TEXT NOT NULL,
  "operationType" TEXT,
  "allowed" INTEGER NOT NULL,
  "blockedReason" TEXT,
  "blockedPatterns" TEXT,
  "requestPath" TEXT,
  "requestContent" TEXT,
  "sanitizedInput" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "ipAddress" TEXT,
  "userId" TEXT,
  "sessionId" TEXT,
  "metadata" TEXT,
  "timestamp" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "SecurityValidationLog_validationType_idx" ON "SecurityValidationLog"("validationType");
CREATE INDEX IF NOT EXISTS "SecurityValidationLog_allowed_idx" ON "SecurityValidationLog"("allowed");
CREATE INDEX IF NOT EXISTS "SecurityValidationLog_severity_idx" ON "SecurityValidationLog"("severity");
CREATE INDEX IF NOT EXISTS "SecurityValidationLog_timestamp_idx" ON "SecurityValidationLog"("timestamp");
CREATE INDEX IF NOT EXISTS "SecurityValidationLog_userId_idx" ON "SecurityValidationLog"("userId");
