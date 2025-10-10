
import { NextResponse } from 'next/server'
import { runStartupTasks } from '@/lib/startup-init'

/**
 * POST - Run startup initialization tasks
 * This endpoint should be called when the application starts
 */
export async function POST() {
  try {
    console.log('Running startup initialization...')
    await runStartupTasks()
    
    return NextResponse.json({
      success: true,
      message: 'Startup tasks completed successfully'
    })
  } catch (error) {
    console.error('Error during startup:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

/**
 * GET - Check if startup has been run
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Startup endpoint is available'
  })
}
