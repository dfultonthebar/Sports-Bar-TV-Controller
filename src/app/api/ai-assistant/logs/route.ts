
import { NextRequest, NextResponse } from 'next/server';
import { enhancedLogger } from '@/lib/enhanced-logger';
import type { LogLevel, LogCategory } from '@/lib/enhanced-logger';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, ValidationSchemas.logQuery)
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const hours = parseInt(searchParams.get('hours') || '24');
    const maxLines = parseInt(searchParams.get('maxLines') || '100');
    const severity = searchParams.get('severity') as LogLevel | null;
    const category = searchParams.get('category') as LogCategory | null;
    const errorsOnly = searchParams.get('errorsOnly') === 'true';
    
    // Fetch logs based on filters
    let logs = await enhancedLogger.getRecentLogs(
      hours,
      category || undefined,
      errorsOnly ? 'error' : (severity || undefined)
    );
    
    // Limit the number of logs returned
    logs = logs.slice(0, maxLines);
    
    // Get analytics for context
    const analytics = await enhancedLogger.getLogAnalytics(hours);
    
    // Format logs for display
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      category: log.category,
      source: log.source,
      action: log.action,
      message: log.message,
      details: log.details,
      success: log.success,
      duration: log.duration,
      deviceType: log.deviceType,
      deviceId: log.deviceId,
      errorStack: log.errorStack
    }));
    
    return NextResponse.json({
      logs: formattedLogs,
      analytics: {
        totalLogs: analytics.totalLogs,
        errorRate: analytics.errorRate,
        topErrors: analytics.topErrors.slice(0, 5),
        recommendations: analytics.recommendations
      },
      filters: {
        hours,
        maxLines,
        severity,
        category,
        errorsOnly
      }
    });
    
  } catch (error) {
    logger.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.logQuery)
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const { action, hours = 24, category } = bodyValidation.data;
    
    if (action === 'export') {
      // Export logs for download
      const exportData = await enhancedLogger.exportLogsForDownload(hours, category);
      
      return NextResponse.json({
        filename: exportData.filename,
        content: exportData.content,
        summary: exportData.summary
      });
    }
    
    if (action === 'analyze') {
      // Get logs and prepare them for AI analysis
      const logs = await enhancedLogger.getRecentLogs(hours, category);
      const analytics = await enhancedLogger.getLogAnalytics(hours);
      
      // Filter to most relevant logs for AI analysis
      const errorLogs = logs.filter(log => 
        log.level === 'error' || log.level === 'critical'
      ).slice(0, 50);
      
      const recentLogs = logs.slice(0, 100);
      
      return NextResponse.json({
        errorLogs,
        recentLogs,
        analytics,
        summary: {
          totalErrors: errorLogs.length,
          errorRate: analytics.errorRate,
          topErrors: analytics.topErrors,
          recommendations: analytics.recommendations,
          systemState: analytics.errorRate > 10 ? 'problematic' : 
                       analytics.errorRate > 5 ? 'warning' : 'healthy'
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    logger.error('Error processing log request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
