
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'
import { encrypt, decrypt } from '../../../lib/encryption'

export async function GET() {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        // Don't return the actual key value for security
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ apiKeys })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, provider, keyValue, description } = await request.json()

    if (!name || !provider || !keyValue) {
      return NextResponse.json(
        { error: 'Name, provider, and key value are required' }, 
        { status: 400 }
      )
    }

    // Encrypt the API key before storing
    const encryptedKey = encrypt(keyValue)

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        provider,
        keyValue: encryptedKey,
        description,
      },
    })

    // Return without the actual key value
    const { keyValue: _, ...safeApiKey } = apiKey
    return NextResponse.json({ apiKey: safeApiKey })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' }, 
      { status: 500 }
    )
  }
}
