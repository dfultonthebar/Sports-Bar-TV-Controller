# Cache Manager Quick Reference

## TL;DR

```typescript
// Simple caching (no config needed)
import { simpleCache, SimpleCacheTTL, SimpleCacheKeys } from '@sports-bar/cache-manager'

simpleCache.set('my-key', data, SimpleCacheTTL.HOUR)
const result = simpleCache.get('my-key')

// Advanced caching (type-based, memory-managed)
import { cacheManager } from '@sports-bar/cache-manager'

cacheManager.set('sports-data', 'nfl-2025-01-15', data)
const result = cacheManager.get('sports-data', 'nfl-2025-01-15')
```

---

## SimpleCache Cheat Sheet

### Import
```typescript
import { simpleCache, SimpleCacheTTL, SimpleCacheKeys } from '@sports-bar/cache-manager'
```

### Basic Operations
```typescript
// Set (default 5 min TTL)
simpleCache.set('key', value)

// Set with custom TTL
simpleCache.set('key', value, SimpleCacheTTL.HOUR)

// Get
const data = simpleCache.get<MyType>('key')

// Get or fetch
const data = await simpleCache.getOrSet('key', async () => fetchData(), SimpleCacheTTL.HOUR)

// Check existence
if (simpleCache.has('key')) { }

// Delete
simpleCache.delete('key')

// Clear all
simpleCache.clear()

// Clear pattern
simpleCache.clearPattern('^sports:')
```

### TTL Constants
```typescript
SimpleCacheTTL.SHORT   // 1 minute
SimpleCacheTTL.MEDIUM  // 5 minutes
SimpleCacheTTL.LONG    // 15 minutes
SimpleCacheTTL.HOUR    // 1 hour
SimpleCacheTTL.DAY     // 24 hours
```

### Key Helpers
```typescript
SimpleCacheKeys.sportsGuide('nfl', '2025-01-15')      // 'sports:nfl:2025-01-15'
SimpleCacheKeys.deviceStatus('device-123')             // 'device:status:device-123'
SimpleCacheKeys.deviceSubscriptions('device-123')      // 'device:subs:device-123'
SimpleCacheKeys.tvGuide('spectrum', 'device-123')      // 'tvguide:spectrum:device-123'
SimpleCacheKeys.atlasAnalysis('processor-1')           // 'atlas:analysis:processor-1'
SimpleCacheKeys.soundtrackData('account-123')          // 'soundtrack:account-123'
SimpleCacheKeys.aiAnalysis('device-123', 'analysis')   // 'ai:analysis:device-123'
```

---

## CacheManager Cheat Sheet

### Import
```typescript
import { cacheManager } from '@sports-bar/cache-manager'
```

### Basic Operations
```typescript
// Set (uses type's default TTL)
cacheManager.set('sports-data', 'nfl-2025-01-15', data)

// Set with custom TTL
cacheManager.set('sports-data', 'nfl-2025-01-15', data, 10 * 60 * 1000)

// Get
const data = cacheManager.get<MyType>('sports-data', 'nfl-2025-01-15')

// Get or fetch
const data = await cacheManager.getOrSet(
  'sports-data',
  'nfl-2025-01-15',
  async () => fetchData()
)

// Check existence
if (cacheManager.has('sports-data', 'nfl-2025-01-15')) { }

// Delete
cacheManager.delete('sports-data', 'nfl-2025-01-15')

// Clear by type
cacheManager.clearType('sports-data')

// Clear all
cacheManager.clear()
```

### Cache Types & Default TTLs
```typescript
'sports-data'        // 5 min,  500 entries, 50MB
'document-search'    // 30 min, 1000 entries, 100MB
'knowledge-base'     // 1 hour, 500 entries, 75MB
'ai-analysis'        // 15 min, 200 entries, 25MB
'api-response'       // 10 min, 1000 entries, 50MB
'custom'             // 5 min,  200 entries, 10MB
'soundtrack-data'    // 2 min,  300 entries, 20MB
'hardware-status'    // 30 sec, 200 entries, 10MB
'matrix-config'      // 1 min,  100 entries, 5MB
'device-config'      // 5 min,  300 entries, 15MB
'streaming-status'   // 1 min,  150 entries, 10MB
'directv-guide'      // 30 sec, 200 entries, 10MB
```

### Batch Operations
```typescript
// Set multiple
cacheManager.setMultiple('sports-data', {
  'nfl-game-1': game1,
  'nfl-game-2': game2
})

// Get multiple
const results = cacheManager.getMultiple('sports-data', ['nfl-game-1', 'nfl-game-2'])

// Warm up cache
cacheManager.warmUp('sports-data', {
  'nfl-game-1': game1,
  'nfl-game-2': game2
})
```

### Statistics
```typescript
// Overall stats
const stats = cacheManager.getStats()
// { totalEntries, totalHits, totalMisses, hitRate, totalSize, ... }

// Type-specific stats
const typeStats = cacheManager.getTypeStats('sports-data')
// { entries, hits, size, avgSize, oldestEntry, newestEntry }

// Export state
const state = cacheManager.exportState()
// Full cache state for debugging
```

