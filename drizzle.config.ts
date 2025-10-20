
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'
  }
} satisfies Config
