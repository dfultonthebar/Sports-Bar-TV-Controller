
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('testType')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    
    if (testType) {
      where.testType = testType
    }
    
    if (status) {
      where.status = status
    }

    const [logs, total] = await Promise.all([
      prisma.testLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.testLog.count({ where })
    ])

    return NextResponse.json({ 
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching test logs:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const olderThan = searchParams.get('olderThan') // ISO date string
    
    if (olderThan) {
      const date = new Date(olderThan)
      const result = await prisma.testLog.deleteMany({
        where: {
          timestamp: {
            lt: date
          }
        }
      })
      
      return NextResponse.json({ 
        success: true,
        message: `Deleted ${result.count} log entries older than ${olderThan}`,
        deletedCount: result.count
      })
    } else {
      // Delete all logs
      const result = await prisma.testLog.deleteMany({})
      
      return NextResponse.json({ 
        success: true,
        message: `Deleted all ${result.count} log entries`,
        deletedCount: result.count
      })
    }
  } catch (error) {
    console.error('Error deleting test logs:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 })
  }
}
