/**
 * Hub DB client — its own SQLite, separate from any location's production.db.
 * Path via HUB_DB_PATH (default /home/ubuntu/sbcc-hub-data/hub.db).
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema.js'

const dbPath = process.env.HUB_DB_PATH || '/home/ubuntu/sbcc-hub-data/hub.db'
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })
export { schema }
