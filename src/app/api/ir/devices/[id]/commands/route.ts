import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { findMany } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'

/**
 * GET /api/ir/devices/[id]/commands
 * Get all commands for a specific IR device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR COMMANDS] Fetching commands for device')
  console.log('   Device ID:', deviceId)
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const commands = await findMany('irCommands', {
      where: eq(schema.irCommands.deviceId, deviceId),
      orderBy: asc(schema.irCommands.functionName)
    })

    console.log('✅ [IR COMMANDS] Commands fetched successfully')
    console.log('   Count:', commands.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      commands
    })
  } catch (error) {
    console.error('❌ [IR COMMANDS] Error fetching commands:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch commands' 
      },
      { status: 500 }
    )
  }
}
