/**
 * Validation Module
 *
 * Central export point for all validation utilities
 *
 * Combines:
 * - Common schemas from @sports-bar/config/validation (shared across packages)
 * - App-specific schemas from ./schemas (with local dependencies)
 * - Validation middleware from ./middleware
 */

// Export common schemas from package first (local schemas will override duplicates)
export * from '@sports-bar/config/validation'

// Export app-specific schemas (overrides package schemas with same names)
export * from './schemas'

// Export validation middleware
export * from './middleware'

// Re-export commonly used Zod utilities
export { z, type ZodSchema, type ZodError } from 'zod'
