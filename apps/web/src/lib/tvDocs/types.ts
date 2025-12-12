
/**
 * TV Documentation Types
 */

export interface TVManualSearchResult {
  url: string
  title: string
  source: string
  isPDF: boolean
  relevanceScore: number
}

export interface TVDocumentationRecord {
  id: string
  manufacturer: string
  model: string
  manualUrl?: string
  manualPath?: string
  documentationPath?: string
  fetchStatus: 'pending' | 'fetching' | 'completed' | 'failed' | 'not_found'
  fetchError?: string
  lastFetchAttempt?: Date
  fetchedAt?: Date
  qaGenerated: boolean
  qaPairsCount: number
  createdAt: Date
  updatedAt: Date
}

export interface TVManualFetchOptions {
  manufacturer: string
  model: string
  outputNumber?: number
  forceRefetch?: boolean
}

export interface TVManualFetchResult {
  success: boolean
  manufacturer: string
  model: string
  manualPath?: string
  documentationPath?: string
  error?: string
  searchResults?: TVManualSearchResult[]
  qaGenerated?: boolean
  qaPairsCount?: number
}
