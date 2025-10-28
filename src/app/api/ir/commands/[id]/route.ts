import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { deleteRecord } from '@/lib/db-helpers'
import { irCommands } from '@/db/schema'

/**
 * DELETE /api/ir/commands/[id]
 * Delete an IR command
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const commandId = params.id

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🗑️  [IR COMMANDS] Deleting IR command')
  console.log('   Command ID:', commandId)
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    await deleteRecord('irCommands', eq(schema.irCommands.id, commandId))

    console.log('✅ [IR COMMANDS] Command deleted successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      message: 'Command deleted successfully'
    })
  } catch (error) {
    console.error('❌ [IR COMMANDS] Error deleting command:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete command' 
      },
      { status: 500 }
    )
  }
}
