import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/**
 * n8n Webhook Handler
 * 
 * This endpoint receives webhook calls from n8n workflows
 * and executes corresponding actions in the Sports Bar TV Controller
 * 
 * Supported Actions:
 * - control_tv: Control TV power, input, channel
 * - control_audio: Control audio zones, volume, sources
 * - route_wolfpack: Route Wolfpack inputs to Matrix outputs
 * - execute_schedule: Execute a saved schedule
 * - control_atlas: Control Atlas processor settings
 */

interface N8nWebhookPayload {
  action: string
  data: {
    [key: string]: any
  }
  workflowId?: string
  executionId?: string
  metadata?: {
    [key: string]: any
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    logger.api.request('POST', '/api/n8n/webhook')
    
    // Verify n8n webhook signature/token (if configured)
    const authHeader = request.headers.get('authorization')
    const webhookToken = process.env.N8N_WEBHOOK_TOKEN
    
    if (webhookToken && authHeader !== `Bearer ${webhookToken}`) {
      logger.api.response('POST', '/api/n8n/webhook', 401, { error: 'Unauthorized' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const payload: N8nWebhookPayload = await request.json()
    
    logger.debug('n8n webhook payload received', payload)
    
    if (!payload.action) {
      logger.api.response('POST', '/api/n8n/webhook', 400, { error: 'Missing action' })
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }
    
    let result: any = null
    let actionStatus: 'success' | 'failed' | 'error' = 'success'
    let errorMessage: string | null = null
    
    // Route to appropriate handler based on action
    switch (payload.action) {
      case 'control_tv':
        result = await handleTVControl(payload.data)
        break
        
      case 'control_audio':
        result = await handleAudioControl(payload.data)
        break
        
      case 'route_wolfpack':
        result = await handleWolfpackRouting(payload.data)
        break
        
      case 'execute_schedule':
        result = await handleScheduleExecution(payload.data)
        break
        
      case 'control_atlas':
        result = await handleAtlasControl(payload.data)
        break
        
      case 'health_check':
        result = { status: 'healthy', timestamp: new Date().toISOString() }
        break
        
      default:
        actionStatus = 'error'
        errorMessage = `Unknown action: ${payload.action}`
        logger.api.response('POST', '/api/n8n/webhook', 400, { error: errorMessage })
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
    }
    
    if (result && result.error) {
      actionStatus = 'failed'
      errorMessage = result.error
    }
    
    const duration = Date.now() - startTime
    
    // Log the webhook execution
    try {
      await db.insert(schema.n8nWebhookLogs).values({
        action: payload.action,
        workflowId: payload.workflowId || null,
        executionId: payload.executionId || null,
        payload: JSON.stringify(payload),
        response: JSON.stringify(result),
        status: actionStatus,
        errorMessage: errorMessage,
        duration: duration,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null
      })
    } catch (logError) {
      logger.error('Failed to log n8n webhook execution', logError)
    }
    
    logger.api.response('POST', '/api/n8n/webhook', 200, { 
      action: payload.action,
      status: actionStatus,
      duration 
    })
    
    return NextResponse.json({
      success: actionStatus === 'success',
      action: payload.action,
      result,
      duration,
      error: errorMessage
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.api.error('POST', '/api/n8n/webhook', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      },
      { status: 500 }
    )
  }
}

/**
 * Handle TV control actions
 */
async function handleTVControl(data: any) {
  const { outputNumber, action: tvAction, value } = data
  
  if (!outputNumber || !tvAction) {
    return { error: 'outputNumber and action are required' }
  }
  
  logger.debug('n8n TV control', { outputNumber, tvAction, value })
  
  // Call the appropriate TV control API
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/matrix/outputs`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputNumber,
        action: tvAction,
        value
      })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    logger.error('n8n TV control failed', error)
    return { error: 'Failed to control TV', details: error instanceof Error ? error.message : 'Unknown' }
  }
}

/**
 * Handle audio control actions
 */
async function handleAudioControl(data: any) {
  const { zoneNumber, action: audioAction, value } = data
  
  if (!zoneNumber || !audioAction) {
    return { error: 'zoneNumber and action are required' }
  }
  
  logger.debug('n8n audio control', { zoneNumber, audioAction, value })
  
  // Call the appropriate audio control API
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/audio-processor/control`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneNumber,
        action: audioAction,
        value
      })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    logger.error('n8n audio control failed', error)
    return { error: 'Failed to control audio', details: error instanceof Error ? error.message : 'Unknown' }
  }
}

/**
 * Handle Wolfpack routing actions
 */
async function handleWolfpackRouting(data: any) {
  const { wolfpackInputNumber, matrixOutputNumber } = data
  
  if (!wolfpackInputNumber || !matrixOutputNumber) {
    return { error: 'wolfpackInputNumber and matrixOutputNumber are required' }
  }
  
  logger.debug('n8n wolfpack routing', { wolfpackInputNumber, matrixOutputNumber })
  
  // Call the wolfpack routing API
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/wolfpack/route-to-matrix`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wolfpackInputNumber,
        matrixOutputNumber
      })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    logger.error('n8n wolfpack routing failed', error)
    return { error: 'Failed to route wolfpack', details: error instanceof Error ? error.message : 'Unknown' }
  }
}

/**
 * Handle schedule execution actions
 */
async function handleScheduleExecution(data: any) {
  const { scheduleId } = data
  
  if (!scheduleId) {
    return { error: 'scheduleId is required' }
  }
  
  logger.debug('n8n schedule execution', { scheduleId })
  
  // Call the schedule execution API
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/schedules/execute`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId
      })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    logger.error('n8n schedule execution failed', error)
    return { error: 'Failed to execute schedule', details: error instanceof Error ? error.message : 'Unknown' }
  }
}

/**
 * Handle Atlas processor control actions
 */
async function handleAtlasControl(data: any) {
  const { command, parameters } = data
  
  if (!command) {
    return { error: 'command is required' }
  }
  
  logger.debug('n8n atlas control', { command, parameters })
  
  // Call the appropriate Atlas control API
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/atlas/route-matrix-to-zone`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        ...parameters
      })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    logger.error('n8n atlas control failed', error)
    return { error: 'Failed to control atlas', details: error instanceof Error ? error.message : 'Unknown' }
  }
}

// GET endpoint for testing/health check
export async function GET() {
  logger.api.request('GET', '/api/n8n/webhook')
  
  return NextResponse.json({
    message: 'n8n Webhook Endpoint',
    status: 'active',
    supportedActions: [
      'control_tv',
      'control_audio',
      'route_wolfpack',
      'execute_schedule',
      'control_atlas',
      'health_check'
    ],
    documentation: '/docs/n8n-integration'
  })
}
