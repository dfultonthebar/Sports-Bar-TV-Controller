import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { crestronMatrices } from '@/db/schema'
import { logger } from '@sports-bar/logger'
import { v4 as uuidv4 } from 'uuid'

// GET - List all Crestron matrices
export async function GET(request: NextRequest) {
  try {
    const matrices = await db.select().from(crestronMatrices)

    return NextResponse.json({
      success: true,
      matrices: matrices.map(m => ({
        id: m.id,
        name: m.name,
        model: m.model,
        ipAddress: m.ipAddress,
        port: m.port,
        username: m.username,
        description: m.description,
        status: m.status || 'unknown',
        lastSeen: m.lastSeen,
        inputs: m.inputs,
        outputs: m.outputs,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }))
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Failed to fetch matrices:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create a new Crestron matrix
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { name, model, ipAddress, port, username, password, description, inputs, outputs } = body

    if (!name || !model || !ipAddress) {
      return NextResponse.json(
        { success: false, error: 'Name, model, and IP address are required' },
        { status: 400 }
      )
    }

    const id = uuidv4()
    const now = new Date().toISOString()

    await db.insert(crestronMatrices).values({
      id,
      name,
      model,
      ipAddress,
      port: port || 23,
      username: username || null,
      password: password || null,
      description: description || null,
      status: 'unknown',
      inputs: inputs || 8,
      outputs: outputs || 8,
      createdAt: now,
      updatedAt: now
    })

    logger.info(`[CRESTRON API] Created matrix: ${name} (${model}) at ${ipAddress}`)

    return NextResponse.json({
      success: true,
      id,
      message: 'Matrix created successfully'
    })
  } catch (error: any) {
    logger.error('[CRESTRON API] Failed to create matrix:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
