
/**
 * Cache Service
 * In-memory caching with TTL support for performance optimization
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    this.startCleanup()
  }

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    const age = now - entry.timestamp

    if (age > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set data in cache with TTL (in milliseconds)
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryEstimate: this.estimateMemoryUsage()
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Get or set pattern - get from cache or fetch and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        const age = now - entry.timestamp
        if (age > entry.ttl) {
          this.cache.delete(key)
        }
      }
    }, 300000) // Every 5 minutes
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
   * Estimate memory usage
   */
  private estimateMemoryUsage(): string {
    let totalSize = 0
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.data).length
    }
    return `~${(totalSize / 1024).toFixed(2)} KB`
  }
}

// Singleton instance
export const cacheService = new CacheService()

// Cache TTL presets (in milliseconds)
export const CacheTTL = {
  SHORT: 60000,        // 1 minute
  MEDIUM: 300000,      // 5 minutes
  LONG: 900000,        // 15 minutes
  HOUR: 3600000,       // 1 hour
  DAY: 86400000        // 24 hours
}

// Cache key builders
export const CacheKeys = {
  sportsGuide: (league: string, date: string) => `sports:${league}:${date}`,
  tvGuide: (provider: string, device: string) => `tvguide:${provider}:${device}`,
  deviceStatus: (deviceId: string) => `device:status:${deviceId}`,
  deviceSubscriptions: (deviceId: string) => `device:subs:${deviceId}`,
  atlasAnalysis: (processorId: string) => `atlas:analysis:${processorId}`,
  soundtrackData: (accountId: string) => `soundtrack:${accountId}`,
  nfhsStreams: (date: string) => `nfhs:${date}`,
  aiAnalysis: (deviceId: string, type: string) => `ai:${type}:${deviceId}`
}
