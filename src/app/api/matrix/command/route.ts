import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'

export async function POST(request: NextRequest) {
  // QUICK WIN 3: Apply rate limiting to prevent hardware command flooding
  const rateLimitCheck = await withRateLimit(request, 'HARDWARE')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  try {
    const { command, ipAddress, port, protocol = 'TCP' } = await request.json()

    if (!command || !ipAddress || !port) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command, IP address, and port are required' 
      })
    }

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
    console.error('Error sending matrix command:', error)
    const jsonResponse = NextResponse.json({
      success: false,
      error: 'Failed to send command: ' + error
    }, { status: 500 })
    return addRateLimitHeaders(jsonResponse, rateLimitCheck.result)
  }
}
