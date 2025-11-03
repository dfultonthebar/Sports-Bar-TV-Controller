import { NextResponse, NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({ confirm: z.literal(true) }))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    logger.info('🔄 Software restart requested')
    
    // Schedule restart after a short delay to allow response to be sent
    setTimeout(() => {
      logger.info('🔄 Restarting application...')
      
      // Kill current process and let process manager (like PM2 or systemd) restart it
      // For development, we'll just restart the Next.js process
      process.exit(0)
    }, 1000)

    return NextResponse.json({ 
      success: true,
      message: 'Restart initiated',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error initiating restart:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initiate restart: ' + error 
    }, { status: 500 })
  }
}
