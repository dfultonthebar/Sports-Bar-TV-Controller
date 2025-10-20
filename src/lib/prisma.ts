/**
 * Prisma compatibility layer using Drizzle ORM
 * Provides a Prisma-like API for backward compatibility
 */
import { prisma } from '@/db/prisma-adapter'

// Note: Query logging is handled at the Drizzle level in src/db/index.ts
// The prisma adapter provides full Prisma API compatibility

export default prisma
