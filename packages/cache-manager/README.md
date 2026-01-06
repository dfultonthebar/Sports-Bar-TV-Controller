# @sports-bar/cache-manager

In-memory caching solutions for the Sports Bar TV Controller application.

## Overview

This package provides two caching solutions with different levels of complexity:

1. **CacheManager** - Full-featured cache with type-based organization and memory management
2. **SimpleCache** - Lightweight cache for basic key-value storage

## When to Use Each

### Use CacheManager When You Need:

- **Type-based cache organization** - Different TTLs and limits for different data types
- **Memory limits and automatic eviction** - LRU eviction when limits are reached
- **Detailed statistics and monitoring** - Hit rates, entry counts, memory usage
- **Multiple cache types** - Sports data, documents, hardware status, etc.
- **Advanced features** - Batch operations, cache warming, detailed stats per type

### Use SimpleCache When You Need:

- **Quick, simple caching** - No configuration required
- **Direct key-value storage** - No type categorization needed
- **Helper functions** - Pre-built cache key patterns
- **Minimal overhead** - Simpler API surface
- **Basic TTL support** - Just store and retrieve with expiration

## CacheManager API

Full-featured cache with type-based organization.

### Basic Usage

```typescript
import { cacheManager } from '@sports-bar/cache-manager'

// Set with automatic TTL based on type
cacheManager.set('sports-data', 'nfl-2025-01-15', sportsData)

// Set with custom TTL (10 minutes)
cacheManager.set('sports-data', 'nfl-2025-01-15', sportsData, 10 * 60 * 1000)

// Get from cache
const data = cacheManager.get('sports-data', 'nfl-2025-01-15')

// Get or fetch pattern
const data = await cacheManager.getOrSet(
  'sports-data',
  'nfl-2025-01-15',
  async () => await fetchSportsData(),
  10 * 60 * 1000 // optional custom TTL
)
```

### Supported Cache Types

```typescript
type CacheType =
  | 'sports-data'          // 5 min TTL, 500 entries, 50MB
  | 'document-search'      // 30 min TTL, 1000 entries, 100MB
  | 'knowledge-base'       // 1 hour TTL, 500 entries, 75MB
  | 'ai-analysis'          // 15 min TTL, 200 entries, 25MB
  | 'api-response'         // 10 min TTL, 1000 entries, 50MB
  | 'custom'               // 5 min TTL, 200 entries, 10MB
  | 'soundtrack-data'      // 2 min TTL, 300 entries, 20MB
  | 'hardware-status'      // 30 sec TTL, 200 entries, 10MB
  | 'matrix-config'        // 1 min TTL, 100 entries, 5MB
  | 'device-config'        // 5 min TTL, 300 entries, 15MB
  | 'streaming-status'     // 1 min TTL, 150 entries, 10MB
  | 'directv-guide'        // 30 sec TTL, 200 entries, 10MB
```

### Advanced Operations

```typescript
// Check if key exists
const exists = cacheManager.has('sports-data', 'nfl-2025-01-15')

// Delete specific entry
cacheManager.delete('sports-data', 'nfl-2025-01-15')

// Clear all entries of a type
cacheManager.clearType('sports-data')

// Clear entire cache
cacheManager.clear()

// Manual cleanup of expired entries
const removedCount = cacheManager.cleanup()

// Batch operations
cacheManager.setMultiple('sports-data', {
  'nfl-game-1': game1Data,
  'nfl-game-2': game2Data
})

const results = cacheManager.getMultiple('sports-data', ['nfl-game-1', 'nfl-game-2'])

// Cache warming
cacheManager.warmUp('sports-data', {
  'nfl-game-1': game1Data,
  'nfl-game-2': game2Data
}, customTTL)

// Get statistics
const stats = cacheManager.getStats()
// Returns: totalEntries, totalHits, totalMisses, hitRate, totalSize, etc.

const typeStats = cacheManager.getTypeStats('sports-data')
// Returns: entries, hits, size, avgSize, oldestEntry, newestEntry

// Update cache configuration
cacheManager.updateConfig('sports-data', {
  ttl: 10 * 60 * 1000,  // 10 minutes
  maxEntries: 1000,
  maxSize: 100 * 1024 * 1024  // 100MB
})

// Export state for debugging
const state = cacheManager.exportState()
```

### Helper Functions

```typescript
import { cacheHelpers } from '@sports-bar/cache-manager'

// Sports data helpers
cacheHelpers.cacheSportsData('nfl', '2025-01-15', data)
const sportsData = cacheHelpers.getSportsData('nfl', '2025-01-15')

// Document search helpers
cacheHelpers.cacheDocumentSearch('query text', results)
const searchResults = cacheHelpers.getDocumentSearch('query text')

// Knowledge base helpers
cacheHelpers.cacheKnowledgeBase('question', 'context')
const context = cacheHelpers.getKnowledgeBase('question')

// AI analysis helpers
cacheHelpers.cacheAIAnalysis('context string', result)
const aiResult = cacheHelpers.getAIAnalysis('context string')
```

## SimpleCache API

Lightweight cache for basic key-value storage.

### Basic Usage

```typescript
import { simpleCache, CacheTTL, CacheKeys } from '@sports-bar/cache-manager'

// Set with default TTL (5 minutes)
simpleCache.set('my-key', myData)

// Set with custom TTL
simpleCache.set('my-key', myData, CacheTTL.HOUR)

// Get from cache
const data = simpleCache.get('my-key')

// Get or fetch pattern
const data = await simpleCache.getOrSet(
  'my-key',
  async () => await fetchData(),
  CacheTTL.HOUR
)
```

