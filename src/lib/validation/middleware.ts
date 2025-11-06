/**
 * Input Validation Middleware
 *
 * Provides utilities for validating API request data using Zod schemas
 */

import { z, ZodError, ZodSchema } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationResult<T> {
  success: true
  data: T
}

export interface ValidationError {
  success: false
  error: NextResponse
}

export type ValidatedResult<T> = ValidationResult<T> | ValidationError

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if validation was successful
 */
export function isValidationSuccess<T>(
  result: ValidatedResult<T>
): result is ValidationResult<T> {
  return result.success === true
}

/**
 * Type guard to check if validation failed
 */
export function isValidationError<T>(
  result: ValidatedResult<T>
): result is ValidationError {
  return result.success === false
}

export interface ValidationOptions {
  /** Whether to strip unknown fields from the data (default: true) */
  stripUnknown?: boolean
  /** Whether to log validation errors (default: true) */
  logErrors?: boolean
  /** Custom error message prefix */
  errorPrefix?: string
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'unknown',
    message: err.message
  }))
}

/**
 * Create a standardized validation error response
 */
function createValidationErrorResponse(
  errors: Array<{ field: string; message: string }>,
  prefix?: string
): NextResponse {
  const message = prefix ? `${prefix}: Validation failed` : 'Validation failed'

  return NextResponse.json(
    {
      success: false,
      error: message,
      validationErrors: errors,
      timestamp: new Date().toISOString()
    },
    { status: 400 }
  )
}

// ============================================================================
// REQUEST BODY VALIDATION
// ============================================================================

/**
 * Validate request body against a Zod schema
 *
 * @example
 * ```typescript
 * const bodySchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email()
 * })
 *
 * export async function POST(request: NextRequest) {
 *   const validation = await validateRequestBody(request, bodySchema)
 *   if (!validation.success) return validation.error
 *
 *   const { name, email } = validation.data
 *   // ... use validated data
 * }
 * ```
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): Promise<ValidatedResult<T>> {
  const { stripUnknown = true, logErrors = true, errorPrefix } = options

  try {
    // Parse request body
    const rawBody = await request.json()

    // Validate with schema (Zod doesn't use parseOptions as second param)
    // Use safeParse or passthrough() on schema instead
    // Note: passthrough() only exists on ZodObject, not on all ZodTypes
    const validatedData = stripUnknown
      ? schema.parse(rawBody)
      : ('passthrough' in schema && typeof (schema as any).passthrough === 'function'
        ? (schema as any).passthrough().parse(rawBody)
        : schema.parse(rawBody))

    return {
      success: true,
      data: validatedData
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = formatZodErrors(error)

      if (logErrors) {
        logger.error('[Validation Error]', {
          data: {
            endpoint: request.url,
            errors: formattedErrors
          }
        })
      }

      return {
        success: false,
        error: createValidationErrorResponse(formattedErrors, errorPrefix)
      }
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: NextResponse.json(
          {
            success: false,
            error: 'Invalid JSON in request body',
            timestamp: new Date().toISOString()
          },
          { status: 400 }
        )
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

// ============================================================================
// QUERY PARAMETERS VALIDATION
// ============================================================================

/**
 * Validate URL query parameters against a Zod schema
 *
 * @example
 * ```typescript
 * const querySchema = z.object({
 *   page: z.coerce.number().int().min(1).default(1),
 *   limit: z.coerce.number().int().min(1).max(100).default(20),
 *   sort: z.enum(['asc', 'desc']).default('asc')
 * })
 *
 * export async function GET(request: NextRequest) {
 *   const validation = validateQueryParams(request, querySchema)
 *   if (!validation.success) return validation.error
 *
 *   const { page, limit, sort } = validation.data
 *   // ... use validated params
 * }
 * ```
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): ValidatedResult<T> {
  const { stripUnknown = true, logErrors = true, errorPrefix } = options

  try {
    const { searchParams } = new URL(request.url)

    // Convert URLSearchParams to plain object
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // Validate with schema (Zod doesn't use parseOptions as second param)
    // Note: passthrough() only exists on ZodObject, not on all ZodTypes
    const validatedData = stripUnknown
      ? schema.parse(params)
      : ('passthrough' in schema && typeof (schema as any).passthrough === 'function'
        ? (schema as any).passthrough().parse(params)
        : schema.parse(params))

    return {
      success: true,
      data: validatedData
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = formatZodErrors(error)

      if (logErrors) {
        logger.error('[Query Validation Error]', {
          data: {
            endpoint: request.url,
            errors: formattedErrors
          }
        })
      }

      return {
        success: false,
        error: createValidationErrorResponse(formattedErrors, errorPrefix)
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

// ============================================================================
// PATH PARAMETERS VALIDATION
// ============================================================================

/**
 * Validate path parameters (from dynamic routes) against a Zod schema
 *
 * @example
 * ```typescript
 * const paramsSchema = z.object({
 *   id: z.string().uuid()
 * })
 *
 * export async function GET(
 *   request: NextRequest,
 *   { params }: { params: Promise<{ id: string }> }
 * ) {
 *   const params = await context.params
 *   const validation = validatePathParams(resolvedParams, paramsSchema)
 *   if (!validation.success) return validation.error
 *
 *   const { id } = validation.data
 *   // ... use validated id
 * }
 * ```
 */
