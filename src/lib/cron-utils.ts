/**
 * Cron Expression Utilities
 *
 * Utilities for validating and working with cron expressions for scheduled commands.
 * Uses cron-parser library for robust cron expression parsing.
 *
 * @see https://www.npmjs.com/package/cron-parser
 */

import { CronExpressionParser } from 'cron-parser'
import { logger } from '@/lib/logger'

/**
 * Validate a cron expression
 *
 * @param expression - Cron expression to validate (5-field format: minute hour day month weekday)
 * @returns True if valid, false otherwise
 *
 * @example
 * isValidCronExpression('0 19 * * 1') // true - Every Monday at 7 PM
 * isValidCronExpression('invalid') // false
 */
export function isValidCronExpression(expression: string): boolean {
  // Reject empty strings
  if (!expression || expression.trim().length === 0) {
    return false
  }

  try {
    CronExpressionParser.parse(expression)
    return true
  } catch (error) {
    logger.debug('[CRON] Invalid cron expression:', { expression, error })
    return false
  }
}

/**
 * Get the next execution time for a cron expression
 *
 * @param cronExpression - Valid cron expression
 * @returns Next execution Date, or null if invalid
 *
 * @example
 * getNextExecution('0 6 * * *') // Next occurrence of 6:00 AM
 */
export function getNextExecution(cronExpression: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression)
    return interval.next().toDate()
  } catch (error) {
    logger.error('[CRON] Error calculating next execution:', error)
    return null
  }
}

/**
 * Get human-readable description of common cron expressions
 *
 * @param cronExpression - Cron expression to describe
 * @returns Human-readable description
 *
 * @example
 * describeCronExpression('0 19 * * 1') // 'Every Monday at 7 PM'
 */
export function describeCronExpression(cronExpression: string): string {
  // Common patterns for sports bars
  const descriptions: Record<string, string> = {
    // Minute intervals
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',

    // Hourly
    '0 * * * *': 'Every hour',
    '0 */2 * * *': 'Every 2 hours',
    '0 */4 * * *': 'Every 4 hours',

    // Daily at specific times
    '0 0 * * *': 'Daily at midnight',
    '0 6 * * *': 'Daily at 6 AM',
    '0 7 * * *': 'Daily at 7 AM',
    '0 8 * * *': 'Daily at 8 AM',
    '0 9 * * *': 'Daily at 9 AM',
    '0 10 * * *': 'Daily at 10 AM',
    '0 11 * * *': 'Daily at 11 AM',
    '0 12 * * *': 'Daily at noon',
    '0 17 * * *': 'Daily at 5 PM',
    '0 18 * * *': 'Daily at 6 PM',
    '0 19 * * *': 'Daily at 7 PM',
    '0 20 * * *': 'Daily at 8 PM',
    '0 21 * * *': 'Daily at 9 PM',
    '0 22 * * *': 'Daily at 10 PM',
    '0 23 * * *': 'Daily at 11 PM',
    '0 1 * * *': 'Daily at 1 AM (closing time)',
    '0 2 * * *': 'Daily at 2 AM (after hours)',

    // Weekly schedules
    '0 9 * * 1': 'Every Monday at 9 AM',
    '0 19 * * 1': 'Every Monday at 7 PM',
    '0 12 * * 1-5': 'Weekdays at noon',
    '0 17 * * 1-5': 'Weekdays at 5 PM',
    '0 19 * * 1-5': 'Weekdays at 7 PM',
    '0 0 * * 0': 'Every Sunday at midnight',
    '0 12 * * 0': 'Every Sunday at noon',
    '0 17 * * 0': 'Every Sunday at 5 PM (NFL)',
    '0 20 * * 0': 'Every Sunday at 8 PM (Sunday Night Football)',
    '0 20 * * 1': 'Every Monday at 8 PM (Monday Night Football)',
    '0 20 * * 4': 'Every Thursday at 8 PM (Thursday Night Football)',
    '0 19 * * 6': 'Every Saturday at 7 PM (College Football)',

    // Weekend schedules
    '0 12 * * 6,0': 'Weekends at noon',
    '0 17 * * 6,0': 'Weekends at 5 PM',

    // Monthly
    '0 0 1 * *': 'First day of month at midnight',
    '0 9 1 * *': 'First day of month at 9 AM',
  }

  return descriptions[cronExpression] || 'Custom schedule'
}

/**
 * Get the next N execution times for a cron expression
 *
 * @param cronExpression - Valid cron expression
 * @param count - Number of future executions to calculate (default: 5)
 * @returns Array of future execution Dates
 *
 * @example
 * getNextExecutions('0 12 * * *', 3) // Next 3 occurrences of noon
 */
