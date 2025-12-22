/**
 * Bridge file for Local AI Analyzer
 * Re-exports from @sports-bar/ai-tools package for backward compatibility
 *
 * The actual implementation is in packages/ai-tools/src/local-ai-analyzer.ts
 */

import {
  LocalAIAnalyzer,
  createLocalAIAnalyzer,
  type AIAnalysisResult,
  type EnhancedLogEntry,
  type LoggerInterface,
  type LocalAIAnalyzerConfig,
} from '@sports-bar/ai-tools'
import { logger } from '@/lib/logger'

// Export types for backward compatibility
export type { AIAnalysisResult, EnhancedLogEntry, LoggerInterface, LocalAIAnalyzerConfig }

// Export class for backward compatibility
export { LocalAIAnalyzer, createLocalAIAnalyzer }

/**
 * Singleton instance with app-specific logger
 * This maintains backward compatibility with existing code
 */
export const localAIAnalyzer = createLocalAIAnalyzer({
  logger: {
    info: (message: string, data?: any) => logger.info(message, data),
    warn: (message: string, data?: any) => logger.warn(message, data),
    error: (message: string, error?: any) => logger.error(message, error),
  }
})
