/**
 * @deprecated This file exports the Prisma compatibility adapter which is DEPRECATED
 * 
 * Please migrate to direct Drizzle ORM usage with helpers from @/lib/db-helpers
 * 
 * Migration Pattern:
 * OLD: import { prisma } from '@/lib/prisma'
 *      await prisma.schedule.findMany({ where: { enabled: true } })
 * 
 * NEW: import { findMany, eq } from '@/lib/db-helpers'
 *      import { schema } from '@/db'
 *      import { logger } from '@/lib/logger'
 *      await findMany('schedules', { where: eq(schema.schedules.enabled, true) })
 * 
 * See: src/app/api/schedules/route.ts and src/app/api/home-teams/route.ts for examples
 * 
 * This file is kept temporarily for backward compatibility but will be removed soon.
 * All new code should use direct Drizzle ORM with comprehensive logging.
 */
import { prisma } from '@/db/prisma-adapter'

// Note: Query logging is now handled via the logger utility in @/lib/logger
// For verbose logging, use the db-helpers from @/lib/db-helpers

export default prisma
