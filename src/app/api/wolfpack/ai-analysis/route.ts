
// Wolfpack Matrix AI Analysis API Route

import { NextRequest, NextResponse } from 'next/server'
import WolfpackMatrixAIAnalyzer from '@/lib/wolfpack-ai-analyzer'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { matrixData } = await request.json()
    
    if (!matrixData) {
      return NextResponse.json(
        { error: 'Matrix data is required' },
        { status: 400 }
      )
    }

    const analyzer = new WolfpackMatrixAIAnalyzer()
    const insights = await analyzer.analyzeMatrixSystem(matrixData)

    return NextResponse.json({
      success: true,
      insights,
      analysisTimestamp: new Date().toISOString(),
      systemInfo: {
        analyzer: 'Wolfpack Matrix AI v1.0',
        capabilities: [
          'Connection Analysis',
          'Configuration Review', 
          'Routing Optimization',
          'Layout Mapping',
          'Audio Routing Analysis',
          'Performance Monitoring',
          'Channel Utilization'
        ]
      }
    })

  } catch (error) {
    logger.error('Wolfpack AI Analysis Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      insights: [{
        type: 'error',
        category: 'performance',
        title: 'AI Analysis Error',
        message: `Failed to analyze matrix system: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 95,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }]
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  return NextResponse.json({
    service: 'Wolfpack Matrix AI Analysis',
    version: '1.0.0',
    capabilities: [
      'Real-time matrix analysis',
      'Configuration optimization',
      'Connection troubleshooting',
      'Routing pattern analysis',
      'Layout integration insights',
      'Audio routing recommendations',
      'Performance monitoring',
      'Channel utilization analysis'
    ],
    supportedProtocols: ['TCP', 'UDP'],
    supportedCommands: [
      'YAll. (Input to all outputs)',
      'All1. (One-to-one mapping)', 
      'YXZ. (Input to output)',
      'YXZ&Q&W. (Input to multiple outputs)',
      'SaveY./RecallY. (Scene management)',
      'BeepON./BeepOFF. (Buzzer control)',
      'Y?. (Status query)'
    ]
  })
}
