/**
 * Bridge file for enhanced logger (SERVER-ONLY)
 * Re-exports from @sports-bar/logger package for backward compatibility
 *
 * NOTE: This module uses Node.js 'fs' and should only be imported in server-side code
 */

export {
  EnhancedLogger,
  enhancedLogger,
  useLogger,
  type LogLevel,
  type LogCategory,
  type DeviceType,
  type EnhancedLogEntry,
  type LogAnalytics
} from '@sports-bar/logger/enhanced-logger'
