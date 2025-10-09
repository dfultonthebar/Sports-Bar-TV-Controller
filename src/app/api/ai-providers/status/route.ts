import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'


export async function GET(request: NextRequest) {
  try {
    // Get all AI API keys from the database (these represent AI providers)
    const apiKeys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' }
    })

    // Count active providers (those with API keys configured)
    const activeProviders = apiKeys.filter(k => k.keyValue && k.keyValue.length > 0)
    const totalProviders = apiKeys.length

    // Get provider statistics
    const providerStats = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      provider: key.provider,
      isActive: !!(key.keyValue && key.keyValue.length > 0),
      hasKey: !!(key.keyValue && key.keyValue.length > 0),
      createdAt: key.createdAt,
      updatedAt: key.updatedAt
    }))

    // Calculate overall health
    const overallHealth = activeProviders.length > 0 ? 'healthy' : 'warning'
    const healthScore = totalProviders > 0 
      ? Math.round((activeProviders.length / totalProviders) * 100)
      : 0

    return NextResponse.json({
      success: true,
      active: activeProviders.length,
      total: totalProviders,
      health: overallHealth,
      healthScore,
      providers: providerStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching AI provider status:', error)
    
    // Return a fallback response if database query fails
    return NextResponse.json({
      success: false,
      active: 0,
      total: 0,
      health: 'error',
      healthScore: 0,
      providers: [],
      error: error instanceof Error ? error.message : 'Failed to fetch AI provider status',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, providerId } = body

    switch (action) {
      case 'test_provider':
        return await testProvider(providerId)
      case 'refresh_status':
        return await refreshProviderStatus()
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error handling AI provider action:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to handle action' },
      { status: 500 }
    )
  }
}

async function testProvider(providerId: string) {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: providerId }
    })

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    const hasKey = !!(apiKey.keyValue && apiKey.keyValue.length > 0)

    // Simulate a test request to the provider
    const testResult = {
      providerId: apiKey.id,
      providerName: apiKey.name,
      provider: apiKey.provider,
      isActive: hasKey,
      responseTime: Math.floor(Math.random() * 500) + 100, // Mock response time
      success: hasKey && Math.random() > 0.1, // 90% success rate for active providers
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      testResult
    })

  } catch (error) {
    console.error('Error testing provider:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test provider' },
      { status: 500 }
    )
  }
}

async function refreshProviderStatus() {
  try {
    // Get fresh provider data
    const apiKeys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' }
    })

    const activeCount = apiKeys.filter(k => k.keyValue && k.keyValue.length > 0).length

    return NextResponse.json({
      success: true,
      message: 'Provider status refreshed',
      active: activeCount,
      total: apiKeys.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error refreshing provider status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh status' },
      { status: 500 }
    )
  }
}
