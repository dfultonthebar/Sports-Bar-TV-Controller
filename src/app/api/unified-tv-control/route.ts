
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, findMany, findUnique, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { UnifiedTVControl, TVDevice } from '@/lib/unified-tv-control'
import { CECCommand } from '@/lib/enhanced-cec-commands'


export async function POST(request: NextRequest) {
  try {
    const { 
      deviceId, 
      deviceIds, 
      command, 
      forceMethod, 
      sequential,
      delayBetween 
    } = await request.json()
    
    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command is required' 
      }, { status: 400 })
    }

    // Get CEC configuration
    const cecConfig = await findFirst('cecConfigurations')
    if (!cecConfig || !cecConfig.isEnabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'CEC is not enabled' 
      }, { status: 400 })
    }

    // Get matrix configuration
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true }
    })
    
    if (!matrixConfig) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active matrix configuration found' 
      }, { status: 404 })
    }

    // Initialize unified control
    const controller = new UnifiedTVControl({
      cecServerIP: cecConfig.cecServerIP,
      cecServerPort: cecConfig.cecPort,
      cecInputChannel: cecConfig.cecInputChannel || 12,
      matrixIP: matrixConfig.ipAddress,
      matrixPort: matrixConfig.udpPort || 4000,
      matrixProtocol: matrixConfig.protocol as 'TCP' | 'UDP'
    })

    // Handle single device control
    if (deviceId) {
      const output = await prisma.matrixOutput.findUnique({
        where: { id: deviceId }
      })

      if (!output) {
        return NextResponse.json({ 
          success: false, 
          error: 'Device not found' 
        }, { status: 404 })
      }

      const tvDevice: TVDevice = {
        id: output.id,
        name: output.label || `TV ${output.channelNumber}`,
        brand: 'Generic', // Add brand field to your MatrixOutput model
        outputNumber: output.channelNumber,
        supportsCEC: true,
        supportsIR: false, // Check if device has IR config
        preferredMethod: 'AUTO'
      }

      const result = await controller.controlTV(tvDevice, command as CECCommand, {
        forceMethod
      })

      return NextResponse.json({
        success: result.success,
        result,
        device: tvDevice,
        timestamp: new Date().toISOString()
      })
    }

    // Handle multiple device control
    if (deviceIds && Array.isArray(deviceIds)) {
      const outputs = await prisma.matrixOutput.findMany({
        where: { 
          id: { in: deviceIds },
          isActive: true 
        }
      })

      const tvDevices: TVDevice[] = outputs.map(output => ({
        id: output.id,
        name: output.label || `TV ${output.channelNumber}`,
        brand: 'Generic',
        outputNumber: output.channelNumber,
        supportsCEC: true,
        supportsIR: false,
        preferredMethod: 'AUTO'
      }))

      const results = await controller.controlMultipleTVs(
        tvDevices, 
        command as CECCommand, 
        {
          sequential,
          delayBetween
        }
      )

      return NextResponse.json({
        success: results.every(r => r.success),
        results,
        devicesProcessed: tvDevices.length,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Either deviceId or deviceIds must be provided' 
    }, { status: 400 })

  } catch (error) {
    logger.error('Unified TV control error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
