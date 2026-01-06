

import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const component = searchParams.get('component') || undefined

    // Get configuration change logs
    const configLogs = await enhancedLogger.getRecentLogs(hours, 'configuration')
    
    // Filter by component if specified
    const filteredLogs = component 
      ? configLogs.filter(log => log.details?.component === component)
      : configLogs

    // Analyze configuration changes
    const configChanges = filteredLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      component: log.details?.component || 'unknown',
      setting: log.details?.setting || 'unknown',
      oldValue: log.details?.oldValue,
      newValue: log.details?.newValue,
      userId: log.userId || 'system',
      success: log.success
    }))

    // Group changes by component
    const changesByComponent = configChanges.reduce((acc, change) => {
      if (!acc[change.component]) {
        acc[change.component] = []
      }
      acc[change.component].push(change)
      return acc
    }, {} as Record<string, any[]>)

    // Generate statistics
    const stats = {
      totalChanges: configChanges.length,
      componentsModified: Object.keys(changesByComponent).length,
      mostActiveComponent: Object.entries(changesByComponent)
        .sort(([, a], [, b]) => b.length - a.length)[0]?.[0] || 'none',
      recentChanges: configChanges.slice(0, 10),
      changesByHour: generateHourlyDistribution(configChanges)
    }

    const response = {
      configurationChanges: configChanges,
      changesByComponent,
      statistics: stats,
      filters: { hours, component },
      timestamp: new Date().toISOString()
    }

    // Log the tracking request
    await enhancedLogger.info(
      'api',
      'config-tracking-api',
      'track_config_changes',
      'Configuration tracking data requested',
      {
        hours,
        component,
        totalChanges: configChanges.length,
        componentsModified: Object.keys(changesByComponent).length
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to track configuration changes:', error)
    
    await enhancedLogger.error(
      'api',
      'config-tracking-api',
      'track_config_changes',
      'Failed to track configuration changes',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to track configuration changes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { 
      component, 
      setting, 
      oldValue, 
      newValue, 
      userId, 
      metadata 
    } = body

    // Validate required fields
    if (!component || !setting) {
      return NextResponse.json(
        { error: 'Component and setting are required' },
        { status: 400 }
      )
    }

    // Log the configuration change
    await enhancedLogger.logConfigurationChange(
      component,
      setting,
      oldValue,
      newValue,
      userId
    )

    // Also log as user action for comprehensive tracking
    await enhancedLogger.logUserInteraction(
      'configuration_change',
      {
        component,
        setting,
        oldValue,
        newValue,
        metadata
      },
      userId
    )

    return NextResponse.json({
      success: true,
      message: 'Configuration change logged',
      timestamp: new Date().toISOString(),
      change: {
        component,
        setting,
        oldValue,
        newValue,
        userId
      }
    })
  } catch (error) {
    logger.error('Failed to log configuration change:', error)
    
    await enhancedLogger.error(
      'api',
      'config-tracking-api',
      'log_config_change',
      'Failed to log configuration change',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to log configuration change' },
      { status: 500 }
    )
  }
}

function generateHourlyDistribution(changes: any[]): Record<number, number> {
  const hourly: Record<number, number> = {}
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourly[i] = 0
  }
  
  // Count changes by hour
  changes.forEach(change => {
    try {
      const hour = new Date(change.timestamp).getHours()
      hourly[hour]++
    } catch (error) {
      // Skip invalid timestamps
    }
  })
  
  return hourly
}
