
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // Production database is at /home/ubuntu/sports-bar-data/production.db
    url: process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'
  }
} satisfies Config
