
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { logger } from '@/lib/logger'

// Get database URL from environment variable
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'

// Extract file path from URL (remove 'file:' prefix if present)
const dbPath = databaseUrl.replace('file:', '')

logger.system.startup('Database Connection')
logger.debug(`Attempting to connect to database at: ${dbPath}`)

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
