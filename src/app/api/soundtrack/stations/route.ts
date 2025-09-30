
import { NextRequest, NextResponse } from 'next/server'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

export async function GET(request: NextRequest) {
  try {
    const api = getSoundtrackAPI()
    const stations = await api.listStations()
    return NextResponse.json({ success: true, stations })
  } catch (error: any) {
    console.error('Soundtrack stations error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
