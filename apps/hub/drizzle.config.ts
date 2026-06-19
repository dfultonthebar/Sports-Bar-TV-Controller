import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.HUB_DB_PATH || '/home/ubuntu/sbcc-hub-data/hub.db',
  },
} satisfies Config
