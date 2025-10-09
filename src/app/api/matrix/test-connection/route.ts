import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import dgram from 'dgram'
import { prisma } from '@/lib/db'


export async function GET() {
  try {
    // Get the active matrix configuration from database
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })

    if (!matrixConfig) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active matrix configuration found' 
      })
    }

    const { ipAddress, tcpPort, protocol } = matrixConfig
    const port = protocol === 'TCP' ? tcpPort : matrixConfig.udpPort

    if (protocol === 'TCP') {
      // Test TCP connection
      const testTcpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const socket = new Socket()
          const timeout = setTimeout(() => {
            socket.destroy()
            resolve(false)
          }, 5000) // 5 second timeout

          socket.connect(port, ipAddress, () => {
            clearTimeout(timeout)
            socket.destroy()
            resolve(true)
          })

          socket.on('error', () => {
            clearTimeout(timeout)
            resolve(false)
          })
        })
      }

      const isConnected = await testTcpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `TCP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString(),
          config: { ipAddress, port, protocol }
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via TCP to ${ipAddress}:${port}`,
          config: { ipAddress, port, protocol }
        })
      }
    } else {
      // Test UDP connection by sending a test command
      const testUdpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          const testMessage = '1?.' // Wolf Pack status query command
          
          const timeout = setTimeout(() => {
            client.close()
            resolve(false)
          }, 5000)

          client.send(testMessage, port, ipAddress, (error) => {
            if (error) {
              clearTimeout(timeout)
              client.close()
              resolve(false)
            } else {
              clearTimeout(timeout)
              client.close()
              resolve(true)
            }
          })
        })
      }

      const isConnected = await testUdpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `UDP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString(),
          config: { ipAddress, port, protocol }
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via UDP to ${ipAddress}:${port}`,
          config: { ipAddress, port, protocol }
        })
      }
    }
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Connection test failed: ' + error
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ipAddress, port, protocol = 'TCP' } = await request.json()

    if (!ipAddress || !port) {
      return NextResponse.json({ 
        success: false, 
        error: 'IP address and port are required' 
      })
    }

    if (protocol === 'TCP') {
      // Test TCP connection
      const testTcpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const socket = new Socket()
          const timeout = setTimeout(() => {
            socket.destroy()
            resolve(false)
          }, 5000) // 5 second timeout

          socket.connect(port, ipAddress, () => {
            clearTimeout(timeout)
            socket.destroy()
            resolve(true)
          })

          socket.on('error', () => {
            clearTimeout(timeout)
            resolve(false)
          })
        })
      }

      const isConnected = await testTcpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `TCP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via TCP to ${ipAddress}:${port}`
        })
      }
    } else {
      // Test UDP connection by sending a test command
      const testUdpConnection = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const client = dgram.createSocket('udp4')
          const testMessage = '1?.' // Wolf Pack status query command
          
          const timeout = setTimeout(() => {
            client.close()
            resolve(false)
          }, 5000)

          client.send(testMessage, port, ipAddress, (error) => {
            if (error) {
              clearTimeout(timeout)
              client.close()
              resolve(false)
            } else {
              clearTimeout(timeout)
              client.close()
              resolve(true)
            }
          })
        })
      }

      const isConnected = await testUdpConnection()
      
      if (isConnected) {
        return NextResponse.json({ 
          success: true, 
          message: `UDP connection successful to ${ipAddress}:${port}`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({ 
          success: false, 
          error: `Unable to connect via UDP to ${ipAddress}:${port}`
        })
      }
    }
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Connection test failed: ' + error
    }, { status: 500 })
  }
}
