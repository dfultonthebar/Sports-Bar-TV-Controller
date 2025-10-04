
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Socket } from 'net'
import dgram from 'dgram'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { action, outputNumbers, individual = false } = await request.json()
    
    if (!action || !['power_on', 'power_off'].includes(action)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid action. Use "power_on" or "power_off"' 
      }, { status: 400 })
    }

    // Get CEC configuration
    const cecConfig = await prisma.cECConfiguration.findFirst()
    if (!cecConfig || !cecConfig.isEnabled || !cecConfig.cecInputChannel) {
      return NextResponse.json({ 
        success: false, 
        error: 'CEC is not properly configured or enabled' 
      }, { status: 400 })
    }

    // Get active matrix configuration
    const activeMatrix = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })
    
    if (!activeMatrix) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active matrix configuration found' 
      }, { status: 404 })
    }

    // Get active outputs if not specified
    let targetOutputs = outputNumbers
    if (!targetOutputs) {
      const activeOutputs = await prisma.matrixOutput.findMany({
        where: { isActive: true }
      })
      targetOutputs = activeOutputs.map(output => output.channelNumber)
    }

    if (!targetOutputs || targetOutputs.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No target outputs specified or found' 
      }, { status: 400 })
    }

    console.log(`CEC ${action} requested for outputs: ${targetOutputs.join(', ')}`)

    const results: any[] = []
    const errors: any[] = []

    if (individual) {
      // Individual TV control - process each output separately
      for (const outputNum of targetOutputs) {
        try {
          const result = await controlIndividualTV(
            outputNum, 
            action, 
            cecConfig, 
            activeMatrix
          )
          results.push(result)
        } catch (error) {
          console.error(`Error controlling output ${outputNum}:`, error)
          errors.push(`Output ${outputNum}: ${error}`)
        }
      }
    } else {
      // Batch control - switch to CEC input once, then send commands to all TVs
      try {
        const result = await controlAllTVs(
          targetOutputs, 
          action, 
          cecConfig, 
          activeMatrix
        )
        results.push(result)
      } catch (error) {
        console.error('Error in batch TV control:', error)
        errors.push(`Batch control failed: ${error}`)
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined,
      action,
      outputsProcessed: targetOutputs,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in CEC power control:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'CEC power control failed: ' + error 
    }, { status: 500 })
  }
}

// Individual TV control function
async function controlIndividualTV(
  outputNumber: number, 
  action: string, 
  cecConfig: any, 
  matrixConfig: any
): Promise<any> {
  
  console.log(`Starting individual ${action} for output ${outputNumber}`)
  
  // Step 1: Route CEC input to this specific output
  const routeSuccess = await routeInputToOutput(
    cecConfig.cecInputChannel,
    outputNumber,
    matrixConfig
  )
  
  if (!routeSuccess) {
    throw new Error(`Failed to route CEC input to output ${outputNumber}`)
  }

  // Step 2: Wait for switching delay
  await sleep(cecConfig.powerOnDelay || 2000)
  
  // Step 3: Send CEC command to this TV
  const cecSuccess = await sendCECCommand(action, [outputNumber], cecConfig)
  
  if (!cecSuccess) {
    throw new Error(`Failed to send CEC ${action} to output ${outputNumber}`)
  }

  return {
    output: outputNumber,
    action,
    routeSuccess,
    cecSuccess,
    message: `Successfully ${action.replace('_', ' ')} TV on output ${outputNumber}`
  }
}

// Batch TV control function
async function controlAllTVs(
  outputNumbers: number[], 
  action: string, 
  cecConfig: any, 
  matrixConfig: any
): Promise<any> {
  
  console.log(`Starting batch ${action} for outputs: ${outputNumbers.join(', ')}`)
  
  const results: any[] = []
  
  // Route CEC input to each output sequentially
  for (const outputNum of outputNumbers) {
    const routeSuccess = await routeInputToOutput(
      cecConfig.cecInputChannel,
      outputNum,
      matrixConfig
    )
    
    if (routeSuccess) {
      results.push({ output: outputNum, routed: true })
    } else {
      results.push({ output: outputNum, routed: false, error: 'Route failed' })
    }
    
    // Small delay between routes
    await sleep(500)
  }
  
  // Wait for all routes to settle
  await sleep(cecConfig.powerOnDelay || 2000)
  
  // Send CEC command to all TVs
  const cecSuccess = await sendCECCommand(action, outputNumbers, cecConfig)
  
  return {
    action,
    outputs: outputNumbers,
    routeResults: results,
    cecSuccess,
    message: `Batch ${action.replace('_', ' ')} completed for ${outputNumbers.length} TVs`
  }
}

