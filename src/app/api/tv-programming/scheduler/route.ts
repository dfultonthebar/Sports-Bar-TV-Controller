
import { NextRequest, NextResponse } from 'next/server'
import * as cron from 'node-cron'

// This will store our cron job instance
let schedulerJob: cron.ScheduledTask | null = null

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      schedulerRunning: schedulerJob !== null,
      nextUpdate: schedulerJob ? 'Daily at 12:00 AM' : 'Not scheduled',
      lastUpdate: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get scheduler status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'start') {
      // Stop existing scheduler if running
      if (schedulerJob) {
        schedulerJob.stop()
      }
      
      // Create new scheduler - runs daily at 12:00 AM
      schedulerJob = cron.schedule('0 0 * * *', async () => {
        try {
          console.log('Running daily TV programming update...')
          
          // Call our programming update endpoint
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/tv-programming`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('TV programming updated successfully:', data.message)
          } else {
            console.error('Failed to update TV programming')
          }
        } catch (error) {
          console.error('Error in TV programming scheduler:', error)
        }
      })
      
      // Also run immediately for testing
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/tv-programming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const initialUpdate = response.ok ? await response.json() : null
      
      return NextResponse.json({
        message: 'Daily TV programming scheduler started',
        schedule: 'Daily at 12:00 AM',
        initialUpdate: initialUpdate?.message || 'Failed to run initial update'
      })
    }
    
    if (action === 'stop') {
      if (schedulerJob) {
        schedulerJob.stop()
        schedulerJob = null
      }
      
      return NextResponse.json({
        message: 'TV programming scheduler stopped'
      })
    }
    
    if (action === 'run_now') {
      // Manual trigger for testing
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/tv-programming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        return NextResponse.json({
          message: 'Manual programming update completed',
          result: data
        })
      } else {
        throw new Error('Programming update failed')
      }
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in TV programming scheduler:', error)
    return NextResponse.json({ error: 'Scheduler operation failed' }, { status: 500 })
  }
}
