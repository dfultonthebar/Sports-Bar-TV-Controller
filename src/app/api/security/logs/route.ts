/**
 * Security Logs API Endpoint
 * View and query security validation events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityLogs, getSecurityLogStats } from '@/lib/ai-tools/security/security-logger';

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export const dynamic = 'force-dynamic';

/**
 * GET /api/security/logs
 * Retrieve security validation logs with optional filters
 *
 * Query parameters:
 * - validationType: Filter by validation type (file_system, code_execution, bash_command, resource_limit)
 * - allowed: Filter by allowed status (true/false)
 * - severity: Filter by severity (info, warning, critical)
 * - userId: Filter by user ID
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Limit number of results (default: 100)
 * - offset: Offset for pagination (default: 0)
 * - stats: If 'true', return statistics instead of logs
 */
export async function GET(request: NextRequest) {
  // Query parameter validation
  const queryValidation = validateQueryParams(request, ValidationSchemas.logQuery)
  if (!queryValidation.success) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams;
    const statsOnly = searchParams.get('stats') === 'true';

    // If requesting stats only
    if (statsOnly) {
      const days = parseInt(searchParams.get('days') || '7');
      const stats = await getSecurityLogStats(days);

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Parse query parameters
    const query: any = {};

    if (searchParams.has('validationType')) {
      query.validationType = searchParams.get('validationType');
    }

    if (searchParams.has('allowed')) {
      query.allowed = searchParams.get('allowed') === 'true';
    }

    if (searchParams.has('severity')) {
      query.severity = searchParams.get('severity');
    }

    if (searchParams.has('userId')) {
      query.userId = searchParams.get('userId');
    }

    if (searchParams.has('startDate')) {
      query.startDate = new Date(searchParams.get('startDate')!);
    }

    if (searchParams.has('endDate')) {
      query.endDate = new Date(searchParams.get('endDate')!);
    }

    if (searchParams.has('limit')) {
      query.limit = parseInt(searchParams.get('limit')!);
    } else {
      query.limit = 100; // Default limit
    }

    if (searchParams.has('offset')) {
      query.offset = parseInt(searchParams.get('offset')!);
    }

    // Get logs
    const logs = await getSecurityLogs(query);

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      query: {
        ...query,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error retrieving security logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve security logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
