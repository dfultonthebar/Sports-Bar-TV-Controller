

import { NextRequest, NextResponse } from 'next/server'
import { localAIAnalyzer, AIAnalysisResult } from '@/lib/local-ai-analyzer'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Check AI system status
    const aiStatus = await localAIAnalyzer.getSystemStatus()
    
    // Get some basic system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      timestamp: new Date().toISOString()
    }

    // Check if we can perform analysis
    let testAnalysis: AIAnalysisResult | null = null
    if (aiStatus.available) {
      try {
        // Create a small test log for analysis
        const testLogs = [
          {
            id: 'test-1',
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            category: 'system' as const,
            source: 'test',
            action: 'system_check',
            message: 'System check test log',
            success: true
          }
        ]
        
        testAnalysis = await localAIAnalyzer.analyzeLogData(testLogs, {
          test: true
        })
      } catch (error) {
        logger.error('Test analysis failed:', error)
      }
    }

    const response = {
      aiSystem: {
        available: aiStatus.available,
        capabilities: aiStatus.capabilities,
        lastCheck: new Date().toISOString()
      },
      testAnalysis: testAnalysis ? {
        successful: true,
        severity: testAnalysis.severity,
        confidence: testAnalysis.confidence
      } : {
        successful: false,
        reason: 'AI system not available or test failed'
      },
      systemInfo,
      recommendations: [] as string[]
    }

    // Add recommendations based on status
    if (!aiStatus.available) {
      response.recommendations.push('Install Python 3.11+ to enable AI log analysis')
      response.recommendations.push('Run the AI setup script to configure the local analyzer')
    }

    // Log the status check
    await enhancedLogger.info(
      'api',
      'ai-system-status',
      'check_status',
      'AI system status checked',
      {
        available: aiStatus.available,
        capabilities: aiStatus.capabilities?.length || 0,
        testAnalysisSuccessful: !!testAnalysis
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to check AI system status:', error)
    
    await enhancedLogger.error(
      'api',
      'ai-system-status',
      'check_status',
      'Failed to check AI system status',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json({
      aiSystem: {
        available: false,
        capabilities: [] as any[],
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      testAnalysis: {
        successful: false,
        reason: 'Status check failed'
      },
      systemInfo: {
        timestamp: new Date().toISOString(),
        error: 'Failed to get system info'
      },
      recommendations: [
        'Check system logs for AI setup issues',
        'Ensure Python 3.11+ is installed',
        'Run AI system diagnostics'
      ]
    })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'test_analysis':
        return await handleTestAnalysis()
      case 'reinitialize':
        return await handleReinitialize()
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Failed to handle AI system action:', error)
    
    return NextResponse.json(
      { error: 'Failed to handle AI system action' },
      { status: 500 }
    )
  }
}

async function handleTestAnalysis() {
  try {
    // Create comprehensive test logs
    const testLogs = [
      {
        id: 'test-1',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        level: 'info' as const,
        category: 'user_interaction' as const,
        source: 'test-user',
        action: 'login',
        message: 'User logged into system',
        success: true,
        duration: 250
      },
      {
        id: 'test-2',
        timestamp: new Date(Date.now() - 3000000).toISOString(), // 50 minutes ago
        level: 'error' as const,
        category: 'hardware' as const,
        source: 'test-device',
        action: 'connection_failed',
        message: 'Device connection timeout',
        success: false,
        deviceType: 'wolf_pack' as const,
        deviceId: 'test-matrix'
      },
      {
        id: 'test-3',
        timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        level: 'warn' as const,
        category: 'performance' as const,
        source: 'test-monitor',
        action: 'slow_response',
        message: 'API response time exceeded threshold',
        success: true,
        duration: 5500
      },
      {
        id: 'test-4',
        timestamp: new Date().toISOString(),
        level: 'info' as const,
        category: 'system' as const,
        source: 'test-system',
        action: 'health_check',
        message: 'System health check completed',
        success: true
      }
    ]

    const analysis = await localAIAnalyzer.analyzeLogData(testLogs, {
      testMode: true,
      analysisType: 'comprehensive'
    })

    await enhancedLogger.info(
      'api',
      'ai-system-test',
      'test_analysis',
      'AI system test analysis completed',
      {
        testLogsCount: testLogs.length,
        severity: analysis.severity,
        confidence: analysis.confidence,
        patternsFound: analysis.patterns.length,
        recommendationsGenerated: analysis.recommendations.length
      }
    )

    return NextResponse.json({
      success: true,
      testResults: {
        logsAnalyzed: testLogs.length,
        analysis,
        performedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Test analysis failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test analysis failed',
      performedAt: new Date().toISOString()
    })
  }
}

async function handleReinitialize() {
  try {
    // This would reinitialize the AI analyzer
    const newAnalyzer = new (await import('@/lib/local-ai-analyzer')).LocalAIAnalyzer()
    const status = await newAnalyzer.getSystemStatus()

    await enhancedLogger.info(
      'api',
      'ai-system-reinit',
      'reinitialize',
      'AI system reinitialized',
      {
        available: status.available,
        capabilities: status.capabilities?.length || 0
      }
    )

    return NextResponse.json({
      success: true,
      message: 'AI system reinitialized',
      status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to reinitialize AI system:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Reinitialization failed',
      timestamp: new Date().toISOString()
    })
  }
}
