import { NextResponse, NextRequest } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({ confirm: z.literal(true) }))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    logger.info('🔌 System reboot requested')
    
    // Schedule reboot after a short delay to allow response to be sent
    setTimeout(async () => {
      logger.info('🔌 Initiating system reboot...')
      
      try {
        // Attempt to reboot the system
        // This requires the user to be in sudoers with NOPASSWD for reboot command
        // Add to /etc/sudoers: username ALL=(ALL) NOPASSWD: /sbin/reboot
        await execAsync('sudo reboot')
      } catch (error) {
        logger.error('Failed to execute reboot command:', error)
        // If sudo reboot fails, try alternative methods
        try {
          await execAsync('sudo shutdown -r now')
        } catch (altError) {
          logger.error('Alternative reboot method also failed:', altError)
        }
      }
    }, 1000)

    return NextResponse.json({ 
      success: true,
      message: 'System reboot initiated. Server will be unavailable for 1-2 minutes.',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error initiating reboot:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initiate reboot: ' + error,
      note: 'Reboot requires sudo permissions. Please ensure the user has NOPASSWD sudo access for reboot command.'
    }, { status: 500 })
  }
}
