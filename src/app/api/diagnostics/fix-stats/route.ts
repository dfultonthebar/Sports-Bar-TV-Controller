
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

    const fixes = await prisma.fix.findMany({
      where: {
        timestamp: {
          gte: since
        }
      },
      select: {
        success: true,
        duration: true
      }
    })

    const successful = fixes.filter(f => f.success).length
    const failed = fixes.filter(f => !f.success).length
    const total = fixes.length

    const durations = fixes.filter(f => f.duration).map(f => f.duration!)
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null

    return NextResponse.json({
      success: true,
      stats: {
        successful,
        failed,
        total,
        avgDuration
      }
    })
  } catch (error) {
    console.error('Error fetching fix stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fix stats' },
      { status: 500 }
    )
  }
}
