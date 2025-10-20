
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

// Get database URL from environment variable
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'

// Extract file path from URL (remove 'file:' prefix if present)
const dbPath = databaseUrl.replace('file:', '')

// Create SQLite database connection
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')

// Create Drizzle instance
export const db = drizzle(sqlite, { schema })

// Log successful connection
console.log('[Database] Drizzle ORM connected successfully to:', dbPath)

export { schema }
export default db
