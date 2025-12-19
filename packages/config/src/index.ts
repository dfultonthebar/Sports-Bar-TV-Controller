/**
 * @sports-bar/config
 *
 * Shared configuration and validation schemas for Sports Bar TV Controller
 *
 * Usage:
 *   // Import validation schemas
 *   import { uuidSchema, deviceIdSchema, z } from '@sports-bar/config/validation'
 *
 *   // Extend TypeScript configs
 *   // In your tsconfig.json: { "extends": "@sports-bar/config/tsconfig/next.json" }
 */

// Re-export all validation schemas
export * from './validation'
