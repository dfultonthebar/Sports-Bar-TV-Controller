

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { logDatabaseOperation } from '@/lib/database-logger'

const prisma = new PrismaClient()

/**
 * POST /api/ir/commands
 * Create a new IR command
 */
export async function POST(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('➕ [IR COMMANDS] Creating new command')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const {
      deviceId,
      functionName,
      irCode,
      hexCode,
      codeSetId,
      category,
      description
    } = body

    if (!deviceId || !functionName || !irCode) {
      console.log('❌ [IR COMMANDS] Missing required fields')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Device ID, function name, and IR code are required' },
        { status: 400 }
      )
    }

    console.log('   Device ID:', deviceId)
    console.log('   Function:', functionName)
    console.log('   Category:', category || 'N/A')

    const command = await prisma.iRCommand.create({
      data: {
        deviceId,
        functionName,
        irCode,
        hexCode,
        codeSetId,
        category,
        description
      }
    })

    console.log('✅ [IR COMMANDS] Command created successfully')
    console.log('   ID:', command.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_COMMANDS', 'create', {
      commandId: command.id,
      deviceId: command.deviceId,
      functionName: command.functionName
    })

    return NextResponse.json({
      success: true,
      command
    })
  } catch (error: any) {
    console.error('❌ [IR COMMANDS] Error creating command:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_COMMANDS', 'create_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ir/commands?id=xxx
 * Delete an IR command
 */
export async function DELETE(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🗑️  [IR COMMANDS] Deleting command')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { searchParams } = new URL(request.url)
    const commandId = searchParams.get('id')

    if (!commandId) {
      console.log('❌ [IR COMMANDS] Command ID is required')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Command ID is required' },
        { status: 400 }
      )
    }

    console.log('   ID:', commandId)

    await prisma.iRCommand.delete({
      where: { id: commandId }
    })

    console.log('✅ [IR COMMANDS] Command deleted successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_COMMANDS', 'delete', {
      commandId
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [IR COMMANDS] Error deleting command:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_COMMANDS', 'delete_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
