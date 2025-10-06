
/**
 * API Route: Check AI Assistant Status
 */

import { NextRequest, NextResponse } from 'next/server'
import { ollamaService } from '../../services/ollamaService'

export async function GET(request: NextRequest) {
  try {
    const isOnline = await ollamaService.isAvailable()
    const models = isOnline ? await ollamaService.listModels() : []
    
    return NextResponse.json({
      online: isOnline,
      models,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check status', online: false },
      { status: 500 }
    )
  }
}
