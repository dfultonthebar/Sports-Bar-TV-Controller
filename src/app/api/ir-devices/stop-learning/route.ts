
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))

  try {
    const { iTachAddress = '192.168.1.100' } = isValidationError(bodyValidation) ? {} : bodyValidation.data
    
    const net = await import('net')

    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket()
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          socket.destroy()
          resolve(NextResponse.json({ 
            success: false, 
            message: 'Connection timeout' 
          }, { status: 500 }))
        }
      }, 3000)

      socket.connect(4998, iTachAddress, () => {
        logger.info(`Connected to iTach to stop learning at ${iTachAddress}:4998`)
        socket.write('stop_IRL\r')
      })

      socket.on('data', (data: Buffer) => {
        const response = data.toString().trim()
        logger.info('Stop learning response:', { data: response })
        
        if (response.includes('IR Learner Disabled') && !isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.end()
          resolve(NextResponse.json({ 
            success: true, 
            message: 'IR Learning mode disabled',
            learningActive: false
          }))
        }
      })

      socket.on('error', (err: Error) => {
        logger.error('Stop learning connection error:', { data: err })
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: false, 
            message: `Stop learning failed: ${err.message}` 
          }, { status: 500 }))
        }
      })

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: true, 
            message: 'Learning stopped (connection closed)'
          }))
        }
      })
    })

  } catch (error) {
    logger.error('Error stopping IR learning:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Stop learning failed: ${error}` 
    }, { status: 500 })
  }
}
