/**
 * Cron Expression Validation Helper
 *
 * Minimal cron validation for use in Zod schemas.
 * Uses cron-parser for robust parsing.
 */

import { CronExpressionParser } from 'cron-parser'
import { logger } from '@sports-bar/logger'

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
