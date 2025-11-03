import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { create } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/ir/commands
 * Create a new IR command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('➕ [IR COMMANDS] Creating new IR command')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { deviceId, functionName, irCode, hexCode, category, description } = body

    if (!deviceId || !functionName || !irCode) {
      console.log('❌ [IR COMMANDS] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Device ID, function name, and IR code are required' },
        { status: 400 }
      )
    }

    console.log('   Device ID:', deviceId)
    console.log('   Function Name:', functionName)
    console.log('   Category:', category || 'N/A')

    // Check if command with this function name already exists for this device
    const existingCommand = await db.select()
      .from(irCommands)
      .where(
        and(
          eq(irCommands.deviceId, deviceId),
          eq(irCommands.functionName, functionName)
        )
      )
      .limit(1)
      .get()

    if (existingCommand) {
      console.log('❌ [IR COMMANDS] Command already exists')
      return NextResponse.json(
        { success: false, error: 'A command with this name already exists for this device' },
        { status: 409 }
      )
    }

    const command = await create('irCommands', {
      deviceId,
      functionName,
      irCode,
      hexCode: hexCode || null,
      category: category || null,
      description: description || null
    })

    console.log('✅ [IR COMMANDS] Command created successfully')
    console.log('   ID:', command.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      command
    })
  } catch (error) {
    console.error('❌ [IR COMMANDS] Error creating command:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create command' 
      },
      { status: 500 }
    )
  }
}
