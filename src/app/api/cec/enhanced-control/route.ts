
import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { CECCommand, getCECCommandMapping } from '@/lib/enhanced-cec-commands'
import { getBrandConfig } from '@/lib/tv-brands-config'


export async function POST(request: NextRequest) {
  try {
    const { command, outputNumber, parameters } = await request.json()
    
    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command is required' 
      }, { status: 400 })
    }

    // Get CEC configuration
    const cecConfig = await prisma.cECConfiguration.findFirst()
    if (!cecConfig || !cecConfig.isEnabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'CEC is not enabled' 
      }, { status: 400 })
    }

    // Get output info to determine brand if available
    let brandConfig = getBrandConfig('Generic')
    if (outputNumber) {
      const output = await prisma.matrixOutput.findFirst({
        where: { channelNumber: outputNumber }
      })
      // Use detected brand from CEC discovery if available
      if (output?.tvBrand) {
        brandConfig = getBrandConfig(output.tvBrand)
        console.log(`[CEC Enhanced Control] Using brand-specific config for ${output.tvBrand}`)
      }
    }

    // Get command mapping
    const commandMapping = getCECCommandMapping(command as CECCommand)
    if (!commandMapping) {
      return NextResponse.json({ 
        success: false, 
        error: `Unknown CEC command: ${command}` 
      }, { status: 400 })
    }

    // Determine delay based on command type
    let delay = 2000
    if (command === 'power_on') {
      delay = brandConfig.cecPowerOnDelay
    } else if (command === 'power_off' || command === 'standby') {
      delay = brandConfig.cecPowerOffDelay
    } else if (['volume_up', 'volume_down', 'mute'].includes(command)) {
      delay = brandConfig.cecVolumeDelay
    } else if (command.includes('source') || command === 'set_stream_path') {
      delay = brandConfig.cecInputSwitchDelay
    }

    // If specific output is targeted, route to it first
    if (outputNumber && cecConfig.cecInputChannel) {
      const routeResponse = await fetch(`${request.nextUrl.origin}/api/matrix/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: cecConfig.cecInputChannel,
          output: outputNumber
        })
      })

      if (!routeResponse.ok) {
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to route matrix to target output' 
        }, { status: 500 })
      }

      // Wait for brand-specific delay
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Send CEC command
    const cecResponse = await fetch(
      `http://${cecConfig.cecServerIP}:${cecConfig.cecPort}/api/command`, 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandMapping.opcode,
          targets: outputNumber ? [`${outputNumber}`] : undefined,
          broadcast: !outputNumber,
          parameters
        })
      }
    )

    if (cecResponse.ok) {
      const result = await cecResponse.json()
      return NextResponse.json({
        success: true,
        command: commandMapping.command,
        opcode: commandMapping.opcode,
        hexCode: commandMapping.hexCode,
        outputNumber,
        delay,
        brandConfig: {
          brand: brandConfig.brand,
          timing: {
            powerOn: brandConfig.cecPowerOnDelay,
            powerOff: brandConfig.cecPowerOffDelay,
            volume: brandConfig.cecVolumeDelay,
            inputSwitch: brandConfig.cecInputSwitchDelay
          }
        },
        result,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: `CEC server returned error: ${cecResponse.statusText}` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Enhanced CEC control error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// GET endpoint to list all available CEC commands
export async function GET() {
  try {
    const { getCECCommandsByCategory } = await import('@/lib/enhanced-cec-commands')
    const commands = getCECCommandsByCategory()
    
    return NextResponse.json({
      success: true,
      commands,
      categories: Object.keys(commands)
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to load CEC commands' 
    }, { status: 500 })
  }
}
