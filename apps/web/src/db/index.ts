/**
 * Database Connection - Bridge to @sports-bar/database
 *
 * This file bridges the local import path (@/db) to the shared package.
 * It initializes the database with the app's logger.
 */

import { db, schema, setDatabaseLogger } from '@sports-bar/database'
import { logger } from '@/lib/logger'

// Set up database logging using the app's logger
setDatabaseLogger({
  debug: (message: string) => logger.debug(message),
  error: (message: string) => logger.error(message),
  info: (message: string) => logger.info(message),
})

// Re-export database and schema
export { db, schema }
export default db
