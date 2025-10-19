import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Initialize Prisma Client with error handling
let prismaInstance: PrismaClient | undefined

try {
  prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
    log: ['query', 'error', 'warn'],
    errorFormat: 'pretty',
  })
  
  // Test database connection on initialization
  prismaInstance.$connect()
    .then(() => {
      console.log('[Database] Prisma client connected successfully')
    })
    .catch((error) => {
      console.error('[Database] Failed to connect to database:', error)
      console.error('[Database] Please check your DATABASE_URL environment variable')
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance
  }
} catch (error) {
  console.error('[Database] Error initializing Prisma client:', error)
  console.error('[Database] The application may not function correctly without database access')
}

export const prisma = prismaInstance!

export default prisma
