
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { db } from '@/db'
// Converted to Drizzle ORM
import { syncTodosToGitHub } from '@/lib/gitSync'
import { todos } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export const dynamic = 'force-dynamic'

// GET /api/todos/:id - Get single TODO
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    const todo = await prisma.todo.findUnique({
      where: { id },
      include: {
        documents: true
      }
    })

    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: todo
    })
  } catch (error) {
    console.error('Error fetching todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todo' },
      { status: 500 }
    )
  }
}

// PUT /api/todos/:id - Update TODO
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, priority, status, category, tags } = body

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) {
      updateData.status = status
      if (status === 'COMPLETE') {
        updateData.completedAt = new Date()
      }
    }
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = JSON.stringify(tags)

    const todo = await prisma.todo.update({
      where: { id },
      data: updateData,
      include: {
        documents: true
      }
    })

    // Sync to GitHub in background
    syncTodosToGitHub(`chore: Update TODO - ${todo.title}`).catch(err => {
      console.error('GitHub sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      data: todo
    })
  } catch (error) {
    console.error('Error updating todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

// DELETE /api/todos/:id - Delete TODO
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params
    // Get TODO title before deleting
    const todo = await prisma.todo.findUnique({
      where: { id },
      select: { title: true }
    })

    await db.delete(todos).where(eq(todos.id, id)).returning().get()

    // Sync to GitHub in background
    if (todo) {
      syncTodosToGitHub(`chore: Delete TODO - ${todo.title}`).catch(err => {
        console.error('GitHub sync failed:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Todo deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
