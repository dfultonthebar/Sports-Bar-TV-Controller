/**
 * Shared Validation Schemas
 *
 * Reusable Zod schemas for input validation across packages
 * These are the core schemas without external dependencies
 */

import { z } from 'zod'

// ============================================================================
// COMMON PRIMITIVES
// ============================================================================

/** UUID validation (v4 format) */
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' })

/** Non-empty string validation */
export const nonEmptyStringSchema = z.string().min(1, 'String cannot be empty')

/** Optional non-empty string (can be undefined, but if present must not be empty) */
export const optionalNonEmptyStringSchema = z.string().min(1).optional()

/** Positive integer validation */
export const positiveIntSchema = z.number().int().positive()

/** Non-negative integer validation */
export const nonNegativeIntSchema = z.number().int().min(0)

/** Port number validation (1-65535) */
export const portSchema = z.number().int().min(1).max(65535)

/** ISO 8601 date string validation */
export const isoDateSchema = z.string().datetime({ message: 'Invalid ISO 8601 date format' })

/** Boolean with coercion from strings */
export const booleanSchema = z.boolean().or(z.enum(['true', 'false']).transform(val => val === 'true'))

// ============================================================================
// NETWORK & INFRASTRUCTURE
// ============================================================================

/** IP Address validation (IPv4 and IPv6) */
export const ipAddressSchema = z.string().ip({ message: 'Invalid IP address' })

/** IPv4 Address validation (strict) */
export const ipv4AddressSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  'Invalid IPv4 address'
)

/** URL validation */
export const urlSchema = z.string().url({ message: 'Invalid URL format' })

/** Protocol validation (TCP/UDP) */
export const protocolSchema = z.enum(['TCP', 'UDP'], {
  errorMap: () => ({ message: 'Protocol must be TCP or UDP' })
})

// ============================================================================
// HARDWARE CONTROL
// ============================================================================

/** Device ID validation (alphanumeric with underscores and hyphens) */
export const deviceIdSchema = z.string().regex(
  /^[a-zA-Z0-9_-]+$/,
  'Device ID must contain only alphanumeric characters, underscores, and hyphens'
)

/** Volume level validation (0-100) */
export const volumeSchema = z.number().int().min(0).max(100)

/** Input number validation (1-10 for most devices) */
export const inputNumberSchema = z.number().int().min(1).max(10)

/** Matrix routing validation */
export const matrixRouteSchema = z.object({
  inputId: deviceIdSchema,
  outputId: deviceIdSchema,
  immediate: z.boolean().optional().default(true)
})

/** Channel number validation (1-9999) */
export const channelNumberSchema = z.number().int().min(1).max(9999)

// ============================================================================
// DEVICE TYPES
// ============================================================================

/** Device type validation */
export const deviceTypeSchema = z.enum([
  'directv',
  'firetv',
  'cec',
  'ir',
  'matrix',
  'audio',
  'wolfpack',
  'atlas'
], {
  errorMap: () => ({ message: 'Invalid device type' })
})

/** DirecTV receiver type validation */
export const directvReceiverTypeSchema = z.enum([
  'Genie HD DVR',
  'Genie Mini',
  'HD Receiver',
  'SD Receiver'
], {
  errorMap: () => ({ message: 'Invalid DirecTV receiver type' })
})

/** Fire TV device status validation */
export const fireTVStatusSchema = z.enum([
  'online',
  'offline',
  'unknown',
  'connecting'
], {
  errorMap: () => ({ message: 'Invalid Fire TV status' })
})

// ============================================================================
// PAGINATION & FILTERING
// ============================================================================

/** Pagination schema */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional()
})

/** Sort order schema */
export const sortOrderSchema = z.enum(['asc', 'desc']).optional().default('desc')

/** Date range schema */
export const dateRangeSchema = z.object({
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional()
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate)
    }
    return true
  },
  { message: 'Start date must be before or equal to end date' }
)

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UUID = z.infer<typeof uuidSchema>
export type DeviceId = z.infer<typeof deviceIdSchema>
export type DeviceType = z.infer<typeof deviceTypeSchema>
export type DirecTVReceiverType = z.infer<typeof directvReceiverTypeSchema>
export type FireTVStatus = z.infer<typeof fireTVStatusSchema>
export type MatrixRoute = z.infer<typeof matrixRouteSchema>
export type Pagination = z.infer<typeof paginationSchema>
export type SortOrder = z.infer<typeof sortOrderSchema>
export type DateRange = z.infer<typeof dateRangeSchema>