### TTL Constants

```typescript
import { CacheTTL } from '@sports-bar/cache-manager'

CacheTTL.SHORT   // 1 minute
CacheTTL.MEDIUM  // 5 minutes (default)
CacheTTL.LONG    // 15 minutes
CacheTTL.HOUR    // 1 hour
CacheTTL.DAY     // 24 hours
```

### Cache Key Helpers

```typescript
import { CacheKeys } from '@sports-bar/cache-manager'

// Pre-built key patterns
const key1 = CacheKeys.sportsGuide('nfl', '2025-01-15')
// Returns: 'sports:nfl:2025-01-15'

const key2 = CacheKeys.deviceStatus('device-123')
// Returns: 'device:status:device-123'

const key3 = CacheKeys.deviceSubscriptions('device-123')
// Returns: 'device:subs:device-123'

// Available helpers:
CacheKeys.sportsGuide(league, date)
CacheKeys.tvGuide(provider, device)
CacheKeys.deviceStatus(deviceId)
CacheKeys.deviceSubscriptions(deviceId)
CacheKeys.atlasAnalysis(processorId)
CacheKeys.soundtrackData(accountId)
CacheKeys.aiAnalysis(deviceId, type)
```

### All Operations

```typescript
// Check if key exists
const exists = simpleCache.has('my-key')

// Delete specific entry
simpleCache.delete('my-key')

// Clear all cache entries
simpleCache.clear()

// Clear entries matching pattern
simpleCache.clearPattern('^sports:')  // Clears all keys starting with 'sports:'

// Get statistics
const stats = simpleCache.getStats()
// Returns: { size, keys, memoryEstimate }

// Manual cleanup control
simpleCache.stopCleanup()  // Stop automatic cleanup
// Cleanup runs automatically every 5 minutes by default
```

### Creating Custom Instances

```typescript
import { SimpleCache } from '@sports-bar/cache-manager'

// Create isolated cache instance
const myCache = new SimpleCache()

myCache.set('key', 'value', 60000) // 1 minute TTL
const value = myCache.get('key')

// Don't forget to stop cleanup when done
myCache.stopCleanup()
```

## Migration from Legacy cache-service.ts

The old `cache-service.ts` file has been moved into this package as `SimpleCache`.

### Old Import (Deprecated)

```typescript
import { cacheService, CacheTTL, CacheKeys } from '@/lib/cache-service'
```

### New Import (Recommended)

```typescript
import { simpleCache as cacheService, SimpleCacheTTL as CacheTTL, SimpleCacheKeys as CacheKeys } from '@sports-bar/cache-manager'
```

### Bridge Import (Temporary Compatibility)

```typescript
// This bridge file maintains backward compatibility during migration
import { cacheService, CacheTTL, CacheKeys } from '@/lib/cache-service-bridge'
```

## Comparison: CacheManager vs SimpleCache

| Feature | CacheManager | SimpleCache |
|---------|--------------|-------------|
| Type-based organization | ✅ Yes | ❌ No |
| Memory limits | ✅ Yes | ❌ No |
| Automatic eviction | ✅ LRU eviction | ❌ No |
| Hit/miss statistics | ✅ Detailed stats | ✅ Basic stats |
| Batch operations | ✅ Yes | ❌ No |
| Cache warming | ✅ Yes | ❌ No |
| Pattern-based clearing | ❌ No | ✅ Regex patterns |
| Helper key builders | ✅ Via cacheHelpers | ✅ Via CacheKeys |
| TTL constants | ❌ No | ✅ Yes |
| API complexity | Complex | Simple |
| Configuration | Per-type configs | Default only |
| Use case | Production apps | Quick prototypes |

## Examples

### Sports Data Caching (CacheManager)

```typescript
import { cacheManager } from '@sports-bar/cache-manager'

async function getSportsSchedule(league: string, date: string) {
  return await cacheManager.getOrSet(
    'sports-data',
    `${league}-schedule-${date}`,
    async () => {
      // This only runs on cache miss
      const response = await fetch(`https://api.sports.com/${league}/${date}`)
      return await response.json()
    }
  )
}
```

### Device Subscription Polling (SimpleCache)

```typescript
import { simpleCache, CacheKeys, CacheTTL } from '@sports-bar/cache-manager'

async function getDeviceSubscriptions(deviceId: string) {
  const cacheKey = CacheKeys.deviceSubscriptions(deviceId)

  return await simpleCache.getOrSet(
    cacheKey,
    async () => {
      // Poll device for subscriptions
      return await pollDeviceSubscriptions(deviceId)
    },
    CacheTTL.HOUR
  )
}
```

### Hardware Status Caching (CacheManager with short TTL)

```typescript
import { cacheManager } from '@sports-bar/cache-manager'

async function getHardwareStatus(deviceId: string) {
  // Uses 30-second TTL from 'hardware-status' type config
  return await cacheManager.getOrSet(
    'hardware-status',
    deviceId,
    async () => await checkDeviceStatus(deviceId)
  )
}
```

## TypeScript Support

All exports are fully typed:

```typescript
import type { CacheEntry, CacheStats, CacheType } from '@sports-bar/cache-manager'

const stats: CacheStats = cacheManager.getStats()
const entry: CacheEntry<MyDataType> = {
  key: 'my-key',
  value: myData,
  expiresAt: Date.now() + 60000,
  createdAt: Date.now(),
  hits: 0,
  lastAccessed: Date.now(),
  size: 1024
}
```

## License

MIT
