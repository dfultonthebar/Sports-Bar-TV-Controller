
import { NextRequest, NextResponse } from 'next/server'
import { SoundtrackYourBrandAPI } from '@/lib/soundtrack-your-brand'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Use the enhanced testConnection method with fallback patterns
    const api = new SoundtrackYourBrandAPI(apiKey)
    const testResult = await api.testConnection()

    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        error: testResult.message,
        details: testResult.details
      }, { status: 400 })
    }

    // If test succeeded, try to get more account info
    let accountInfo = null
    try {
      const account = await api.getAccount()
      const firstAccount = account.accounts && account.accounts.length > 0 
        ? account.accounts[0] 
        : null
      
      accountInfo = {
        id: firstAccount?.id || account.id || 'unknown',
        name: firstAccount?.name || 'Soundtrack Account',
        accountCount: account.accounts?.length || 0
      }
    } catch (error: any) {
      console.log('Could not fetch detailed account info:', error.message)
      // Don't fail - we still got a successful connection test
    }

    return NextResponse.json({
      success: true,
      message: testResult.message,
      details: testResult.details,
      accountInfo: accountInfo
    })
  } catch (error: any) {
    console.error('Error testing Soundtrack connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Connection test failed' },
      { status: 500 }
    )
  }
}
