import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prisma = global.prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
})

// Log all queries with parameters and duration
prisma.$on('query', (e: any) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔍 [PRISMA QUERY]')
  console.log('Query:', e.query)
  console.log('Params:', e.params)
  console.log('Duration:', e.duration + 'ms')
  console.log('Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export default prisma
