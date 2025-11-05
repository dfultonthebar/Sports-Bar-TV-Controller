import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'
import { z } from 'zod'
import { validateRequestBody, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

import { logger } from '@/lib/logger'
// Validation schema for matrix commands
const matrixCommandSchema = z.object({
  command: z.string().min(1).max(200, 'Command must be less than 200 characters'),
  ipAddress: ValidationSchemas.ipAddress,
  port: ValidationSchemas.port,
  protocol: ValidationSchemas.protocol.default('TCP')
})

export async function POST(request: NextRequest) {
  // QUICK WIN 3: Apply rate limiting to prevent hardware command flooding
  const rateLimitCheck = await withRateLimit(request, 'HARDWARE')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  try {
    // Validate request body
    const validation = await validateRequestBody(request, matrixCommandSchema)
    if (isValidationError(validation)) return validation.error

    const { data } = validation

    const { command, ipAddress, port, protocol } = data
    // Ensure command ends with period as per Wolf Pack protocol
    const wolfPackCommand = command.endsWith('.') ? command : command + '.'

    if (protocol === 'TCP') {
      // Send TCP command
      const sendTcpCommand = (): Promise<string> => {
        return new Promise((resolve, reject) => {
          const socket = new Socket()
          let response = ''
          
          const timeout = setTimeout(() => {
            socket.destroy()
            reject(new Error('Command timeout'))
          }, 10000) // 10 second timeout

          socket.connect(port, ipAddress, () => {
            socket.write(wolfPackCommand)
          })

          socket.on('data', (data) => {
            response += data.toString()
            // Wolf Pack responds with "OK" or "ERR"
            if (response.includes('OK') || response.includes('ERR')) {
              clearTimeout(timeout)
              socket.destroy()
              resolve(response.trim())
            }
          })

          socket.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })
      }

      try {
        const response = await sendTcpCommand()
        const isSuccess = response.includes('OK')

        const jsonResponse = NextResponse.json({
          success: isSuccess,
          response,
          command: wolfPackCommand,
          message: isSuccess ? 'Command executed successfully' : 'Command failed',
          timestamp: new Date().toISOString()
        })
        return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
      } catch (error) {
        const jsonResponse = NextResponse.json({
          success: false,
          error: `TCP command failed: ${error}`,
          command: wolfPackCommand
        })
        return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
      }
    } else {
      // Send UDP command
      const sendUdpCommand = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          
          const timeout = setTimeout(() => {
            client.close()
            resolve(false)
          }, 5000)

          client.send(wolfPackCommand, port, ipAddress, (error) => {
            clearTimeout(timeout)
            client.close()
            resolve(!error)
          })
        })
      }

      const success = await sendUdpCommand()

      const jsonResponse = NextResponse.json({
        success,
        command: wolfPackCommand,
        message: success ? 'UDP command sent successfully' : 'UDP command failed',
        timestamp: new Date().toISOString()
      })
      return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
    }
  } catch (error) {
    logger.error('Error sending matrix command:', error)
    const jsonResponse = NextResponse.json({
      success: false,
      error: 'Failed to send command: ' + error
    }, { status: 500 })
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  }
}
