import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { n8nConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET - List all workflows from n8n instance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }
    
    // Get connection details
    const [connection] = await db
      .select()
      .from(n8nConnections)
      .where(eq(n8nConnections.id, connectionId))
    
    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      )
    }
    
    // Fetch workflows from n8n API
    const response = await fetch(`${connection.url}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': connection.apiKey,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`n8n API returned ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Transform the data to our format
    const workflows = (data.data || []).map((wf: any) => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      tags: wf.tags || [],
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      nodes: wf.nodes?.length || 0
    }))
    
    return NextResponse.json({
      success: true,
      workflows
    })
  } catch (error) {
    console.error('[n8n Workflows] Error fetching workflows:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch workflows' 
      },
      { status: 500 }
    )
  }
}
