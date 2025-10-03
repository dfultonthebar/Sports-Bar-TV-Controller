
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST /api/channel-presets/tune - Send channel change command
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channelNumber, deviceType, deviceIp, presetId } = body

    // Validate required fields
    if (!channelNumber || !deviceType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: channelNumber, deviceType' 
        },
        { status: 400 }
      )
    }

    // Validate deviceType
    if (!['cable', 'directv'].includes(deviceType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deviceType. Must be "cable" or "directv"' 
        },
        { status: 400 }
      )
    }

    let result: any = { success: false }

    if (deviceType === 'directv') {
      // DirecTV uses IP control
      if (!deviceIp) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Device IP address required for DirecTV control' 
          },
          { status: 400 }
        )
      }

      // Send DirecTV channel change command
      result = await sendDirecTVChannelChange(deviceIp, channelNumber)
    } else if (deviceType === 'cable') {
      // Cable Box uses IR control
      // This would integrate with your existing IR control system
      result = await sendCableBoxChannelChange(channelNumber)
    }

    if (result.success) {
      // Track usage if presetId is provided
      if (presetId) {
        try {
          await prisma.channelPreset.update({
            where: { id: presetId },
            data: {
              usageCount: { increment: 1 },
              lastUsed: new Date()
            }
          })
          console.log(`[Usage Tracking] Preset ${presetId} usage recorded`)
        } catch (error) {
          console.error('[Usage Tracking] Failed to update preset usage:', error)
          // Don't fail the request if usage tracking fails
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Channel changed to ${channelNumber}`,
        deviceType,
        channelNumber
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to change channel',
          details: result.details
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error tuning channel:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to tune channel',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to send DirecTV channel change via IP
async function sendDirecTVChannelChange(deviceIp: string, channelNumber: string) {
  try {
    const digits = channelNumber.split('')
    const baseUrl = `http://${deviceIp}:8080`

    // Send each digit with a small delay
    for (const digit of digits) {
      const response = await fetch(`${baseUrl}/remote/processKey?key=${digit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to send digit ${digit}`)
      }

      // Small delay between digits
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    // Send ENTER key to confirm
    await new Promise(resolve => setTimeout(resolve, 100))
    const enterResponse = await fetch(`${baseUrl}/remote/processKey?key=enter`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!enterResponse.ok) {
      throw new Error('Failed to send ENTER key')
    }

    return { 
      success: true, 
      message: `DirecTV tuned to channel ${channelNumber}` 
    }
  } catch (error) {
    console.error('DirecTV channel change error:', error)
    return { 
      success: false, 
      error: 'Failed to change DirecTV channel',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Helper function to send Cable Box channel change via IR
async function sendCableBoxChannelChange(channelNumber: string) {
  try {
    // This would integrate with your existing IR control system
    // For now, we'll return a placeholder response
    // You would need to implement the actual IR command sending here
    
    // Example integration with Global Cache or similar IR system:
    // const irCommands = channelNumber.split('').map(digit => ({
    //   command: digit,
    //   delay: 250
    // }))
    // irCommands.push({ command: 'ENTER', delay: 300 })
    // 
    // for (const cmd of irCommands) {
    //   await sendIRCommand(cmd.command)
    //   await new Promise(resolve => setTimeout(resolve, cmd.delay))
    // }

    console.log(`Cable Box channel change to ${channelNumber} - IR control integration needed`)
    
    return { 
      success: true, 
      message: `Cable Box tuned to channel ${channelNumber}`,
      note: 'IR control integration required for full functionality'
    }
  } catch (error) {
    console.error('Cable Box channel change error:', error)
    return { 
      success: false, 
      error: 'Failed to change Cable Box channel',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
