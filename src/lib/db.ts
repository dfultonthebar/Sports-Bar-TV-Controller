
// This file now exports the Drizzle database instance with Prisma compatibility layer
// Maintains backward compatibility with existing imports
import { prisma } from '@/db/prisma-adapter'
import db from '@/db'

export { prisma, db }
export default db
