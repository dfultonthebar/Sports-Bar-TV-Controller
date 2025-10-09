import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

console.log('[DB] Initializing Prisma client, current globalThis.prisma:', !!globalForPrisma.prisma)

// Create or reuse the Prisma client instance
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

console.log('[DB] Prisma client created/reused:', !!prisma)

// Cache the Prisma client in globalThis for both development and production
// This prevents multiple instances and ensures the client is always available
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
  console.log('[DB] Cached Prisma client in globalThis')
}

console.log('[DB] Final check - globalThis.prisma:', !!globalForPrisma.prisma, 'exported prisma:', !!prisma)

export default prisma
