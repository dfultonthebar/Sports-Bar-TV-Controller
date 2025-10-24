
import { NextRequest, NextResponse } from 'next/server'
// Converted to Drizzle ORM
import { syncTodosToGitHub } from '@/lib/gitSync'
import { todos } from '@/db/schema'

export const dynamic = 'force-dynamic'

// POST /api/todos/:id/complete - Mark TODO as complete with validation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { productionTested, mergedToMain } = body

    // Validate completion criteria
    if (!productionTested || !mergedToMain) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot mark as complete. Must confirm: 1) Tested on production server, 2) Merged to main branch' 
        },
        { status: 400 }
      )
    }

    const todo = await prisma.todo.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETE',
        completedAt: new Date()
      },
      include: {
        documents: true
      }
    })

    // Sync to GitHub in background
    syncTodosToGitHub(`chore: Complete TODO - ${todo.title}`).catch(err => {
      console.error('GitHub sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      data: todo,
      message: 'Todo marked as complete'
    })
  } catch (error) {
    console.error('Error completing todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to complete todo' },
      { status: 500 }
    )
  }
}
