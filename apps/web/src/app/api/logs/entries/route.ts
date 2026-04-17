/**
 * System Logs Entries API
 * GET /api/logs/entries - Query system logs with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger, LogCategory, LogLevel, EnhancedLogEntry } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const queryValidation = validateQueryParams(request, z.object({
    hours: z.coerce.number().int().min(1).max(720).optional(),
    category: z.string().optional(),
    level: z.string().optional(),
    source: z.string().optional(),
    search: z.string().optional(),
    success: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }).optional())

  if (isValidationError(queryValidation)) {
    return queryValidation.error
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24', 10)
    const category = searchParams.get('category') || undefined
    const level = searchParams.get('level') || undefined
    const source = searchParams.get('source') || undefined
    const search = searchParams.get('search') || undefined
    const success = searchParams.get('success')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500)

    // Get all logs for the time period
    let logs = await enhancedLogger.getRecentLogs(
      hours,
      category as LogCategory | undefined,
      level as LogLevel | undefined
    )

    // Apply additional filters
    if (source && source !== 'all') {
      logs = logs.filter((log: EnhancedLogEntry) => log.source === source)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      logs = logs.filter((log: EnhancedLogEntry) =>
        log.message.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
      )
    }

    if (success !== null && success !== undefined && success !== 'all') {
      const successBool = success === 'true'
      logs = logs.filter((log: EnhancedLogEntry) => log.success === successBool)
    }

    // Calculate pagination
    const totalCount = logs.length
    const offset = (page - 1) * limit
    const paginatedLogs = logs.slice(offset, offset + limit)

    // Get unique sources for filter dropdown
    const allLogs = await enhancedLogger.getRecentLogs(hours)
    const uniqueSources = [...new Set(allLogs.map((log: EnhancedLogEntry) => log.source))].sort()
    const uniqueCategories = [...new Set(allLogs.map((log: EnhancedLogEntry) => log.category))].sort()

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
        filters: {
          hours,
          category,
          level,
          source,
          search,
          success,
        },
        availableFilters: {
          sources: uniqueSources,
          categories: uniqueCategories,
        },
      },
    })
  } catch (error: any) {
    logger.error('[SYSTEM-LOGS-API] Error fetching logs:', { error })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
