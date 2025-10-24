
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'


export async function GET() {
  try {
    // Get the active matrix configuration
    const activeConfig = await prisma.matrixConfiguration.findFirst({
      where: {
        isActive: true
      },
      include: {
        outputs: {
          where: {
            status: 'active'
          },
          orderBy: {
            channelNumber: 'asc'
          }
        }
      }
    })

    if (!activeConfig) {
      return NextResponse.json({
        success: false,
        message: 'No active matrix configuration found'
      }, { status: 404 })
    }

    // Get outputs with daily turn-on/off settings
    const dailyTurnOnOutputs = activeConfig.outputs.filter(o => o.dailyTurnOn)
    const dailyTurnOffOutputs = activeConfig.outputs.filter(o => o.dailyTurnOff)
    const availableOutputs = activeConfig.outputs.filter(o => !o.dailyTurnOn && !o.dailyTurnOff)

    return NextResponse.json({
      success: true,
      outputs: activeConfig.outputs,
      dailyTurnOnOutputs,
      dailyTurnOffOutputs,
      availableOutputs,
      configName: activeConfig.name
    })
  } catch (error: any) {
    logger.error('Error fetching outputs for schedule:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch outputs'
    }, { status: 500 })
  }
}

// Update an output's daily turn-on/off settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { outputId, dailyTurnOn, dailyTurnOff } = body

    if (!outputId) {
      return NextResponse.json({
        success: false,
        message: 'Output ID is required'
      }, { status: 400 })
    }

    const updated = await prisma.matrixOutput.update({
      where: { id: outputId },
      data: {
        dailyTurnOn: dailyTurnOn !== undefined ? dailyTurnOn : undefined,
        dailyTurnOff: dailyTurnOff !== undefined ? dailyTurnOff : undefined
      }
    })

    return NextResponse.json({
      success: true,
      output: updated
    })
  } catch (error: any) {
    logger.error('Error updating output schedule settings:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update output'
    }, { status: 500 })
  }
}
