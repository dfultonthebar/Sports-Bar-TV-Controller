/**
 * @deprecated This file has been removed as part of Prisma to Drizzle migration
 *
 * Please use db-helpers from @/lib/db-helpers instead
 *
 * Migration Pattern:
 * OLD: import { prisma } from '@/lib/prisma'
 *      await prisma.schedule.findMany({ where: { enabled: true } })
 *
 * NEW: import { findMany, eq } from '@/lib/db-helpers'
 *      import { schema } from '@/db'
 *      await findMany('schedules', { where: eq(schema.schedules.enabled, true) })
 *
 * See: src/app/api/schedules/route.ts and src/app/api/home-teams/route.ts for examples
 */

// This file no longer exports anything - migrate to db-helpers
export default undefined
