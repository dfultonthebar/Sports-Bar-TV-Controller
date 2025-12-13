/**
 * Validation Module Bridge
 *
 * Re-exports from @sports-bar/validation package for backward compatibility.
 * This allows existing imports from '@/lib/validation' to continue working.
 */

// Re-export everything from the validation package
export * from '@sports-bar/validation'

// Also re-export common schemas from @sports-bar/config for backward compatibility
export * from '@sports-bar/config/validation'
