/**
 * @sports-bar/validation
 *
 * Input validation middleware and schemas for Sports Bar TV Controller
 *
 * Features:
 * - Request body, query, and path parameter validation
 * - Reusable Zod schemas for common data types
 * - Standardized error responses
 * - Type-safe validation results
 */

// Export validation middleware
export {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  validateRequest,
  requireField,
  requireFields,
  isValidationSuccess,
  isValidationError,
  ValidationMiddleware,
  type ValidationResult,
  type ValidationError,
  type ValidatedResult,
  type ValidationOptions
} from './middleware'

// Export all schemas
export * from './schemas'

// Export cron validation helper
export { isValidCronExpression } from './cron-validation'

// Re-export commonly used Zod utilities
export { z, type ZodSchema, type ZodError } from 'zod'
