import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { n8nConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET - List all n8n connections
export async function GET() {
  try {
    const connections = await db.select().from(n8nConnections)
    
    // Hide API keys in the response for security
    const sanitizedConnections = connections.map(conn => ({
      ...conn,
      apiKey: '***hidden***'
    }))
    
    return NextResponse.json({
      success: true,
      connections: sanitizedConnections
    })
  } catch (error) {
    console.error('[n8n Connections] Error fetching connections:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

// POST - Create a new n8n connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, url, apiKey, isActive = true } = body
    
    if (!name || !url || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Name, URL, and API key are required' },
        { status: 400 }
      )
    }
    
    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }
    
    const [connection] = await db.insert(n8nConnections).values({
      name,
      url,
      apiKey,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    
    return NextResponse.json({
      success: true,
      connection: {
        ...connection,
        apiKey: '***hidden***'
      }
    })
  } catch (error) {
    console.error('[n8n Connections] Error creating connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create connection' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an n8n connection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }
    
    await db.delete(n8nConnections).where(eq(n8nConnections.id, id))
    
    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully'
    })
  } catch (error) {
    console.error('[n8n Connections] Error deleting connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}

// PUT - Update an n8n connection
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { name, url, apiKey, isActive } = body
    
    const updateData: any = { updatedAt: new Date() }
    if (name) updateData.name = name
    if (url) updateData.url = url
    if (apiKey) updateData.apiKey = apiKey
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    
    const [connection] = await db
      .update(n8nConnections)
      .set(updateData)
      .where(eq(n8nConnections.id, id))
      .returning()
    
    return NextResponse.json({
      success: true,
      connection: {
        ...connection,
        apiKey: '***hidden***'
      }
    })
  } catch (error) {
    console.error('[n8n Connections] Error updating connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update connection' },
      { status: 500 }
    )
  }
}
