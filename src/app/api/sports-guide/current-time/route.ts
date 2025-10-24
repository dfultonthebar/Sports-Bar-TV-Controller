

import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    // Get timezone configuration
    const config = await prisma.sportsGuideConfiguration.findFirst({
      where: { isActive: true }
    })
    
    const timezone = config?.timezone || 'America/New_York'
    
    // Get current date/time in configured timezone
    const now = new Date()
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    
    // Generate next 7 days for scheduling
    const next7Days: any[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(localTime)
      date.setDate(date.getDate() + i)
      next7Days.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 
               date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        fullDate: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        currentTime: {
          utc: now.toISOString(),
          local: localTime.toISOString(),
          timezone: timezone,
          formatted: localTime.toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })
        },
        schedule: {
          next7Days,
          currentDate: localTime.toISOString().split('T')[0],
          currentHour: localTime.getHours(),
          isBusinessHours: localTime.getHours() >= 8 && localTime.getHours() <= 22
        },
        location: {
          city: config?.city,
          state: config?.state,
          zipCode: config?.zipCode
        }
      }
    })
  } catch (error) {
    logger.error('Error getting current time:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get current time' },
      { status: 500 }
    )
  }
}

