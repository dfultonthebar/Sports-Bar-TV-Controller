
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
    const client = net.createConnection({ port, host: ipAddress }, () => {
      console.log(`TCP Connected to Wolf Pack at ${ipAddress}:${port}`)
      client.write(command) // Wolf Pack expects commands without \r\n
    })
    
    client.setTimeout(5000) // 5 second timeout
    
    client.on('data', (data) => {
      const response = data.toString().trim()
      console.log(`Wolf Pack TCP response: ${response}`)
      
      client.end()
      
      // Wolf Pack returns "OK" for success, "ERR" for failure
      if (response === 'OK') {
        resolve(true)
      } else {
        console.error(`Wolf Pack command failed: ${response}`)
        resolve(false)
      }
    })
    
    client.on('timeout', () => {
      console.error('TCP connection timeout')
      client.destroy()
      resolve(false)
    })
    
    client.on('error', (err) => {
      console.error('TCP connection error:', err.message)
      resolve(false)
    })
  })
}

// UDP Communication with Wolf Pack
async function sendUDPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  const dgram = require('dgram')
  
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4')
    
    const message = Buffer.from(command)
    
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
      if (response === 'OK') {
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
