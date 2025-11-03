
/**
 * Atlas AI Analysis API Route
 * Provides AI-powered analysis specifically for Atlas audio processors
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, gte, desc, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { processorId, processorModel } = await request.json()

    // Validate required data
    if (!processorId || !processorModel) {
      return NextResponse.json(
        { error: 'Processor ID and model are required' },
        { status: 400 }
      )
    }

    // Fetch processor from database
    const processor = await db
      .select()
      .from(schema.audioProcessors)
      .where(eq(schema.audioProcessors.id, processorId))
      .limit(1)
      .get()

    if (!processor) {
      return NextResponse.json(
        { error: 'Processor not found' },
        { status: 404 }
      )
    }

    // Fetch audio zones for this processor
    const audioZones = await db
      .select()
      .from(schema.audioZones)
      .where(eq(schema.audioZones.processorId, processorId))
      .all()

    // Fetch last 50 input meter readings
    const inputMeters = await db
      .select()
      .from(schema.audioInputMeters)
      .where(eq(schema.audioInputMeters.processorId, processorId))
      .orderBy(desc(schema.audioInputMeters.timestamp))
      .limit(50)
      .all()

    // Combine processor with related data
    const processorWithData = {
      ...processor,
      audioZones,
      inputMeters
    }

    // Collect real-time monitoring data
    const monitoringData = await collectAtlasMonitoringData(processorWithData)

    // Perform AI analysis
    const analysis = await analyzeAtlasData(monitoringData, processorWithData)

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Atlas AI analysis API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze Atlas data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')
    const hours = parseInt(searchParams.get('hours') || '24')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Get historical Atlas analysis data from input meters
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const historicalData = await db
      .select()
      .from(schema.audioInputMeters)
      .where(
        and(
          eq(schema.audioInputMeters.processorId, processorId),
          gte(schema.audioInputMeters.timestamp, cutoffDate)
        )
      )
      .orderBy(desc(schema.audioInputMeters.timestamp))
      .all()

    const summary = generateHistoricalSummary(historicalData)

    return NextResponse.json({
      success: true,
      processorId,
      hours,
      dataPoints: historicalData.length,
      data: historicalData,
      summary
    })

  } catch (error) {
    logger.error('Atlas AI history API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve Atlas analysis history' },
      { status: 500 }
    )
  }
}

/**
 * Collect real-time monitoring data from Atlas processor
 */
async function collectAtlasMonitoringData(processor: any) {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

  // Get recent input meter readings
  const recentMeters = await db
    .select()
    .from(schema.audioInputMeters)
    .where(
      and(
        eq(schema.audioInputMeters.processorId, processor.id),
        gte(schema.audioInputMeters.timestamp, fiveMinutesAgo)
      )
    )
    .orderBy(desc(schema.audioInputMeters.timestamp))
    .all()

  // Calculate input levels from recent meters
  const inputLevels: { [key: number]: number } = {}
  const inputsByNumber = new Map<number, any[]>()

  recentMeters.forEach(meter => {
    if (!inputsByNumber.has(meter.inputNumber)) {
      inputsByNumber.set(meter.inputNumber, [])
    }
    inputsByNumber.get(meter.inputNumber)!.push(meter)
  })

  // Average the levels for each input
  inputsByNumber.forEach((meters, inputNumber) => {
    const avgLevel = meters.reduce((sum, m) => sum + m.level, 0) / meters.length
    inputLevels[inputNumber] = avgLevel
  })

  // Calculate output levels from zones
  const outputLevels: { [key: number]: number } = {}
  processor.audioZones.forEach((zone: any, index: number) => {
    // Estimate output level based on zone volume (convert 0-100 to dB scale)
    const volumeDb = (zone.volume / 100) * -60 + 0 // 0-100 maps to -60dB to 0dB
    outputLevels[index + 1] = zone.muted ? -100 : volumeDb
  })

  // Calculate network latency based on last seen
  const lastSeenDate = new Date(processor.lastSeen)
  const networkLatency = Math.min(Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000), 999)

  // Check for clipping in recent meters (convert SQLite boolean to JavaScript boolean)
  const clippingInputs = recentMeters.filter(m => Boolean(m.clipping)).map(m => m.inputNumber)
  const errorLogs = clippingInputs.length > 0
    ? [`Clipping detected on inputs: ${clippingInputs.join(', ')}`]
    : []

  return {
    processorId: processor.id,
    processorModel: processor.model,
    inputLevels,
    outputLevels,
    networkLatency,
    cpuLoad: 0, // Would need to query Atlas API for this
    memoryUsage: 0, // Would need to query Atlas API for this
    errorLogs,
    configChanges: [],
    sceneRecalls: [],
    lastSeen: processor.lastSeen,
    status: processor.status,
    zones: processor.audioZones?.length || 0,
    activeInputs: Object.keys(inputLevels).length,
    recentMeterCount: recentMeters.length
  }
}

