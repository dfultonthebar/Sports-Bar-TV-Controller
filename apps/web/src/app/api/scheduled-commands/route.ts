import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { scheduledCommands, scheduledCommandLogs } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { withTransaction, transactionHelpers } from '@/lib/db/transaction-wrapper'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getNextExecution } from '@/lib/cron-utils'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

/**
 * GET - List all scheduled commands
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const enabledOnly = searchParams.get('enabled') === 'true'

    let query = db.select().from(scheduledCommands)

    if (enabledOnly) {
      query = query.where(eq(scheduledCommands.enabled, true)) as any
    }

    const commands = await query.orderBy(desc(scheduledCommands.createdAt))

    return NextResponse.json({
      success: true,
      commands,
      total: commands.length,
    })
  } catch (error: any) {
    logger.error('Error fetching scheduled commands:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled commands', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new scheduled command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const {
      name,
      description,
      commandType,
      targetType,
      targets,
      commandSequence,
      scheduleType,
      scheduleData,
      cronExpression,
      timezone,
      enabled,
      createdBy,
    } = data
    // Validate required fields
    if (!name || !commandType || !targetType || !targets || !commandSequence || !scheduleType || !scheduleData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate cron expression if scheduleType is 'cron'
    if (scheduleType === 'cron' && !cronExpression) {
      return NextResponse.json(
        { error: 'cronExpression is required when scheduleType is "cron"' },
        { status: 400 }
      )
    }

    // Calculate next execution time BEFORE transaction (async-safe)
    const nextExecution = calculateNextExecution(
      scheduleType as string,
      scheduleData as any,
      String(timezone || 'America/New_York'),
      cronExpression as string | undefined
    )

    // Use synchronous transaction to create command with audit log
    const newCommand = transactionHelpers.createWithAudit(
      (tx) => {
        // Create the scheduled command (SYNCHRONOUS)
        const command = tx.insert(scheduledCommands).values({
          name,
          description,
          commandType,
          targetType,
          targets: JSON.stringify(targets),
          commandSequence: JSON.stringify(commandSequence),
          scheduleType,
          scheduleData: JSON.stringify(scheduleData),
          cronExpression: cronExpression as string | undefined,
          timezone: timezone || 'America/New_York',
          enabled: enabled !== undefined ? enabled : true,
          nextExecution,
          createdBy: createdBy as string,
        }).returning().get()

        return command
      },
      {
        action: 'scheduled_command_created',
        details: { name, commandType, targetType, scheduleType, cronExpression },
        userId: (createdBy as string) || 'system'
      },
      { name: 'create-scheduled-command' }
    )

    return NextResponse.json({
      success: true,
      command: newCommand,
      message: `Scheduled command "${name}" created successfully`,
    })
  } catch (error: any) {
    logger.error('Error creating scheduled command:', error)
    return NextResponse.json(
      { error: 'Failed to create scheduled command', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update a scheduled command
 */
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { data } = bodyValidation
    const { id, ...updates } = data
    if (!id) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      )
    }

    // Prepare updates BEFORE transaction (async-safe)
    const updateData: any = {
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // Serialize JSON fields
    if (updates.targets) updateData.targets = JSON.stringify(updates.targets)
    if (updates.commandSequence) updateData.commandSequence = JSON.stringify(updates.commandSequence)
    if (updates.scheduleData || updates.cronExpression) {
      if (updates.scheduleData) {
        updateData.scheduleData = JSON.stringify(updates.scheduleData)
      }
      if (updates.cronExpression !== undefined) {
        updateData.cronExpression = updates.cronExpression
      }
      // Recalculate next execution if schedule changed
      updateData.nextExecution = calculateNextExecution(
        (updates.scheduleType as string) || 'daily',
        updates.scheduleData || {},
        (updates.timezone as string) || 'America/New_York',
        updates.cronExpression as string | undefined
      )
    }

    // Use synchronous transaction to update command with audit log
    const updatedCommand = transactionHelpers.updateWithAudit(
      (tx) => {
        const command = tx
          .update(scheduledCommands)
          .set(updateData)
          .where(eq(scheduledCommands.id, id as string))
          .returning()
          .get()

        if (!command) {
          throw new Error('Scheduled command not found')
        }

        return command
      },
      {
        action: 'scheduled_command_updated',
        details: { id, updates },
        userId: 'system'
      },
      { name: 'update-scheduled-command' }
    )

    return NextResponse.json({
      success: true,
      command: updatedCommand,
      message: 'Scheduled command updated successfully',
    })
  } catch (error: any) {
    logger.error('Error updating scheduled command:', error)
    return NextResponse.json(
      { error: 'Failed to update scheduled command', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a scheduled command
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      )
    }

    await db.delete(scheduledCommands).where(eq(scheduledCommands.id, id))

    return NextResponse.json({
      success: true,
      message: 'Scheduled command deleted successfully',
    })
  } catch (error: any) {
    logger.error('Error deleting scheduled command:', error)
    return NextResponse.json(
      { error: 'Failed to delete scheduled command', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Helper function to calculate next execution time
 */
function calculateNextExecution(
  scheduleType: string,
  scheduleData: any,
  timezone: string,
  cronExpression?: string
): string {
  const now = new Date()
  let nextExec = new Date(now)

  const data = typeof scheduleData === 'string' ? JSON.parse(scheduleData) : scheduleData

  switch (scheduleType) {
    case 'once':
      // One-time execution at specified date/time
      nextExec = new Date(data.executeAt)
      break

    case 'daily':
      // Daily at specified time
      const [hours, minutes] = data.time.split(':').map(Number)
      nextExec.setHours(hours, minutes, 0, 0)

      // If time has passed today, schedule for tomorrow
      if (nextExec <= now) {
        nextExec.setDate(nextExec.getDate() + 1)
      }
      break

    case 'weekly':
      // Weekly on specified days
      const daysOfWeek = data.daysOfWeek || [] // [0=Sunday, 1=Monday, ...]
      const [wHours, wMinutes] = data.time.split(':').map(Number)

      nextExec.setHours(wHours, wMinutes, 0, 0)

      // Find next occurrence
      let daysAhead = 0
      let foundDay = false

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now)
        checkDate.setDate(checkDate.getDate() + i)
        checkDate.setHours(wHours, wMinutes, 0, 0)

        if (daysOfWeek.includes(checkDate.getDay()) && checkDate > now) {
          nextExec = checkDate
          foundDay = true
          break
        }
      }

      if (!foundDay) {
        // Default to next week, first day
        nextExec.setDate(nextExec.getDate() + 7)
      }
      break

    case 'monthly':
      // Monthly on specified day
      const dayOfMonth = data.dayOfMonth || 1
      const [mHours, mMinutes] = data.time.split(':').map(Number)

      nextExec.setDate(dayOfMonth)
      nextExec.setHours(mHours, mMinutes, 0, 0)

      // If date has passed this month, schedule for next month
      if (nextExec <= now) {
        nextExec.setMonth(nextExec.getMonth() + 1)
      }
      break

    case 'cron':
      // Use cron expression to calculate next execution
      if (cronExpression) {
        const nextCronExec = getNextExecution(cronExpression)
        if (nextCronExec) {
          nextExec = nextCronExec
          logger.info('[SCHEDULED_COMMANDS] Calculated next cron execution', {
            cronExpression,
            nextExecution: nextExec.toISOString()
          })
        } else {
          logger.error('[SCHEDULED_COMMANDS] Failed to calculate cron execution, using default', {
            cronExpression
          })
          // Fallback to next hour if cron parsing fails
          nextExec.setHours(nextExec.getHours() + 1, 0, 0, 0)
        }
      } else {
        logger.warn('[SCHEDULED_COMMANDS] Cron schedule type without cronExpression, using default')
        // Default to next hour if no cron expression provided
        nextExec.setHours(nextExec.getHours() + 1, 0, 0, 0)
      }
      break

    default:
      // Default to 1 hour from now
      nextExec.setHours(nextExec.getHours() + 1)
  }

  return nextExec.toISOString()
}
