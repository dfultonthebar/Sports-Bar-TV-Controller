-- Network TV Control Schema Migration
-- Created: 2025-11-21
-- Purpose: Add NetworkTVDevice table for IP-controlled TV management (Samsung, LG, Sony, Roku, Vizio, Sharp, Hisense)

CREATE TABLE IF NOT EXISTS "NetworkTVDevice" (
  "id" text PRIMARY KEY NOT NULL,
  "ipAddress" text NOT NULL UNIQUE,
  "macAddress" text,
  "brand" text NOT NULL,
  "model" text,
  "port" integer NOT NULL,
  "authToken" text,
  "clientKey" text,
  "psk" text,
  "status" text DEFAULT 'offline' NOT NULL,
  "lastSeen" text,
  "matrixOutputId" text,
  "supportsPower" integer DEFAULT 1 NOT NULL,
  "supportsVolume" integer DEFAULT 1 NOT NULL,
  "supportsInput" integer DEFAULT 1 NOT NULL,
  "createdAt" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("matrixOutputId") REFERENCES "MatrixOutput"("id") ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "NetworkTVDevice_brand_idx" ON "NetworkTVDevice" ("brand");
CREATE INDEX IF NOT EXISTS "NetworkTVDevice_status_idx" ON "NetworkTVDevice" ("status");
CREATE INDEX IF NOT EXISTS "NetworkTVDevice_matrixOutputId_idx" ON "NetworkTVDevice" ("matrixOutputId");
CREATE INDEX IF NOT EXISTS "NetworkTVDevice_ipAddress_idx" ON "NetworkTVDevice" ("ipAddress");
