/**
 * CEC Command Logs API
 *
 * GET /api/cec/cable-box/logs
 * Get command execution logs with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, desc, and, gte, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, ValidationSchemas.logQuery)
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const cableBoxId = searchParams.get('cableBoxId')
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Build query conditions
    const conditions: any[] = []

    if (cableBoxId && cableBoxId !== 'all') {
      conditions.push(eq(schema.cecCommandLogs.cableBoxId, cableBoxId))
    }

    if (since) {
      const sinceDate = new Date(since)
      conditions.push(gte(schema.cecCommandLogs.timestamp, sinceDate.toISOString()))
    }

    // Fetch logs with cable box names
    const logs = await db
      .select({
        id: schema.cecCommandLogs.id,
        cecDeviceId: schema.cecCommandLogs.cecDeviceId,
        cableBoxId: schema.cecCommandLogs.cableBoxId,
        command: schema.cecCommandLogs.command,
        cecCode: schema.cecCommandLogs.cecCode,
        success: schema.cecCommandLogs.success,
        responseTime: schema.cecCommandLogs.responseTime,
        timestamp: schema.cecCommandLogs.timestamp,
        errorMessage: schema.cecCommandLogs.errorMessage,
        deviceName: schema.cableBoxes.name,
      })
      .from(schema.cecCommandLogs)
      .leftJoin(
        schema.cableBoxes,
        eq(schema.cecCommandLogs.cableBoxId, schema.cableBoxes.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.cecCommandLogs.timestamp))
      .limit(limit)
      .execute()

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    })
  } catch (error: any) {
    logger.error('[API] Error fetching command logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch command logs',
        logs: [],
      },
      { status: 500 }
    )
  }
}
