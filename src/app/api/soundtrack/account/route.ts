
import { NextRequest, NextResponse } from 'next/server'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'

export async function GET(request: NextRequest) {
  try {
    const api = getSoundtrackAPI()
    const account = await api.getAccount()
    return NextResponse.json({ success: true, account })
  } catch (error: any) {
    console.error('Soundtrack account error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
