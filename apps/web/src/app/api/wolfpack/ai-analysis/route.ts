
// Wolfpack Matrix AI Analysis API Route

import { NextRequest, NextResponse } from 'next/server'
import WolfpackMatrixAIAnalyzer from '@/lib/wolfpack-ai-analyzer'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getActiveChassisConfig } from '@/lib/wolfpack/get-active-chassis'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import type { WolfpackMatrixData } from '@sports-bar/wolfpack'

/**
 * Assemble WolfpackMatrixData from the database for a given chassis config.
 */
async function assembleMatrixDataFromDB(chassisId?: string | null): Promise<WolfpackMatrixData | null> {
  const config = await getActiveChassisConfig(chassisId)
  if (!config) return null

  // Get inputs and outputs for this config
  const inputs = await db.select()
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.configId, config.id))
    .orderBy(asc(schema.matrixInputs.channelNumber))
    .all()

  const outputs = await db.select()
    .from(schema.matrixOutputs)
    .where(eq(schema.matrixOutputs.configId, config.id))
    .orderBy(asc(schema.matrixOutputs.channelNumber))
    .all()

  // Get current routes
  const routes = config.chassisId
    ? await db.select().from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.chassisId, config.chassisId))
        .all()
    : await db.select().from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.isActive, true))
        .all()

  return {
    chassisId: config.chassisId || null,
    config: {
      name: config.name,
      ipAddress: config.ipAddress,
      port: config.tcpPort,
      tcpPort: config.tcpPort,
      udpPort: config.udpPort,
      protocol: config.protocol,
      isActive: config.isActive,
      chassisId: config.chassisId || null,
    },
    inputs: inputs.map(i => ({
      channelNumber: i.channelNumber,
      label: i.label,
      inputType: i.inputType,
      deviceType: i.deviceType,
      status: i.status as 'active' | 'unused' | 'no' | 'na',
      isActive: i.isActive,
    })),
    outputs: outputs.map(o => ({
      channelNumber: o.channelNumber,
      label: o.label,
      resolution: o.resolution,
      status: o.status as 'active' | 'unused' | 'no' | 'na',
      audioOutput: o.audioOutput || undefined,
      isActive: o.isActive,
    })),
    routing: routes.map(r => ({
      input: r.inputNum,
      output: r.outputNum,
      timestamp: r.updatedAt || r.createdAt,
      success: r.isActive,
    })),
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { matrixData, chassisId: bodyChassisId } = bodyValidation.data
    const chassisId = (bodyChassisId as string) || request.nextUrl.searchParams.get('chassisId')

    // If matrixData provided, use it directly (backward compat).
    // If chassisId provided (or no matrixData), auto-assemble from DB.
    let resolvedData: WolfpackMatrixData | null
    if (matrixData && typeof matrixData === 'object') {
      resolvedData = matrixData as WolfpackMatrixData
      // Inject chassisId if provided separately
      if (chassisId && !resolvedData.chassisId) {
        resolvedData.chassisId = chassisId
      }
    } else {
      resolvedData = await assembleMatrixDataFromDB(chassisId)
    }

    if (!resolvedData) {
      return NextResponse.json(
        { error: 'No matrix data provided and no active matrix configuration found' },
        { status: 400 }
      )
    }

    const analyzer = new WolfpackMatrixAIAnalyzer()
    const insights = await analyzer.analyzeMatrixSystem(resolvedData)

    return NextResponse.json({
      success: true,
      chassisId: resolvedData.chassisId || null,
      insights,
      analysisTimestamp: new Date().toISOString(),
      systemInfo: {
        analyzer: 'Wolfpack Matrix AI v1.1',
        capabilities: [
          'Connection Analysis',
          'Configuration Review',
          'Routing Optimization',
          'Layout Mapping',
          'Audio Routing Analysis',
          'Performance Monitoring',
          'Channel Utilization',
          'Multi-Chassis Support'
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
  if (!rateLimit.allowed) return rateLimit.response

  return NextResponse.json({
    service: 'Wolfpack Matrix AI Analysis',
    version: '1.1.0',
    capabilities: [
      'Real-time matrix analysis',
      'Configuration optimization',
      'Connection troubleshooting',
      'Routing pattern analysis',
      'Layout integration insights',
      'Audio routing recommendations',
      'Performance monitoring',
      'Channel utilization analysis',
      'Multi-chassis analysis'
    ],
    supportedProtocols: ['TCP', 'UDP', 'HTTP'],
    supportedCommands: [
      'YAll. (Input to all outputs)',
      'All1. (One-to-one mapping)',
      'YXZ. (Input to output)',
      'YXZ&Q&W. (Input to multiple outputs)',
      'SaveY./RecallY. (Scene management)',
      'BeepON./BeepOFF. (Buzzer control)',
      'Y?. (Status query)'
    ],
    usage: {
      withMatrixData: 'POST { matrixData: {...} } — pass pre-assembled data (backward compat)',
      withChassisId: 'POST { chassisId: "wp-graystone-video" } — auto-assembles from DB',
      withQueryParam: 'POST ?chassisId=wp-graystone-video — same as body param',
      withoutParams: 'POST {} — analyzes the primary active matrix',
    }
  })
}
