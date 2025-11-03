
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

// GET /api/todos - List all TODOs with optional filters
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category

    // Build where conditions
    const conditions = []
    if (status) conditions.push(eq(schema.todos.status, status))
    if (priority) conditions.push(eq(schema.todos.priority, priority))
    if (category) conditions.push(eq(schema.todos.category, category))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const todosList = await findMany('todos', {
      where: whereClause,
      orderBy: [asc(schema.todos.status), desc(schema.todos.priority), desc(schema.todos.createdAt)]
    })

    // Fetch documents for each todo
    const todosWithDocuments = await Promise.all(
      todosList.map(async (todo) => {
        const documents = await findMany('todoDocuments', {
          where: eq(schema.todoDocuments.todoId, todo.id)
        })
        return { ...todo, documents }
      })
    )

    return NextResponse.json({
      success: true,
      data: todosWithDocuments
    })
  } catch (error) {
    logger.error('Error fetching todos:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todos' },
      { status: 500 }
    )
  }
}

// POST /api/todos - Create new TODO
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const body = await request.json()
    const { title, description, priority, status, category, tags } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    const todo = await create('todos', {
      title,
      description,
      priority: priority || 'MEDIUM',
      status: status || 'PLANNED',
      category,
      tags: tags ? JSON.stringify(tags) : null
    })

    // Fetch documents for the new todo (will be empty initially)
    const documents = await findMany('todoDocuments', {
      where: eq(schema.todoDocuments.todoId, todo.id)
    })

    const todoWithDocuments = { ...todo, documents }

    // Sync to GitHub in background (don't wait for it)
    syncTodosToGitHub(`chore: Add TODO - ${title}`).catch(err => {
      logger.error('GitHub sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      data: todoWithDocuments
    })
  } catch (error) {
    logger.error('Error creating todo:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create todo' },
      { status: 500 }
    )
  }
}
