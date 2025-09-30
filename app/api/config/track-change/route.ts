
import { NextRequest, NextResponse } from 'next/server'
import { configChangeTracker } from '@/lib/config-change-tracker'

export async function POST(request: NextRequest) {
  try {
    const { type, file, changes, action = 'modified' } = await request.json()
    
    if (!type || !file) {
      return NextResponse.json({
        success: false,
        error: 'Type and file are required'
      }, { status: 400 })
    }

    const changeEvent = await configChangeTracker.trackConfigChange(
      type,
      file,
      changes,
      action
    )

    return NextResponse.json({
      success: true,
      changeEvent,
      message: 'Configuration change tracked successfully'
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const history = await configChangeTracker.getChangeHistory(
      type as any, 
      limit
    )

    return NextResponse.json({
      success: true,
      history,
      total: history.length
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
