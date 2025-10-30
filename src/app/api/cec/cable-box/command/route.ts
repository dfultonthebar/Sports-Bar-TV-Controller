/**
 * Cable Box Command API
 *
 * POST /api/cec/cable-box/command
 * Send navigation and control commands to cable boxes
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'
import { SPECTRUM_COMMANDS } from '@/lib/cec-commands'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cableBoxId, command, userControlCode } = body

    // Validate input
    if (!cableBoxId) {
      return NextResponse.json(
        {
          success: false,
          error: 'cableBoxId is required',
        },
        { status: 400 }
      )
    }

    const cecService = CableBoxCECService.getInstance()

    // Handle custom CEC code
    if (userControlCode) {
      const result = await cecService.sendCustomCommand(cableBoxId, userControlCode)
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Command sent successfully`
          : `Failed to send command: ${result.error}`,
        executionTime: result.executionTime,
        error: result.error,
      })
    }

    // Handle named command
    if (!command) {
      return NextResponse.json(
        {
          success: false,
          error: 'command or userControlCode is required',
        },
        { status: 400 }
      )
    }

    // Validate command exists
    if (!(command in SPECTRUM_COMMANDS)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown command: ${command}. Valid commands: ${Object.keys(SPECTRUM_COMMANDS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    console.log(`[API] Sending command '${command}' to cable box ${cableBoxId}`)

    const result = await cecService.sendNavigationCommand(
      cableBoxId,
      command as keyof typeof SPECTRUM_COMMANDS
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Command '${command}' sent successfully`,
        executionTime: result.executionTime,
        command,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || `Failed to send command '${command}'`,
          executionTime: result.executionTime,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API] Error sending cable box command:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send command',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cec/cable-box/command
 * Get list of available commands
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    commands: Object.keys(SPECTRUM_COMMANDS),
    categories: {
      navigation: ['up', 'down', 'left', 'right', 'select', 'menu', 'exit'],
      channel: ['channelUp', 'channelDown', 'lastChannel'],
      guide: ['guide', 'info', 'onDemand'],
      playback: ['play', 'pause', 'rewind', 'fastForward', 'record'],
    },
  })
}
