/**
 * @sports-bar/tv-docs
 *
 * TV documentation utilities for searching, downloading, and extracting manual content
 */

// Export all types
export * from './types'

// Export search utilities
export { searchTVManual, validateManualUrl } from './searchManual'

// Export download utilities
export {
  downloadTVManual,
  getManualPath,
  listDownloadedManuals
} from './downloadManual'

// Export content extraction utilities
export {
  extractManualContent,
  splitContentIntoChunks,
  extractKeySections
} from './extractContent'
