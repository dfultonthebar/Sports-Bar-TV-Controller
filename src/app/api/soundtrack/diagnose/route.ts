

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { SoundtrackYourBrandAPI } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const config = await prisma.soundtrackConfig.findFirst()
    
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
    console.error('Soundtrack diagnostic error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  } finally {
  }
}

