/**
 * Validation Module Bridge
 *
 * Re-exports from @sports-bar/validation package for backward compatibility.
 * This allows existing imports from '@/lib/validation' to continue working.
 */

// Re-export everything from the validation package
// Note: @sports-bar/config/validation is NOT re-exported to avoid conflicting star exports
export * from '@sports-bar/validation'
