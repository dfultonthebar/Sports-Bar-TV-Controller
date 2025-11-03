import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { scheduledCommands, scheduledCommandLogs } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { withTransaction, transactionHelpers } from '@/lib/db/transaction-wrapper'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export const dynamic = 'force-dynamic'

/**
 * GET - List all scheduled commands
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SCHEDULER)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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
    console.error('Error fetching scheduled commands:', error)
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

  try {
    const body = await request.json()
    const {
      name,
      description,
      commandType,
      targetType,
      targets,
      commandSequence,
      scheduleType,
      scheduleData,
      timezone,
      enabled,
      createdBy,
    } = body

    // Validate required fields
    if (!name || !commandType || !targetType || !targets || !commandSequence || !scheduleType || !scheduleData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate next execution time BEFORE transaction (async-safe)
    const nextExecution = calculateNextExecution(scheduleType, scheduleData, timezone || 'America/New_York')

    // Use synchronous transaction to create command with audit log
    const newCommand = transactionHelpers.createWithAudit(
      (tx) => {
        // Create the scheduled command (SYNCHRONOUS)
        const [command] = tx.insert(scheduledCommands).values({
          name,
          description,
          commandType,
          targetType,
          targets: JSON.stringify(targets),
          commandSequence: JSON.stringify(commandSequence),
          scheduleType,
          scheduleData: JSON.stringify(scheduleData),
          timezone: timezone || 'America/New_York',
          enabled: enabled !== undefined ? enabled : true,
          nextExecution,
          createdBy,
        }).returning()

        return command
      },
      {
        action: 'scheduled_command_created',
        details: { name, commandType, targetType, scheduleType },
        userId: createdBy || 'system'
      },
      { name: 'create-scheduled-command' }
    )

    return NextResponse.json({
      success: true,
      command: newCommand,
      message: `Scheduled command "${name}" created successfully`,
    })
  } catch (error: any) {
    console.error('Error creating scheduled command:', error)
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

  try {
    const body = await request.json()
    const { id, ...updates } = body

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
    if (updates.scheduleData) {
      updateData.scheduleData = JSON.stringify(updates.scheduleData)
      // Recalculate next execution if schedule changed
      updateData.nextExecution = calculateNextExecution(
        updates.scheduleType || 'daily',
        updates.scheduleData,
        updates.timezone || 'America/New_York'
      )
    }

    // Use synchronous transaction to update command with audit log
    const updatedCommand = transactionHelpers.updateWithAudit(
      (tx) => {
        const [command] = tx
          .update(scheduledCommands)
          .set(updateData)
          .where(eq(scheduledCommands.id, id))
          .returning()

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
    console.error('Error updating scheduled command:', error)
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
    console.error('Error deleting scheduled command:', error)
    return NextResponse.json(
      { error: 'Failed to delete scheduled command', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Helper function to calculate next execution time
 */
function calculateNextExecution(scheduleType: string, scheduleData: any, timezone: string): string {
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
      // TODO: Implement cron expression parsing
      // For now, default to next hour
      nextExec.setHours(nextExec.getHours() + 1, 0, 0, 0)
      break

    default:
      // Default to 1 hour from now
      nextExec.setHours(nextExec.getHours() + 1)
  }

  return nextExec.toISOString()
}
