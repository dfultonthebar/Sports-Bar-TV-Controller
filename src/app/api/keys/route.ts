
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { encrypt, decrypt } from '../../../../lib/encryption'

// GET - List all API keys
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
    })

    return NextResponse.json({ success: true, data: apiKeys })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const { name, provider, keyValue, description } = await request.json()

    if (!name || !provider || !keyValue) {
      return NextResponse.json(
        { success: false, error: 'Name, provider, and key value are required' },
        { status: 400 }
      )
    }

    // Encrypt the API key
    const encryptedKey = encrypt(keyValue)

    // Create the API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        provider,
        keyValue: encryptedKey,
        description: description || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      data: apiKey,
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

// PUT - Update API key
export async function PUT(request: NextRequest) {
  try {
    const { id, name, provider, keyValue, description, isActive } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (name) updateData.name = name
    if (provider) updateData.provider = provider
    if (keyValue) updateData.keyValue = encrypt(keyValue)
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully',
      data: apiKey,
    })
  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

// DELETE - Delete API key
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      )
    }

    await prisma.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
