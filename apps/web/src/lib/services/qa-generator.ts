/**
 * Bridge file for backwards compatibility
 * Re-exports from @sports-bar/services package
 */
export {
  generateQAsFromRepository,
  getQAGenerationStatus,
  getGenerationJobStatus,
  getAllQAEntries,
  searchQAEntries,
  updateQAEntry,
  deleteQAEntry,
  getQAStatistics,
  type QAGenerationOptions,
  type GeneratedQA,
} from '@sports-bar/services'
