/**
 * NFHS API Bridge - Re-exports from @sports-bar/streaming
 *
 * Note: NFHSSchool and NFHSSearchResult are not exported by @sports-bar/streaming.
 * The streaming package exports NFHSEvent only.
 */
export {
  nfhsApi,
  isNFHSApiAvailable,
  type NFHSEvent
} from '@sports-bar/streaming'

// Local type definitions for NFHS school and search data
export interface NFHSSchool {
  id: string
  name: string
  state: string
  city: string
}

export interface NFHSSearchResult {
  schools: NFHSSchool[]
  totalCount: number
}
