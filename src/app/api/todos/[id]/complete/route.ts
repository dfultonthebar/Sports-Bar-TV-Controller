
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
// Converted to Drizzle ORM
import { syncTodosToGitHub } from '@/lib/gitSync'
import { todos } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export const dynamic = 'force-dynamic'

// POST /api/todos/:id/complete - Mark TODO as complete with validation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  try {
    const { id } = await params
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
      where: { id },
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
      logger.error('GitHub sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      data: todo,
      message: 'Todo marked as complete'
    })
  } catch (error) {
    logger.error('Error completing todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to complete todo' },
      { status: 500 }
    )
  }
}