export function getNextExecutions(
  cronExpression: string,
  count: number = 5
): Date[] {
  try {
    const interval = CronExpressionParser.parse(cronExpression)
    const executions: Date[] = []

    for (let i = 0; i < count; i++) {
      executions.push(interval.next().toDate())
    }

    return executions
  } catch (error) {
    logger.error('[CRON] Error calculating future executions:', error)
    return []
  }
}

/**
 * Validate cron expression with detailed error message
 *
 * @param cronExpression - Cron expression to validate
 * @returns Object with isValid flag and optional error message
 *
 * @example
 * validateCronWithMessage('0 19 * * 1') // { isValid: true }
 * validateCronWithMessage('invalid') // { isValid: false, error: '...' }
 */
export function validateCronWithMessage(cronExpression: string): {
  isValid: boolean
  error?: string
} {
  try {
    CronExpressionParser.parse(cronExpression)
    return { isValid: true }
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Invalid cron expression'
    }
  }
}

/**
 * Get information about when a cron expression will next execute
 *
 * @param cronExpression - Valid cron expression
 * @returns Object with next execution details
 *
 * @example
 * getCronExecutionInfo('0 19 * * 1')
 * // { nextRun: Date, description: 'Every Monday at 7 PM', upcomingRuns: [...] }
 */
export function getCronExecutionInfo(cronExpression: string): {
  nextRun: Date | null
  description: string
  upcomingRuns: Date[]
  isValid: boolean
  error?: string
} {
  const validation = validateCronWithMessage(cronExpression)

  if (!validation.isValid) {
    return {
      nextRun: null,
      description: 'Invalid cron expression',
      upcomingRuns: [],
      isValid: false,
      error: validation.error
    }
  }

  return {
    nextRun: getNextExecution(cronExpression),
    description: describeCronExpression(cronExpression),
    upcomingRuns: getNextExecutions(cronExpression, 5),
    isValid: true
  }
}

/**
 * Common cron expression presets for sports bars
 */
export const CRON_PRESETS = {
  // Opening/Closing
  DAILY_OPENING: '0 9 * * *',           // 9 AM daily
  DAILY_CLOSING: '0 2 * * *',           // 2 AM daily (after bar close)

  // Game Day Schedules
  NFL_SUNDAY_EARLY: '0 12 * * 0',       // Sunday noon (early games)
  NFL_SUNDAY_LATE: '0 16 * * 0',        // Sunday 4 PM (late games)
  NFL_SUNDAY_NIGHT: '0 20 * * 0',       // Sunday 8 PM (SNF)
  NFL_MONDAY_NIGHT: '0 20 * * 1',       // Monday 8 PM (MNF)
  NFL_THURSDAY_NIGHT: '0 20 * * 4',     // Thursday 8 PM (TNF)

  COLLEGE_FOOTBALL_SATURDAY: '0 12 * * 6', // Saturday noon

  NBA_EVENING: '0 19 * * *',            // 7 PM daily
  MLB_EVENING: '0 19 * * *',            // 7 PM daily

  // Maintenance Windows
  EARLY_MORNING_MAINTENANCE: '0 4 * * *',   // 4 AM daily
  WEEKLY_MAINTENANCE: '0 3 * * 1',          // Monday 3 AM

  // Health Checks
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  HOURLY: '0 * * * *',

  // Prime Time
  PRIME_TIME_START: '0 17 * * *',       // 5 PM daily
  PRIME_TIME_END: '0 23 * * *',         // 11 PM daily

  // Weekday vs Weekend
  WEEKDAY_LUNCH: '0 11 * * 1-5',        // 11 AM weekdays
  WEEKEND_BRUNCH: '0 10 * * 6,0',       // 10 AM weekends
} as const

/**
 * Get a preset cron expression by name
 *
 * @param presetName - Name of the preset (e.g., 'NFL_SUNDAY_EARLY')
 * @returns Cron expression or null if preset not found
 */
export function getCronPreset(presetName: keyof typeof CRON_PRESETS): string | null {
  return CRON_PRESETS[presetName] || null
}

/**
 * List all available cron presets with descriptions
 *
 * @returns Array of preset information
 */
export function listCronPresets(): Array<{
  name: string
  cron: string
  description: string
}> {
  return Object.entries(CRON_PRESETS).map(([name, cron]) => ({
    name,
    cron,
    description: describeCronExpression(cron)
  }))
}
