
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { testLogs } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'


export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.TESTING)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, ValidationSchemas.logQuery)
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('testType')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where conditions
    const conditions: any[] = []

    if (testType) {
      conditions.push(eq(testLogs.testType, testType))
    }

    if (status) {
      conditions.push(eq(testLogs.status, status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch logs with pagination
    const logsData = await db
      .select()
      .from(testLogs)
      .where(whereClause)
      .orderBy(desc(testLogs.timestamp))
      .limit(limit)
      .offset(offset)

    // Get total count (simplified - just return the current batch count)
    const total = logsData.length

    return NextResponse.json({
      success: true,
      logs: logsData,
      pagination: {
        total,
        limit,
        offset,
        hasMore: logsData.length === limit
      }
    })
  } catch (error) {
    logger.error('Error fetching test logs:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.TESTING)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const olderThan = searchParams.get('olderThan') // ISO date string

    if (olderThan) {
      const date = new Date(olderThan)

      // First, get count of logs to delete
      const logsToDelete = await db
        .select()
        .from(testLogs)
        .where(desc(testLogs.timestamp))

      const countToDelete = logsToDelete.filter(log => new Date(log.timestamp) < date).length

      // Delete logs older than specified date
      await db
        .delete(testLogs)
        .where(desc(testLogs.timestamp))

      return NextResponse.json({
        success: true,
        message: `Deleted ${countToDelete} log entries older than ${olderThan}`,
        deletedCount: countToDelete
      })
    } else {
      // Get count before deleting
      const allLogs = await db.select().from(testLogs)
      const countToDelete = allLogs.length

      // Delete all logs
      await db.delete(testLogs)

      return NextResponse.json({
        success: true,
        message: `Deleted all ${countToDelete} log entries`,
        deletedCount: countToDelete
      })
    }
  } catch (error) {
    logger.error('Error deleting test logs:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}
