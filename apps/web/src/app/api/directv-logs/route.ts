/**
 * DirecTV Logs API
 * Provides access to DirecTV operation logs for analysis and debugging
 */

import { NextRequest, NextResponse } from 'next/server'
import { direcTVLogger } from '@/lib/directv-logger'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    
    const action = searchParams.get('action') || 'recent'
    const limit = parseInt(searchParams.get('limit') || '100')
    const deviceId = searchParams.get('deviceId')
    const ipAddress = searchParams.get('ipAddress')
    
    let logs = []
    let metadata: Record<string, string | number> = {
      logDirectory: direcTVLogger.getLogDirectory(),
      logFilePath: direcTVLogger.getLogFilePath(),
      action,
      limit
    }
    
    switch (action) {
      case 'recent':
        logs = await direcTVLogger.getRecentLogs(limit)
        break
        
      case 'device':
        if (!deviceId) {
          return NextResponse.json(
            { error: 'deviceId parameter required for device logs' },
            { status: 400 }
          )
        }
        logs = await direcTVLogger.getLogsByDevice(deviceId, limit)
        metadata = { ...metadata, deviceId }
        break
        
      case 'ip':
        if (!ipAddress) {
          return NextResponse.json(
            { error: 'ipAddress parameter required for IP logs' },
            { status: 400 }
          )
        }
        logs = await direcTVLogger.getLogsByIpAddress(ipAddress, limit)
        metadata = { ...metadata, ipAddress }
        break
        
      case 'errors':
        logs = await direcTVLogger.getErrorLogs(limit)
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid actions: recent, device, ip, errors' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      metadata
    })
    
  } catch (error) {
    logger.error('Error retrieving DirecTV logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
