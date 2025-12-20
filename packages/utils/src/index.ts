/**
 * @sports-bar/utils - Shared Utility Functions
 *
 * Common utilities used across the application:
 * - Encryption/decryption helpers
 * - Cron expression utilities
 * - File utilities and locking
 * - Config change tracking
 */

// Encryption
export { encrypt, decrypt } from './encryption'

// Cron utilities
export {
  isValidCronExpression,
  getNextExecution,
  describeCronExpression,
  getNextExecutions,
  validateCronWithMessage,
  getCronExecutionInfo,
  getCronPreset,
  listCronPresets,
  CRON_PRESETS
} from './cron-utils'

// File utilities
export {
  generateUniqueFilename,
  saveFile,
  saveUploadedFile,
  deleteFile,
  getFileExtension,
  isValidFileType,
  ensureDirectoryExists
} from './file-utils'

// File locking
export { withFileLock } from './file-lock'

// Path utilities
export {
  getProjectRoot,
  getDataDir,
  getDataPath,
  getRagDataDir,
  getLogsDir,
  getMemoryBankDir,
  getDocsDir,
  DataFiles,
  resetPathCache
} from './paths'

// AI Knowledge base
export {
  loadKnowledgeBase,
  searchKnowledgeBase,
  getKnowledgeBaseStats,
  buildContext,
  buildContextFromDocs,
  type DocumentChunk
} from './ai-knowledge'

// Text extraction
export {
  extractTextFromFile,
  cleanExtractedText,
  extractAndCleanText,
  type TextExtractionResult
} from './text-extractor'

// File hashing
export {
  calculateFileHash,
  calculateContentHash
} from './file-hash'

// Cache service
export {
  cacheService,
  CacheTTL,
  CacheKeys
} from './cache-service'