export function validatePathParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): ValidatedResult<T> {
  const { stripUnknown = true, logErrors = true, errorPrefix } = options

  try {
    // Validate with schema (Zod doesn't use parseOptions as second param)
    // Note: passthrough() only exists on ZodObject, not on all ZodTypes
    const validatedData = stripUnknown
      ? schema.parse(params)
      : ('passthrough' in schema && typeof (schema as any).passthrough === 'function'
        ? (schema as any).passthrough().parse(params)
        : schema.parse(params))

    return {
      success: true,
      data: validatedData
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = formatZodErrors(error)

      if (logErrors) {
        logger.error('[Path Params Validation Error]', {
          data: {
            params,
            errors: formattedErrors
          }
        })
      }

      return {
        success: false,
        error: createValidationErrorResponse(formattedErrors, errorPrefix)
      }
    }

    // Re-throw unexpected errors
    throw error
  }
}

// ============================================================================
// COMBINED VALIDATION
// ============================================================================

/**
 * Validate multiple parts of a request at once
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const validation = await validateRequest(request, {
 *     body: bodySchema,
 *     query: querySchema
 *   })
 *   if (!validation.success) return validation.error
 *
 *   const { body, query } = validation.data
 *   // ... use validated data
 * }
 * ```
 */
export async function validateRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(
  request: NextRequest,
  schemas: {
    body?: ZodSchema<TBody>
    query?: ZodSchema<TQuery>
    params?: { data: Record<string, string>; schema: ZodSchema<TParams> }
  },
  options: ValidationOptions = {}
): Promise<ValidatedResult<{
  body?: TBody
  query?: TQuery
  params?: TParams
}>> {
  const validatedData: {
    body?: TBody
    query?: TQuery
    params?: TParams
  } = {}

  // Validate body if schema provided
  if (schemas.body) {
    const bodyValidation = await validateRequestBody(request, schemas.body, options)
    if (!bodyValidation.success) return bodyValidation
    validatedData.body = bodyValidation.data
  }

  // Validate query params if schema provided
  if (schemas.query) {
    const queryValidation = validateQueryParams(request, schemas.query, options)
    if (!queryValidation.success) return queryValidation
    validatedData.query = queryValidation.data
  }

  // Validate path params if schema provided
  if (schemas.params) {
    const paramsValidation = validatePathParams(
      schemas.params.data,
      schemas.params.schema,
      options
    )
    if (!paramsValidation.success) return paramsValidation
    validatedData.params = paramsValidation.data
  }

  return {
    success: true,
    data: validatedData
  }
}

// ============================================================================
// HELPER VALIDATORS
// ============================================================================

/**
 * Quick validation for a single required field
 */
export function requireField(
  data: any,
  fieldName: string,
  fieldType?: 'string' | 'number' | 'boolean' | 'object' | 'array'
): NextResponse | null {
  if (data[fieldName] === undefined || data[fieldName] === null) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing required field: ${fieldName}`,
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    )
  }

  if (fieldType) {
    const actualType = Array.isArray(data[fieldName]) ? 'array' : typeof data[fieldName]

    if (actualType !== fieldType) {
      return NextResponse.json(
        {
          success: false,
          error: `Field '${fieldName}' must be of type ${fieldType}, got ${actualType}`,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }
  }

  return null
}

/**
 * Quick validation for multiple required fields
 */
export function requireFields(
  data: any,
  fields: Array<{ name: string; type?: 'string' | 'number' | 'boolean' | 'object' | 'array' }>
): NextResponse | null {
  for (const field of fields) {
    const error = requireField(data, field.name, field.type)
    if (error) return error
  }

  return null
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ValidationMiddleware = {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  validateRequest,
  requireField,
  requireFields,
  formatZodErrors,
  createValidationErrorResponse,
  isValidationSuccess,
  isValidationError
}
