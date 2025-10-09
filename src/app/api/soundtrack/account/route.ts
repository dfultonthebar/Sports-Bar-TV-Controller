
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get API key from config
    const config = await prisma.soundtrackConfig.findFirst()
    
    if (!config || !config.apiKey) {
      return NextResponse.json(
        { success: false, error: 'Soundtrack Your Brand API key not configured' },
        { status: 404 }
      )
    }

    const api = getSoundtrackAPI(config.apiKey)
    const account = await api.getAccount()
    return NextResponse.json({ success: true, account })
  } catch (error: any) {
    console.error('Soundtrack account error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
}
