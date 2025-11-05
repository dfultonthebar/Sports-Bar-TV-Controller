
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import * as net from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

interface MatrixSwitchRequest {
  input: number
  output?: number
  userId?: string
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data } = bodyValidation

  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || 'unknown'

  // Security: use validated data
  const { input, output = 1, userId } = data as MatrixSwitchRequest

  try {

    // Log the request
    await enhancedLogger.info(
      'api',
      'matrix-switch-api',
      'switch_input_request',
      `Matrix input switch request: Input ${input} to Output ${output}`,
      {
        input,
        output,
        userId,
        requestId,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || 'localhost'
      }
    )

    // Validate input
    if (!input || input < 1 || input > 8) {
      await enhancedLogger.error(
        'api',
        'matrix-switch-api',
        'invalid_input',
        'Invalid matrix input number provided',
        { input, output, userId, requestId }
      )
      
      return NextResponse.json(
        { error: 'Input must be between 1 and 8' },
        { status: 400 }
      )
    }

    // Validate output
    if (output < 1 || output > 4) {
      await enhancedLogger.error(
        'api',
        'matrix-switch-api',
        'invalid_output',
        'Invalid matrix output number provided',
        { input, output, userId, requestId }
      )
      
      return NextResponse.json(
        { error: 'Output must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get Wolf Pack configuration
    const wolfPackHost = process.env.WOLFPACK_HOST || '192.168.1.100'
    const wolfPackPort = parseInt(process.env.WOLFPACK_PORT || '23')

    await enhancedLogger.info(
      'hardware',
      'wolf-pack-matrix',
      'connection_attempt',
      'Attempting to connect to Wolf Pack matrix',
      {
        host: wolfPackHost,
        port: wolfPackPort,
        input,
        output,
        requestId
      }
    )

    // Connect to Wolf Pack matrix
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const client = new net.Socket()
      let commandSent = false
      const connectionTimeout = setTimeout(() => {
        client.destroy()
        reject(new Error('Connection timeout'))
      }, 5000)

      client.connect(wolfPackPort, wolfPackHost, () => {
        clearTimeout(connectionTimeout)
        
        // Send switch command
        const command = `#SW I${input.toString().padStart(2, '0')} O${output.toString().padStart(2, '0')}\r\n`
        client.write(command)
        commandSent = true

        enhancedLogger.info(
          'hardware',
          'wolf-pack-matrix',
          'command_sent',
          'Matrix switch command sent successfully',
          {
            command: command.trim(),
            input,
            output,
            requestId
          }
        )
      })

      client.on('data', (data) => {
        const response = data.toString().trim()
        
        enhancedLogger.info(
          'hardware',
          'wolf-pack-matrix',
          'command_response',
          'Received response from Wolf Pack matrix',
          {
            response,
            input,
            output,
            requestId
          }
        )

        client.destroy()
        resolve()
      })

      client.on('error', (error) => {
        clearTimeout(connectionTimeout)
        
        enhancedLogger.error(
          'hardware',
          'wolf-pack-matrix',
          'connection_error',
          'Wolf Pack matrix connection error',
          {
            error: error.message,
            host: wolfPackHost,
            port: wolfPackPort,
            input,
            output,
            requestId
          },
          error.stack
        )

        reject(error)
      })

      client.on('close', () => {
        clearTimeout(connectionTimeout)
        if (!commandSent) {
          reject(new Error('Connection closed before command could be sent'))
        }
      })
    })

    // Execute the matrix switch
    await connectionPromise

    const duration = Date.now() - startTime

    // Log successful operation
    await enhancedLogger.logHardwareOperation(
      'wolf_pack',
      'matrix',
      'switch_input',
      true,
      {
        input,
        output,
        host: wolfPackHost,
        port: wolfPackPort,
        userId,
        requestId
      },
      duration
    )

    // Log performance metric
    await enhancedLogger.logPerformanceMetric(
      'matrix_switch',
      duration,
      {
        input,
        output,
        success: true,
        requestId
      }
    )

    // Log configuration change
    await enhancedLogger.logConfigurationChange(
      'wolf_pack_matrix',
      `output_${output}_input`,
      'unknown', // We don't track previous state yet
      input,
      userId
    )

    return NextResponse.json({
      success: true,
      message: `Successfully switched input ${input} to output ${output}`,
      input,
      output,
      duration,
      requestId
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await enhancedLogger.error(
      'api',
      'matrix-switch-api',
      'switch_failed',
      'Matrix input switch failed',
      {
        error: errorMessage,
        duration,
        requestId,
        userAgent: request.headers.get('user-agent')
      },
      error instanceof Error ? error.stack : undefined
    )

    await enhancedLogger.logHardwareOperation(
      'wolf_pack',
      'matrix',
      'switch_input',
      false,
      {
        error: errorMessage,
        duration,
        requestId
      },
      duration
    )

    return NextResponse.json(
      {
        error: 'Failed to switch matrix input',
        details: errorMessage,
        requestId
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

  try {
    await enhancedLogger.info(
      'api',
      'matrix-switch-api',
      'status_check',
      'Matrix status check requested'
    )

    // Return current matrix status (this would be enhanced to read actual status)
    return NextResponse.json({
      status: 'online',
      host: process.env.WOLFPACK_HOST || '192.168.1.100',
      port: parseInt(process.env.WOLFPACK_PORT || '23'),
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    await enhancedLogger.error(
      'api',
      'matrix-switch-api',
      'status_check_failed',
      'Failed to check matrix status',
      { error: error instanceof Error ? error.message : error }
    )

    return NextResponse.json(
      { error: 'Failed to get matrix status' },
      { status: 500 }
    )
  }
}
