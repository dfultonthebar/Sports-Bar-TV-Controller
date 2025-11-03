

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { audioInputMeters } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // Get all input meters for the processor with current levels
    const inputMeters = await prisma.audioInputMeter.findMany({
      where: { 
        processorId: processorId,
        isActive: true 
      },
      orderBy: { inputNumber: 'asc' },
      select: {
        id: true,
        inputNumber: true,
        parameterName: true,
        inputName: true,
        currentLevel: true,
        peakLevel: true,
        levelPercent: true,
        warningThreshold: true,
        dangerThreshold: true,
        lastUpdate: true,
        isActive: true
      }
    })

    // Add status indicators based on levels
    const metersWithStatus = inputMeters.map(meter => {
      let status = 'normal'
      let statusColor = 'green'
      
      if (meter.currentLevel !== null) {
        if (meter.currentLevel > meter.dangerThreshold) {
          status = 'danger'
          statusColor = 'red'
        } else if (meter.currentLevel > meter.warningThreshold) {
          status = 'warning'
          statusColor = 'yellow'
        }
      }
      
      // Check if data is stale (no updates in 30 seconds)
      const isStale = meter.lastUpdate ? 
        (new Date().getTime() - new Date(meter.lastUpdate).getTime()) > 30000 : 
        true
      
      return {
        ...meter,
        status,
        statusColor,
        isStale,
        isReceiving: !isStale && meter.currentLevel !== null
      }
    })

    return NextResponse.json({ inputMeters: metersWithStatus })
  } catch (error) {
    console.error('Error fetching meter status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meter status' },
      { status: 500 }
    )
  }
}

// Reset peak levels for all meters
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { processorId } = await request.json()

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    await prisma.audioInputMeter.updateMany({
      where: { processorId },
      data: { peakLevel: -80.0 } // Reset to minimum
    })

    return NextResponse.json({ success: true, message: 'Peak levels reset' })
  } catch (error) {
    console.error('Error resetting peak levels:', error)
    return NextResponse.json(
      { error: 'Failed to reset peak levels' },
      { status: 500 }
    )
  }
}