### Configuration
```typescript
// Update type config
cacheManager.updateConfig('sports-data', {
  ttl: 10 * 60 * 1000,           // 10 minutes
  maxEntries: 1000,
  maxSize: 100 * 1024 * 1024     // 100MB
})

// Get config
const config = cacheManager.getConfig('sports-data')
```

---

## Comparison Table

| Feature | SimpleCache | CacheManager |
|---------|-------------|--------------|
| API | `cache.set(key, value)` | `cache.set(type, key, value)` |
| Memory Limits | ❌ No | ✅ Yes (per type) |
| Auto Eviction | ❌ No | ✅ LRU |
| Statistics | Basic | Detailed |
| Batch Ops | ❌ No | ✅ Yes |
| Pattern Clear | ✅ Regex | ❌ Type only |
| Config | Global | Per-type |
| Use Case | Simple needs | Production apps |

---

## Common Patterns

### Device Polling with Cache
```typescript
import { simpleCache, SimpleCacheKeys, SimpleCacheTTL } from '@sports-bar/cache-manager'

async function getDeviceData(deviceId: string) {
  return await simpleCache.getOrSet(
    SimpleCacheKeys.deviceStatus(deviceId),
    async () => await pollDevice(deviceId),
    SimpleCacheTTL.MEDIUM
  )
}
```

### Sports Schedule with Type-Based Cache
```typescript
import { cacheManager } from '@sports-bar/cache-manager'

async function getSportsSchedule(league: string, date: string) {
  return await cacheManager.getOrSet(
    'sports-data',
    `${league}-${date}`,
    async () => await fetchSchedule(league, date)
  )
}
```

### Cache Invalidation
```typescript
// Simple - Clear specific pattern
simpleCache.clearPattern('^device:status:')

// Advanced - Clear all sports data
cacheManager.clearType('sports-data')

// Clear everything
simpleCache.clear()  // or cacheManager.clear()
```

---

## Migration Examples

### From Old cache-service.ts
```typescript
// OLD (deprecated)
import { cacheService, CacheTTL, CacheKeys } from '@/lib/cache-service'

// NEW (recommended)
import {
  simpleCache as cacheService,
  SimpleCacheTTL as CacheTTL,
  SimpleCacheKeys as CacheKeys
} from '@sports-bar/cache-manager'

// Or use bridge (temporary)
import { cacheService, CacheTTL, CacheKeys } from '@/lib/cache-service-bridge'
```

### Upgrading to CacheManager
```typescript
// Before (SimpleCache)
import { simpleCache, SimpleCacheTTL } from '@sports-bar/cache-manager'
simpleCache.set('sports:nfl:2025-01-15', data, SimpleCacheTTL.MEDIUM)
const result = simpleCache.get('sports:nfl:2025-01-15')

// After (CacheManager)
import { cacheManager } from '@sports-bar/cache-manager'
cacheManager.set('sports-data', 'nfl:2025-01-15', data)  // Auto TTL
const result = cacheManager.get('sports-data', 'nfl:2025-01-15')
```

---

## TypeScript Types

```typescript
import type { CacheEntry, CacheStats, CacheType } from '@sports-bar/cache-manager'

// Cache entry structure
interface CacheEntry<T = any> {
  key: string
  value: T
  expiresAt: number
  createdAt: number
  hits: number
  lastAccessed: number
  size: number
}

// Cache statistics
interface CacheStats {
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

// Cache types (for CacheManager)
type CacheType =
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
```

---

## Tips & Best Practices

### When to Use SimpleCache
✅ Prototyping or simple apps
✅ Need helper utilities (CacheKeys, CacheTTL)
✅ Don't need memory management
✅ Prefer regex pattern matching

### When to Use CacheManager
✅ Production applications
✅ Memory-constrained environments
✅ Need different configs per data type
✅ Want detailed monitoring/stats

### Performance Tips
- Use `getOrSet()` to avoid duplicate fetches
- Clear expired entries regularly (automatic cleanup runs periodically)
- Monitor cache stats in production
- Set appropriate TTLs per data type

### Memory Management
- **SimpleCache**: No limits - monitor manually
- **CacheManager**: Automatic LRU eviction when limits reached

### Error Handling
```typescript
try {
  const data = await simpleCache.getOrSet(
    'key',
    async () => {
      const response = await fetch('...')
      if (!response.ok) throw new Error('Fetch failed')
      return response.json()
    },
    SimpleCacheTTL.HOUR
  )
} catch (error) {
  // Handle fetch errors
  // Failed fetch won't be cached
}
```

---

## See Also

- Full Documentation: [README.md](./README.md)
- Migration Guide: [/CACHE_SERVICE_MIGRATION.md](../../CACHE_SERVICE_MIGRATION.md)
- Analysis Report: [/CACHE_ANALYSIS_REPORT.md](../../CACHE_ANALYSIS_REPORT.md)
