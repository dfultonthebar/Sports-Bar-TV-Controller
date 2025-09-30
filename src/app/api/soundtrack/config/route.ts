
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Fetch Soundtrack configuration
export async function GET() {
  try {
    const config = await prisma.soundtrackConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (!config) {
      return NextResponse.json({
        config: {
          apiKey: '',
          isConfigured: false,
          status: 'untested'
        }
      })
    }

    // Mask the API key for security
    const maskedConfig = {
      ...config,
      apiKey: config.apiKey ? '••••••••••••' + config.apiKey.slice(-4) : '',
      isConfigured: !!config.apiKey,
    }

    return NextResponse.json({
      config: maskedConfig,
      accountInfo: config.accountName ? {
        id: config.accountId,
        businessName: config.accountName
      } : null
    })
  } catch (error: any) {
    console.error('Error fetching Soundtrack config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Save Soundtrack configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, accountId, accountName, status } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Delete any existing configs (we only keep one)
    await prisma.soundtrackConfig.deleteMany({})

    // Create new config
    const config = await prisma.soundtrackConfig.create({
      data: {
        apiKey,
        accountId: accountId || null,
        accountName: accountName || null,
        status: status || 'active',
        lastTested: new Date()
      }
    })

    // Mask the API key in response
    const maskedConfig = {
      ...config,
      apiKey: '••••••••••••' + config.apiKey.slice(-4),
      isConfigured: true
    }

    return NextResponse.json({
      success: true,
      config: maskedConfig
    })
  } catch (error: any) {
    console.error('Error saving Soundtrack config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove Soundtrack configuration
export async function DELETE() {
  try {
    await prisma.soundtrackConfig.deleteMany({})

    return NextResponse.json({
      success: true,
      message: 'Configuration removed successfully'
    })
  } catch (error: any) {
    console.error('Error deleting Soundtrack config:', error)
    return NextResponse.json(
      { error: 'Failed to delete configuration', details: error.message },
      { status: 500 }
    )
  }
}
