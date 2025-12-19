/**
 * In-Memory Cache Manager with TTL Support
 *
 * Provides high-performance caching for:
 * - Sports API data (ESPN, TheSportsDB, NFL Sunday Ticket)
 * - Document search results
 * - Knowledge base queries
 * - AI analysis results
 *
 * Features:
 * - Configurable TTL per cache type
 * - Automatic cache invalidation
 * - Memory-efficient storage
 * - Cache statistics and monitoring
 * - No Redis dependency
 */

export interface CacheEntry<T = any> {
  key: string
  value: T
  expiresAt: number
  createdAt: number
  hits: number
  lastAccessed: number
  size: number
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  totalSize: number
  avgEntrySize: number
  oldestEntry: number | null
  newestEntry: number | null
  entriesByType: Record<string, number>
}

export type CacheType =
  | 'sports-data'
  | 'document-search'
  | 'knowledge-base'
  | 'ai-analysis'
  | 'api-response'
  | 'custom'
  | 'soundtrack-data'
  | 'hardware-status'
  | 'matrix-config'
  | 'device-config'
  | 'streaming-status'
  | 'directv-guide'

interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxEntries?: number // Maximum number of entries for this type
  maxSize?: number // Maximum size in bytes for this type
}

const DEFAULT_CACHE_CONFIGS: Record<CacheType, CacheConfig> = {
  'sports-data': {
    ttl: 5 * 60 * 1000, // 5 minutes (sports data changes frequently)
    maxEntries: 500,
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  'document-search': {
    ttl: 30 * 60 * 1000, // 30 minutes (search results are relatively static)
    maxEntries: 1000,
    maxSize: 100 * 1024 * 1024 // 100MB
  },
  'knowledge-base': {
    ttl: 60 * 60 * 1000, // 1 hour (knowledge base changes infrequently)
    maxEntries: 500,
    maxSize: 75 * 1024 * 1024 // 75MB
  },
  'ai-analysis': {
    ttl: 15 * 60 * 1000, // 15 minutes (AI analysis can be cached briefly)
    maxEntries: 200,
    maxSize: 25 * 1024 * 1024 // 25MB
  },
  'api-response': {
    ttl: 10 * 60 * 1000, // 10 minutes (general API responses)
    maxEntries: 1000,
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  'custom': {
    ttl: 5 * 60 * 1000, // 5 minutes (custom cache entries)
    maxEntries: 200,
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  'soundtrack-data': {
    ttl: 2 * 60 * 1000, // 2 minutes (soundtrack data changes moderately)
    maxEntries: 300,
    maxSize: 20 * 1024 * 1024 // 20MB
  },
  'hardware-status': {
    ttl: 30 * 1000, // 30 seconds (hardware status needs frequent updates)
    maxEntries: 200,
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  'matrix-config': {
    ttl: 60 * 1000, // 1 minute (matrix config changes occasionally)
    maxEntries: 100,
    maxSize: 5 * 1024 * 1024 // 5MB
  },
  'device-config': {
    ttl: 5 * 60 * 1000, // 5 minutes (device config rarely changes)
    maxEntries: 300,
    maxSize: 15 * 1024 * 1024 // 15MB
  },
  'streaming-status': {
    ttl: 60 * 1000, // 1 minute (streaming status moderately dynamic)
    maxEntries: 150,
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  'directv-guide': {
    ttl: 30 * 1000, // 30 seconds (DirecTV program guide, needs to be fresh)
    maxEntries: 200,
    maxSize: 10 * 1024 * 1024 // 10MB
  }
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private configs: Record<CacheType, CacheConfig> = { ...DEFAULT_CACHE_CONFIGS }
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0
  }
  private cleanupInterval: NodeJS.Timeout | null = null
  private cleanupIntervalMs = 60 * 1000 // Run cleanup every minute

  constructor() {
    this.startCleanupInterval()
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.cleanupIntervalMs)

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get cache key with type prefix
   */
  private getCacheKey(type: CacheType, key: string): string {
    return `${type}:${key}`
  }

  /**
   * Calculate approximate size of value in bytes
   */
  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length
    } catch {
      return 0
    }
  }

  /**
   * Set a value in cache
   */
  set<T>(type: CacheType, key: string, value: T, customTTL?: number): void {
    const cacheKey = this.getCacheKey(type, key)
    const config = this.configs[type]
    const ttl = customTTL ?? config.ttl
    const now = Date.now()
    const size = this.calculateSize(value)

    // Check if we need to evict entries
    this.evictIfNeeded(type)

    const entry: CacheEntry<T> = {
      key: cacheKey,
      value,
      expiresAt: now + ttl,
      createdAt: now,
      hits: 0,
      lastAccessed: now,
      size
    }

    this.cache.set(cacheKey, entry)
    this.stats.sets++
  }

  /**
   * Get a value from cache
   */
  get<T>(type: CacheType, key: string): T | null {
    const cacheKey = this.getCacheKey(type, key)
    const entry = this.cache.get(cacheKey)

    if (!entry) {
      this.stats.misses++
      return null
    }

    const now = Date.now()

    // Check if expired
    if (entry.expiresAt < now) {
      this.cache.delete(cacheKey)
      this.stats.misses++
      return null
    }

    // Update access stats
    entry.hits++
    entry.lastAccessed = now
    this.stats.hits++

    return entry.value as T
  }

  /**
   * Check if a key exists and is not expired
   */
  has(type: CacheType, key: string): boolean {
    const cacheKey = this.getCacheKey(type, key)
    const entry = this.cache.get(cacheKey)

    if (!entry) {
      return false
    }

    const now = Date.now()
    if (entry.expiresAt < now) {
      this.cache.delete(cacheKey)
      return false
    }

    return true
  }

  /**
   * Delete a specific entry
   */
  delete(type: CacheType, key: string): boolean {
    const cacheKey = this.getCacheKey(type, key)
    return this.cache.delete(cacheKey)
  }

  /**
   * Clear all entries of a specific type
   */
  clearType(type: CacheType): void {
    const prefix = `${type}:`
    const keysToDelete: string[] = []

    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Evict entries if limits are exceeded
   */
  private evictIfNeeded(type: CacheType): void {
    const config = this.configs[type]
    const prefix = `${type}:`
    const entries: CacheEntry[] = []

    // Collect entries of this type
    for (const [key, entry] of this.cache) {
      if (key.startsWith(prefix)) {
        entries.push(entry)
      }
    }

    // Check entry count limit
    if (config.maxEntries && entries.length >= config.maxEntries) {
      // Sort by LRU (Least Recently Used)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

      // Remove oldest 10% of entries
      const toRemove = Math.ceil(entries.length * 0.1)
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i].key)
        this.stats.evictions++
      }
    }

    // Check size limit
    if (config.maxSize) {
      const totalSize = entries.reduce((sum, e) => sum + e.size, 0)

      if (totalSize >= config.maxSize) {
        // Sort by LRU
        entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

        let currentSize = totalSize
        let i = 0

        // Remove entries until we're under 90% of max size
        while (currentSize > config.maxSize * 0.9 && i < entries.length) {
          currentSize -= entries[i].size
          this.cache.delete(entries[i].key)
          this.stats.evictions++
          i++
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const now = Date.now()

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
    const totalHits = this.stats.hits
    const totalMisses = this.stats.misses
    const totalRequests = totalHits + totalMisses

    const entriesByType: Record<string, number> = {}

    for (const entry of entries) {
      const type = entry.key.split(':')[0]
      entriesByType[type] = (entriesByType[type] || 0) + 1
    }

    const timestamps = entries.map(e => e.createdAt)
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : null
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : null

    return {
      totalEntries: entries.length,
      totalHits,
      totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      totalSize,
      avgEntrySize: entries.length > 0 ? totalSize / entries.length : 0,
      oldestEntry,
      newestEntry,
      entriesByType
    }
  }

  /**
   * Get detailed stats for a specific cache type
   */
  getTypeStats(type: CacheType): {
    entries: number
    hits: number
    size: number
    avgSize: number
    oldestEntry: number | null
    newestEntry: number | null
  } {
    const prefix = `${type}:`
    const entries: CacheEntry[] = []

    for (const [key, entry] of this.cache) {
      if (key.startsWith(prefix)) {
        entries.push(entry)
      }
    }

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0)
    const timestamps = entries.map(e => e.createdAt)

    return {
      entries: entries.length,
      hits: totalHits,
      size: totalSize,
      avgSize: entries.length > 0 ? totalSize / entries.length : 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
    }
  }

  /**
   * Update cache configuration for a specific type
   */
  updateConfig(type: CacheType, config: Partial<CacheConfig>): void {
    this.configs[type] = {
      ...this.configs[type],
      ...config
    }
  }

  /**
   * Get cache configuration for a specific type
   */
  getConfig(type: CacheType): CacheConfig {
    return { ...this.configs[type] }
  }

  /**
   * Warm up cache with data
   */
  warmUp<T>(type: CacheType, data: Record<string, T>, customTTL?: number): void {
    Object.entries(data).forEach(([key, value]) => {
      this.set(type, key, value, customTTL)
    })
  }

  /**
   * Get or set pattern: fetch from cache or compute and cache
   */
  async getOrSet<T>(
    type: CacheType,
    key: string,
    fetcher: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    const cached = this.get<T>(type, key)

    if (cached !== null) {
      return cached
    }

    const value = await fetcher()
    this.set(type, key, value, customTTL)
    return value
  }

  /**
   * Get multiple entries at once
   */
  getMultiple<T>(type: CacheType, keys: string[]): Map<string, T> {
    const results = new Map<string, T>()

    for (const key of keys) {
      const value = this.get<T>(type, key)
      if (value !== null) {
        results.set(key, value)
      }
    }

    return results
  }

  /**
   * Set multiple entries at once
   */
  setMultiple<T>(type: CacheType, entries: Record<string, T>, customTTL?: number): void {
    Object.entries(entries).forEach(([key, value]) => {
      this.set(type, key, value, customTTL)
    })
  }

  /**
   * Export cache state (for debugging/monitoring)
   */
  exportState(): {
    cacheSize: number
    stats: typeof this.stats
    configs: typeof this.configs
    entries: Array<{
      key: string
      size: number
      hits: number
      age: number
      ttl: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      size: entry.size,
      hits: entry.hits,
      age: now - entry.createdAt,
      ttl: entry.expiresAt - now
    }))

    return {
      cacheSize: this.cache.size,
      stats: { ...this.stats },
      configs: { ...this.configs },
      entries
    }
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager()

// Helper functions for common cache operations
export const cacheHelpers = {
  /**
   * Cache sports data with automatic key generation
   */
  cacheSportsData: <T>(league: string, date: string, data: T) => {
    const key = `${league}-${date}`
    cacheManager.set('sports-data', key, data)
  },

  /**
   * Get cached sports data
   */
  getSportsData: <T>(league: string, date: string): T | null => {
    const key = `${league}-${date}`
    return cacheManager.get<T>('sports-data', key)
  },

  /**
   * Cache document search results
   */
  cacheDocumentSearch: (query: string, results: any) => {
    // Normalize query for consistent caching
    const normalizedQuery = query.toLowerCase().trim()
    cacheManager.set('document-search', normalizedQuery, results)
  },

  /**
   * Get cached document search results
   */
  getDocumentSearch: (query: string): any | null => {
    const normalizedQuery = query.toLowerCase().trim()
    return cacheManager.get('document-search', normalizedQuery)
  },

  /**
   * Cache knowledge base query
   */
  cacheKnowledgeBase: (query: string, context: string) => {
    const normalizedQuery = query.toLowerCase().trim()
    cacheManager.set('knowledge-base', normalizedQuery, context)
  },

  /**
   * Get cached knowledge base query
   */
  getKnowledgeBase: (query: string): string | null => {
    const normalizedQuery = query.toLowerCase().trim()
    return cacheManager.get<string>('knowledge-base', normalizedQuery)
  },

  /**
   * Cache AI analysis result
   */
  cacheAIAnalysis: (context: string, result: any) => {
    // Use hash of context as key to keep it manageable
    const key = context.substring(0, 100) // Use first 100 chars as key
    cacheManager.set('ai-analysis', key, result)
  },

  /**
   * Get cached AI analysis
   */
  getAIAnalysis: (context: string): any | null => {
    const key = context.substring(0, 100)
    return cacheManager.get('ai-analysis', key)
  }
}

// Export for monitoring endpoint
export const getCacheStats = () => cacheManager.getStats()
export const getCacheTypeStats = (type: CacheType) => cacheManager.getTypeStats(type)
export const exportCacheState = () => cacheManager.exportState()

// Re-export SimpleCache for simpler use cases
export { simpleCache, SimpleCache, CacheTTL as SimpleCacheTTL, CacheKeys as SimpleCacheKeys } from './simple-cache'
