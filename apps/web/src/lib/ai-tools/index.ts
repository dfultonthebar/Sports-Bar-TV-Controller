/**
 * AI Tools Bridge
 * Re-exports from @sports-bar/ai-tools package for backward compatibility
 *
 * This bridge maintains compatibility with existing imports while delegating
 * all core functionality to the @sports-bar/ai-tools package.
 *
 * Architecture:
 * - Core tools (file-system, code-execution) → @sports-bar/ai-tools package
 * - Web-app-specific integrations (security-logger) → Remains in apps/web
 * - Bridge files maintain import compatibility
 */

// Re-export everything from the package
export * from '@sports-bar/ai-tools';

/**
 * Files converted to bridge pattern:
 *
 * ✅ file-system-tools.ts - Now a thin bridge re-exporting from @sports-bar/ai-tools
 * ✅ code-execution-tools.ts - Now a thin bridge re-exporting from @sports-bar/ai-tools
 * ✅ types.ts - Now a thin bridge re-exporting from @sports-bar/ai-tools
 * ✅ logger.ts - Now a thin bridge re-exporting from @sports-bar/ai-tools
 * ✅ index.ts (this file) - Re-exports package exports
 *
 * Files migrated to package:
 * - types.ts → @sports-bar/ai-tools/types
 * - logger.ts → @sports-bar/ai-tools/logger
 * - security/config.ts → @sports-bar/ai-tools/security/config
 * - security/validator.ts → @sports-bar/ai-tools/security/validator
 * - security/enhanced-validator.ts → @sports-bar/ai-tools/security/enhanced-validator
 * - security/sandbox.ts → @sports-bar/ai-tools/security/sandbox
 * - security/isolated-vm-wrapper.ts → @sports-bar/ai-tools/security/isolated-vm-wrapper
 * - local-ai-analyzer.ts → @sports-bar/ai-tools/local-ai-analyzer
 *
 * Web-app-specific files (remain in apps/web):
 * - security/security-logger.ts - Database integration for security audit logs
 */
