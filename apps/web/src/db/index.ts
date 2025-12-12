
// Load environment variables FIRST (before any code that uses them)
import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { logger } from '@/lib/logger'

// Get database URL from environment variable
// Production database is at /home/ubuntu/sports-bar-data/production.db
const databaseUrl = process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'

// Extract file path from URL (remove 'file:' prefix if present)
const dbPath = databaseUrl.replace('file:', '')

logger.system.startup('Database Connection')
logger.debug(`Attempting to connect to database at: ${dbPath}`)

// Validate database file exists and is non-empty
import { existsSync, statSync } from 'fs'
if (!existsSync(dbPath)) {
  logger.error(`DATABASE ERROR: Database file not found at ${dbPath}`)
  logger.error(`Please check DATABASE_URL environment variable`)
  throw new Error(`Database file not found: ${dbPath}`)
}

const dbStats = statSync(dbPath)
if (dbStats.size === 0) {
  logger.error(`DATABASE ERROR: Database file is empty (0 bytes): ${dbPath}`)
  logger.error(`This is likely a misconfigured or corrupted database`)
  logger.error(`Correct database should be at: /home/ubuntu/sports-bar-data/production.db`)
  throw new Error(`Database file is empty: ${dbPath}`)
}

logger.debug(`Database file validated: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`)

// Create SQLite database connection
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')
logger.debug('Enabled WAL mode for better concurrency')

// Create Drizzle instance with logging
export const db = drizzle(sqlite, { 
  schema,
  logger: {
    logQuery: (query: string, params: unknown[]) => {
      logger.database.query('Execute', 'SQL', { query, params })
    },
  },
})

logger.database.connection('connected', dbPath)
logger.system.ready('Database Connection')

export { schema }
export default db