/**
 * Analyze Atlas data using built-in logic (no Python dependency)
 */
async function analyzeAtlasData(data: any, processor: any) {
  const analysis: any = {
    severity: 'optimal',
    category: 'performance',
    summary: '',
    audioPatterns: [],
    hardwareRecommendations: [],
    configurationIssues: [],
    performanceMetrics: {
      signalQuality: 100,
      latencyMs: data.networkLatency,
      processingLoad: data.cpuLoad,
      networkStability: 100
    },
    audioInsights: [],
    confidence: 85,
    timestamp: new Date().toISOString()
  }
  
  // Analyze signal levels
  const signalAnalysis = analyzeSignalLevels(data.inputLevels, data.outputLevels)
  analysis.performanceMetrics.signalQuality = signalAnalysis.qualityScore
  analysis.audioPatterns.push(...signalAnalysis.patterns)
  analysis.configurationIssues.push(...signalAnalysis.issues)
  
  // Analyze network performance
  if (data.networkLatency > 50) {
    analysis.performanceMetrics.networkStability = 50
    analysis.hardwareRecommendations.push('High network latency detected - check network infrastructure')
    analysis.severity = 'moderate'
  } else if (data.networkLatency > 20) {
    analysis.performanceMetrics.networkStability = 75
    analysis.audioInsights.push('Moderate network latency - monitor for stability')
  } else if (data.networkLatency > 10) {
    analysis.performanceMetrics.networkStability = 90
  }
  
  // Check processor status
  if (processor.status !== 'online') {
    analysis.severity = 'critical'
    analysis.hardwareRecommendations.push('Processor is offline - check power and network connectivity')
    analysis.performanceMetrics.networkStability = 0
  }
  
  // Check for recent data
  if (data.recentMeterCount === 0) {
    analysis.audioInsights.push('No recent audio meter data - monitoring may not be active')
    analysis.confidence = 50
  }
  
  // Analyze error logs
  if (data.errorLogs.length > 0) {
    analysis.audioPatterns.push(...data.errorLogs)
    analysis.severity = 'moderate'
  }
  
  // Add model-specific insights
  const modelInfo = getModelInfo(processor.model)
  if (modelInfo) {
    analysis.audioInsights.push(
      `Atlas ${processor.model}: ${modelInfo.inputs} inputs, ${modelInfo.outputs} outputs, ${modelInfo.zones} zones`
    )
  }
  
  // Add zone information
  analysis.audioInsights.push(
    `Active zones: ${processor.audioZones.filter((z: any) => z.enabled).length}/${processor.audioZones.length}`
  )
  
  // Add input monitoring status
  if (data.activeInputs > 0) {
    analysis.audioInsights.push(`Monitoring ${data.activeInputs} active inputs`)
  } else {
    analysis.audioInsights.push('No active input monitoring detected')
  }
  
  // Determine overall severity
  if (analysis.performanceMetrics.signalQuality < 60 || 
      analysis.performanceMetrics.networkStability < 50 ||
      processor.status !== 'online') {
    analysis.severity = 'critical'
  } else if (analysis.performanceMetrics.signalQuality < 80 || 
             analysis.performanceMetrics.networkStability < 80) {
    analysis.severity = 'moderate'
  } else if (analysis.performanceMetrics.signalQuality < 95 || 
             analysis.performanceMetrics.networkStability < 95) {
    analysis.severity = 'minor'
  }
  
  // Generate summary
  analysis.summary = generateSummary(analysis, processor)
  
  return analysis
}

