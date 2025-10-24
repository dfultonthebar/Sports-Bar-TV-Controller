

import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { SoundtrackYourBrandAPI } from '@/lib/soundtrack-your-brand'


export async function GET(request: NextRequest) {
  try {
    const config = await findFirst('soundtrackConfigs')
    
    if (!config || !config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No Soundtrack API key configured'
      }, { status: 404 })
    }

    const api = new SoundtrackYourBrandAPI(config.apiKey)
    const result = await api.testConnection()
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: result.details,
      recommendations: result.success ? [] : [
        'Verify your API key is correct and hasn\'t expired',
        'Check if your Soundtrack Your Brand account is active',
        'Visit https://business.soundtrackyourbrand.com/ to manage your account',
        'Contact Soundtrack Your Brand support if the issue persists'
      ]
    })
  } catch (error: any) {
    logger.error('Soundtrack diagnostic error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

