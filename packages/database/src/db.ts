/**
 * Database Connection Module
 *
 * Provides SQLite database connection using Drizzle ORM.
 * Logger is optional - works without it but logs when provided.
 */

import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { existsSync, statSync } from 'fs'

// Optional logger interface - allows apps to inject their logger
export interface DatabaseLogger {
  debug?: (message: string) => void;
  error?: (message: string) => void;
  info?: (message: string) => void;
}

// Default no-op logger
const noopLogger: DatabaseLogger = {
  debug: () => {},
  error: () => {},
  info: () => {},
}

// Logger instance (can be set via setLogger)
let currentLogger: DatabaseLogger = noopLogger;

/**
 * Set the logger for database operations
 */
export function setDatabaseLogger(logger: DatabaseLogger): void {
  currentLogger = logger;
}

// Get database URL from environment variable
// Production database is at /home/ubuntu/sports-bar-data/production.db
const databaseUrl = process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'

// Extract file path from URL (remove 'file:' prefix if present)
const dbPath = databaseUrl.replace('file:', '')

currentLogger.info?.(`Database: Connecting to ${dbPath}`)

// Validate database file exists and is non-empty
if (!existsSync(dbPath)) {
  const errorMsg = `DATABASE ERROR: Database file not found at ${dbPath}`
  currentLogger.error?.(errorMsg)
  throw new Error(`Database file not found: ${dbPath}`)
}

const dbStats = statSync(dbPath)
if (dbStats.size === 0) {
  const errorMsg = `DATABASE ERROR: Database file is empty (0 bytes): ${dbPath}`
  currentLogger.error?.(errorMsg)
  throw new Error(`Database file is empty: ${dbPath}`)
}

currentLogger.debug?.(`Database file validated: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`)

// Create SQLite database connection
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')
currentLogger.debug?.('Enabled WAL mode for better concurrency')

// Create Drizzle instance with query logging
export const db = drizzle(sqlite, {
  schema,
  logger: {
    logQuery: (query: string, params: unknown[]) => {
      currentLogger.debug?.(`SQL: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`)
    },
  },
})

currentLogger.info?.(`Database: Connected to ${dbPath}`)

export { schema }
export default db
