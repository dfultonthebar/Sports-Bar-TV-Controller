# @sports-bar/config

Centralized configuration management for the Sports Bar TV Controller monorepo. Validation schemas, rate limiting policies, Fire TV defaults, and configuration change tracking — framework-agnostic so any package or app can consume.

## Exports

```typescript
// Validation schemas (re-exported from @sports-bar/validation)
import { z, uuidSchema, deviceIdSchema } from '@sports-bar/config/validation'

// Rate limiting policies
import { RATE_LIMIT_POLICIES, getRateLimitForEndpoint } from '@sports-bar/config'

// Fire TV configuration
import { getFireTVConfig, calculateBackoffDelay } from '@sports-bar/config'

// Configuration change tracking
import {
  ConfigChangeTracker,
  createConfigChangeTracker,
  type ConfigChangeEvent
} from '@sports-bar/config'
```

## ConfigChangeTracker

- File-system watcher → monitors config files for changes.
- SHA-256 checksums detect modifications precisely.
- Integrates with auto-sync → triggers GitHub commits when ops change.
- Dependency injection: logger + HTTP client passed in (no global imports).
- Framework-agnostic — no Next.js dependencies, usable from any package.

## Bridge Pattern (apps consuming the tracker)

Apps don't import `ConfigChangeTracker` directly. They use a bridge file (e.g. `apps/web/src/lib/config-change-tracker.ts`) that:

1. Imports the core implementation from `@sports-bar/config`.
2. Provides app-specific adapters (logger instance, auto-sync HTTP client).
3. Exports a configured singleton.
4. Maintains backward compatibility with existing import sites.

This keeps the package framework-agnostic while letting each app inject its own infrastructure.
