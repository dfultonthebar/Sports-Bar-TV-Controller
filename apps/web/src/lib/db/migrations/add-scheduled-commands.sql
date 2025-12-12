-- Migration: Add Scheduled Commands and Enhanced Training Documents
-- Date: 2025-11-02

-- Add new columns to TrainingDocument table
ALTER TABLE TrainingDocument ADD COLUMN filePath TEXT NOT NULL DEFAULT '';
ALTER TABLE TrainingDocument ADD COLUMN tags TEXT;
ALTER TABLE TrainingDocument ADD COLUMN description TEXT;
ALTER TABLE TrainingDocument ADD COLUMN metadata TEXT;
ALTER TABLE TrainingDocument ADD COLUMN processedAt TEXT;
ALTER TABLE TrainingDocument ADD COLUMN viewCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE TrainingDocument ADD COLUMN lastViewed TEXT;

-- Create index on category
CREATE INDEX IF NOT EXISTS TrainingDocument_category_idx ON TrainingDocument(category);

-- Create ScheduledCommand table
CREATE TABLE IF NOT EXISTS ScheduledCommand (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  commandType TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targets TEXT NOT NULL,
  commandSequence TEXT NOT NULL,
  scheduleType TEXT NOT NULL,
  scheduleData TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  enabled INTEGER NOT NULL DEFAULT 1,
  lastExecuted TEXT,
  nextExecution TEXT,
  executionCount INTEGER NOT NULL DEFAULT 0,
  failureCount INTEGER NOT NULL DEFAULT 0,
  createdBy TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ScheduledCommand
CREATE INDEX IF NOT EXISTS ScheduledCommand_commandType_idx ON ScheduledCommand(commandType);
CREATE INDEX IF NOT EXISTS ScheduledCommand_scheduleType_idx ON ScheduledCommand(scheduleType);
CREATE INDEX IF NOT EXISTS ScheduledCommand_enabled_idx ON ScheduledCommand(enabled);
CREATE INDEX IF NOT EXISTS ScheduledCommand_nextExecution_idx ON ScheduledCommand(nextExecution);

-- Create ScheduledCommandLog table
CREATE TABLE IF NOT EXISTS ScheduledCommandLog (
  id TEXT PRIMARY KEY,
  scheduledCommandId TEXT NOT NULL,
  executedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success INTEGER NOT NULL,
  commandsSent INTEGER NOT NULL DEFAULT 0,
  commandsFailed INTEGER NOT NULL DEFAULT 0,
  executionTime INTEGER,
  errorMessage TEXT,
  details TEXT,
  targetResults TEXT,
  FOREIGN KEY (scheduledCommandId) REFERENCES ScheduledCommand(id) ON DELETE CASCADE
);

-- Create indexes for ScheduledCommandLog
CREATE INDEX IF NOT EXISTS ScheduledCommandLog_scheduledCommandId_idx ON ScheduledCommandLog(scheduledCommandId);
CREATE INDEX IF NOT EXISTS ScheduledCommandLog_executedAt_idx ON ScheduledCommandLog(executedAt);
CREATE INDEX IF NOT EXISTS ScheduledCommandLog_success_idx ON ScheduledCommandLog(success);