// Route input to output via Wolf Pack
async function routeInputToOutput(
  inputNumber: number, 
  outputNumber: number, 
  matrixConfig: any
): Promise<boolean> {
  
  const command = `${inputNumber}X${outputNumber}.`
  console.log(`Routing Wolf Pack: ${command}`)
  
  try {
    if (matrixConfig.protocol === 'UDP') {
      return await sendUDPCommand(
        matrixConfig.ipAddress,
        matrixConfig.udpPort || 4000,
        command
      )
    } else {
      return await sendTCPCommand(
        matrixConfig.ipAddress,
        matrixConfig.tcpPort || 5000,
        command
      )
    }
  } catch (error) {
    console.error(`Wolf Pack routing error: ${error}`)
    return false
  }
}

// Send CEC command via HTTP to CEC server
async function sendCECCommand(
  action: string, 
  outputNumbers: number[], 
  cecConfig: any
): Promise<boolean> {
  
  const cecCommand = action === 'power_on' ? 'on' : 'standby'
  console.log(`Sending CEC ${cecCommand} command to outputs: ${outputNumbers.join(', ')}`)
  
  try {
    // This assumes a CEC HTTP server/bridge (like cec-web-api or similar)
    const response = await fetch(`http://${cecConfig.cecServerIP}:${cecConfig.cecPort}/api/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: cecCommand,
        targets: outputNumbers.map(num => `${num}`), // CEC addresses as strings
        broadcast: outputNumbers.length > 1
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('CEC command response:', result)
      return true
    } else {
      console.error('CEC command failed:', response.status, response.statusText)
      return false
    }
  } catch (error) {
    console.error('CEC HTTP request failed:', error)
    
    // Fallback: try sending CEC commands via a simple TCP socket if HTTP fails
    return await sendCECCommandTCP(action, outputNumbers, cecConfig)
  }
}

// Fallback CEC command via TCP
async function sendCECCommandTCP(
  action: string, 
  outputNumbers: number[], 
  cecConfig: any
): Promise<boolean> {
  
  return new Promise((resolve) => {
    const socket = new Socket()
    const cecCommand = action === 'power_on' ? 'on' : 'standby'
    
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 5000)

    socket.connect(cecConfig.cecPort, cecConfig.cecServerIP, () => {
      // Send CEC command for each output
      outputNumbers.forEach(outputNum => {
        socket.write(`echo '${cecCommand} ${outputNum}' | cec-client -s -d 1\n`)
      })
    })

    socket.on('data', (data) => {
      const response = data.toString()
      console.log('CEC TCP response:', response)
      clearTimeout(timeout)
      socket.destroy()
      resolve(response.includes('success') || response.includes('OK'))
    })

    socket.on('error', (error) => {
      console.error('CEC TCP error:', error)
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

// TCP command function for Wolf Pack
async function sendTCPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 5000)

    socket.connect(port, ipAddress, () => {
      socket.write(command)
    })

    socket.on('data', (data) => {
      const response = data.toString().trim()
      console.log(`Wolf Pack TCP response: ${response}`)
      clearTimeout(timeout)
      socket.destroy()
      resolve(response === 'OK')
    })

    socket.on('error', (error) => {
      console.error('Wolf Pack TCP error:', error)
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

// UDP command function for Wolf Pack  
async function sendUDPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')
    
    const timeout = setTimeout(() => {
      client.close()
      resolve(false)
    }, 5000)

    client.send(command, port, ipAddress, (error) => {
      if (error) {
        clearTimeout(timeout)
        client.close()
        resolve(false)
        return
      }
      
      console.log(`Wolf Pack UDP command sent: ${command}`)
    })

    client.on('message', (data) => {
      const response = data.toString().trim()
      console.log(`Wolf Pack UDP response: ${response}`)
      clearTimeout(timeout)
      client.close()
      resolve(response === 'OK')
    })

    client.on('error', (error) => {
      console.error('Wolf Pack UDP error:', error)
      clearTimeout(timeout)
      client.close()
      resolve(false)
    })
  })
}

// Utility sleep function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
