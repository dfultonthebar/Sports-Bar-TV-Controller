
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

    const issues = await prisma.issue.findMany({
      where: {
        timestamp: {
          gte: since
        }
      },
      select: {
        type: true
      }
    })

    // Count by type
    const stats = issues.reduce((acc: any[], issue) => {
      const existing = acc.find(s => s.type === issue.type)
      if (existing) {
        existing.count++
      } else {
        acc.push({ type: issue.type, count: 1 })
      }
      return acc
    }, [])

    // Sort by count descending
    stats.sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching issue stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch issue stats' },
      { status: 500 }
    )
  }
}
