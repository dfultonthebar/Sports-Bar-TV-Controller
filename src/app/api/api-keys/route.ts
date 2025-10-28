
import { NextRequest, NextResponse } from 'next/server'
import { findMany, create, desc, eq } from '@/lib/db-helpers'
import { encrypt, decrypt } from '@/lib/encryption'
import { schema } from '@/db'

export async function GET() {
  try {
    const apiKeysList = await findMany('apiKeys', {
      orderBy: desc(schema.apiKeys.createdAt)
    })

    // Filter out keyValue for security
    const safeApiKeys = apiKeysList.map(({ keyValue, ...safe }) => safe)

    return NextResponse.json({ apiKeys: safeApiKeys })
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

    const apiKey = await create('apiKeys', {
      name,
      provider,
      keyValue: encryptedKey,
      description,
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