/**
 * Analyze signal levels for quality and issues
 */
function analyzeSignalLevels(inputLevels: any, outputLevels: any) {
  const result = {
    qualityScore: 100,
    patterns: [] as string[],
    issues: [] as string[]
  }
  
  // Analyze input levels
  Object.entries(inputLevels).forEach(([inputId, level]) => {
    const levelDb = level as number
    
    if (levelDb > -3) {
      result.issues.push(`Input ${inputId}: Signal too hot (${levelDb.toFixed(1)} dBFS) - risk of clipping`)
      result.qualityScore -= 15
      result.patterns.push(`Input ${inputId} approaching clipping threshold`)
    } else if (levelDb < -35) {
      result.issues.push(`Input ${inputId}: Signal too low (${levelDb.toFixed(1)} dBFS) - increase gain`)
      result.qualityScore -= 10
      result.patterns.push(`Input ${inputId} has low signal level`)
    } else if (levelDb >= -20 && levelDb <= -6) {
      result.patterns.push(`Input ${inputId} at optimal level (${levelDb.toFixed(1)} dBFS)`)
    }
  })
  
  // Analyze output levels
  Object.entries(outputLevels).forEach(([outputId, level]) => {
    const levelDb = level as number
    
    if (levelDb > -6 && levelDb > -90) { // Ignore muted outputs
      result.issues.push(`Output ${outputId}: Risk of clipping (${levelDb.toFixed(1)} dBFS)`)
      result.qualityScore -= 20
      result.patterns.push(`Output ${outputId} approaching maximum level`)
    }
  })
  
  return result
}

/**
 * Get model-specific information
 */
function getModelInfo(model: string) {
  const models: { [key: string]: any } = {
    'AZM4': { inputs: 4, outputs: 4, zones: 4, dante: 8 },
    'AZM8': { inputs: 8, outputs: 8, zones: 8, dante: 16 },
    'AZMP4': { inputs: 4, outputs: 4, zones: 4, dante: 8 },
    'AZMP8': { inputs: 8, outputs: 8, zones: 8, dante: 16 },
    'Atmosphere': { inputs: 12, outputs: 8, zones: 12, dante: 32 }
  }
  
  return models[model] || null
}

/**
 * Generate human-readable summary
 */
function generateSummary(analysis: any, processor: any) {
  const metrics = analysis.performanceMetrics
  
  if (processor.status !== 'online') {
    return `CRITICAL: ${processor.name} is offline - check connectivity`
  }
  
  if (analysis.severity === 'optimal') {
    return `${processor.name} operating optimally. Signal quality: ${metrics.signalQuality.toFixed(0)}%, Network: ${metrics.networkStability.toFixed(0)}%`
  } else if (analysis.severity === 'minor') {
    return `${processor.name} stable with minor issues. Monitor signal levels and network performance.`
  } else if (analysis.severity === 'moderate') {
    return `${processor.name} requires attention. Signal quality: ${metrics.signalQuality.toFixed(0)}%, Network: ${metrics.networkStability.toFixed(0)}%`
  } else {
    return `CRITICAL: ${processor.name} has serious issues. Immediate attention required.`
  }
}

/**
 * Generate summary from historical data
 */
function generateHistoricalSummary(data: any[]) {
  if (!data.length) {
    return {
      message: 'No historical data available',
      trend: 'unknown',
      averageLevel: 0,
      clippingEvents: 0
    }
  }
  
  const avgLevel = data.reduce((sum, d) => sum + d.level, 0) / data.length
  const clippingEvents = data.filter(d => d.clipping).length
  const peakLevel = Math.max(...data.map(d => d.peak))
  
  return {
    message: `Analyzed ${data.length} data points`,
    averageLevel: avgLevel.toFixed(2),
    peakLevel: peakLevel.toFixed(2),
    clippingEvents,
    trend: clippingEvents > 0 ? 'issues_detected' : 'stable',
    recommendations: clippingEvents > 0 
      ? ['Reduce input gain to prevent clipping']
      : ['Audio levels within acceptable range']
  }
}
