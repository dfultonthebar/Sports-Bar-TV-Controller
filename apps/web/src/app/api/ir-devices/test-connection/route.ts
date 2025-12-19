
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const iTachAddress = searchParams.get('address') || '192.168.1.100'

  try {
    const net = await import('net')
    
    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket()
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          socket.destroy()
          resolve(NextResponse.json({ connected: false, message: 'Connection timeout' }))
        }
      }, 3000)

      socket.connect(4998, iTachAddress, () => {
        logger.info(`Connected to iTach at ${iTachAddress}:4998`)
        socket.write('getversion\r')
      })

      socket.on('data', (data) => {
        const response = data.toString().trim()
        logger.info('iTach version response:', { data: response })
        
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.end()
          resolve(NextResponse.json({ 
            connected: true, 
            message: 'iTach connected successfully',
            version: response
          }))
        }
      })

      socket.on('error', (err) => {
        logger.error('iTach connection error:', { data: err })
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            connected: false, 
            message: `Connection failed: ${err.message}` 
          }))
        }
      })

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            connected: false, 
            message: 'Connection closed unexpectedly' 
          }))
        }
      })
    })

  } catch (error) {
    logger.error('Error testing iTach connection:', error)
    return NextResponse.json({ 
      connected: false, 
      message: `Test failed: ${error}` 
    }, { status: 500 })
  }
}
