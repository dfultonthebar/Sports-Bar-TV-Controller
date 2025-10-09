
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { input, output } = await request.json()

    // Validate input parameters
    if (!input || !output || input < 1 || output < 1 || input > 32 || output > 32) {
      return NextResponse.json(
        { error: 'Invalid input or output channel' },
        { status: 400 }
      )
    }

    // Get active matrix configuration
    const activeConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true, connectionStatus: 'connected' }
    })

    if (!activeConfig) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Here you would implement the actual Wolf Pack communication
    // For now, we'll simulate the routing and store it in the database
    
    // Store/update the route in the database
    // First try to find existing route for this output
    const existingRoute = await prisma.matrixRoute.findFirst({
      where: { outputNum: output }
    })

    if (existingRoute) {
      // Update existing route
      await prisma.matrixRoute.update({
        where: { id: existingRoute.id },
        data: {
          inputNum: input,
          isActive: true
        }
      })
    } else {
      // Create new route
      await prisma.matrixRoute.create({
        data: {
          inputNum: input,
          outputNum: output,
          isActive: true
        }
      })
    }

    // Send actual Wolf Pack command using correct format: YXZ.
    const wolfPackCommand = `${input}X${output}.`
    const commandSuccess = await sendWolfPackCommand(
      activeConfig.ipAddress, 
      activeConfig.protocol === 'UDP' ? (activeConfig.udpPort || 4000) : (activeConfig.tcpPort || 5000),
      wolfPackCommand,
      activeConfig.protocol || 'TCP'
    )

    if (!commandSuccess) {
      return NextResponse.json({ 
        error: `Failed to send Wolf Pack command: ${wolfPackCommand}`,
        success: false
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully routed input ${input} to output ${output}`,
      command: wolfPackCommand,
      route: { input, output }
    })

  } catch (error) {
    console.error('Error routing signal:', error)
    return NextResponse.json(
      { error: 'Failed to route signal' },
      { status: 500 }
    )
  }
}

// Wolf Pack TCP/UDP Communication Implementation
async function sendWolfPackCommand(ipAddress: string, port: number, command: string, protocol: string = 'TCP'): Promise<boolean> {
  console.log(`Sending Wolf Pack command: ${command} to ${ipAddress}:${port} via ${protocol}`)
  
  if (protocol.toLowerCase() === 'udp') {
    return await sendUDPCommand(ipAddress, port, command)
  } else {
    return await sendTCPCommand(ipAddress, port, command)
  }
}

// TCP Communication with Wolf Pack
async function sendTCPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  const net = require('net')
  
  return new Promise((resolve, reject) => {
    let responseReceived = false
    let response = ''
    
    const client = net.createConnection({ port, host: ipAddress }, () => {
      console.log(`TCP Connected to Wolf Pack at ${ipAddress}:${port}`)
      // Add \r\n for proper Telnet/TCP protocol
      const commandWithLineEnding = command + '\r\n'
      console.log(`Sending command: "${command}" (with \\r\\n)`)
      client.write(commandWithLineEnding)
    })
    
    client.setTimeout(10000) // 10 second timeout (increased from 5s)
    
    client.on('data', (data) => {
      response += data.toString()
      console.log(`Wolf Pack TCP response: ${response}`)
      
      // Check for response completion
      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        responseReceived = true
        client.end()
        
        // Wolf Pack returns "OK" for success, "ERR" for failure
        if (response.includes('OK')) {
          resolve(true)
        } else {
          console.error(`Wolf Pack command failed: ${response}`)
          resolve(false)
        }
      }
    })
    
    client.on('timeout', () => {
      console.error(`TCP connection timeout. Response so far: "${response}"`)
      client.destroy()
      resolve(false)
    })
    
    client.on('error', (err) => {
      console.error('TCP connection error:', err.message)
      resolve(false)
    })
    
    client.on('close', () => {
      if (!responseReceived && response.length > 0) {
        console.log(`Connection closed. Response received: "${response}"`)
        // If we got some response but no explicit OK/ERR, consider it based on content
        resolve(response.length > 0)
      }
    })
  })
}

// UDP Communication with Wolf Pack
async function sendUDPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  const dgram = require('dgram')
  
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4')
    
    // Add \r\n for proper protocol
    const commandWithLineEnding = command + '\r\n'
    const message = Buffer.from(commandWithLineEnding)
    
    client.send(message, port, ipAddress, (err) => {
      if (err) {
        console.error('UDP send error:', err.message)
        client.close()
        resolve(false)
        return
      }
      
      console.log(`UDP command sent to Wolf Pack at ${ipAddress}:${port}: ${command}`)
    })
    
    // Listen for response
    client.on('message', (data, rinfo) => {
      const response = data.toString().trim()
      console.log(`Wolf Pack UDP response from ${rinfo.address}:${rinfo.port}: ${response}`)
      
      client.close()
      
      // Wolf Pack returns "OK" for success, "ERR" for failure
      if (response.includes('OK')) {
        resolve(true)
      } else {
        console.error(`Wolf Pack command failed: ${response}`)
        resolve(false)
      }
    })
    
    client.on('error', (err) => {
      console.error('UDP error:', err.message)
      client.close()
      resolve(false)
    })
    
    // Timeout after 5 seconds
    setTimeout(() => {
      console.error('UDP response timeout')
      client.close()
      resolve(false)
    }, 5000)
  })
}
