-- AlterTable: Add usage tracking fields to ChannelPreset
-- Migration: Add usageCount and lastUsed fields for AI-powered auto-reordering

-- Add usageCount column with default value of 0
ALTER TABLE "ChannelPreset" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Add lastUsed column (nullable DateTime)
ALTER TABLE "ChannelPreset" ADD COLUMN "lastUsed" DATETIME;

-- Create index on usageCount for efficient sorting
CREATE INDEX "ChannelPreset_usageCount_idx" ON "ChannelPreset"("usageCount");
