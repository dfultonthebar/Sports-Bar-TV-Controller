# App Discovery Migration Summary

## Overview

The `app-discovery.ts` module has been successfully extracted from `apps/web/src/lib/firecube/` to the `@sports-bar/firecube` package.

## Changes Made

### 1. Created Package Module
**File**: `/packages/firecube/src/app-discovery.ts` (373 lines)

- Extracted core `AppDiscoveryService` class with dependency injection
- Added repository interfaces for database operations
- Added device repository interface for app launching
- Added logger interface for pluggable logging
- Reused `ConnectionManagerAdapter` from `scheduler-types.ts`
- All business logic preserved

**Key Features**:
- `discoverApps()` - Discover installed apps on Fire TV devices
- `syncAppsToDatabase()` - Sync discovered apps to database
- `getDeviceApps()` - Get apps for a device from database
- `getAllSportsApps()` - Get all sports apps across devices
- `launchApp()` - Launch app on device
- `stopApp()` - Stop app on device
- `getAppIcon()` - Get app icon URL from known sports apps

### 2. Updated Scheduler Types
**File**: `/packages/firecube/src/scheduler-types.ts`

Added fields to `KnownSportsApp` interface:
- `category?: string` - App category (e.g., "Sports")
- `iconUrl?: string` - Icon URL for UI display

Updated `KNOWN_SPORTS_APPS` constant with category and iconUrl for all apps:
- ESPN: `/icons/espn.png`
- MLB.TV: `/icons/mlb.png`
- NFHS Network: `/icons/nfhs.png`
- FOX Sports: `/icons/foxsports.png`
- NBA: `/icons/nba.png`
- NFL+: `/icons/nfl.png`

### 3. Updated Package Exports
**File**: `/packages/firecube/src/index.ts`

Added exports:
```typescript
export {
  AppDiscoveryService,
  createAppDiscoveryService,
  type AppDiscoveryConfig,
  type AppDiscoveryRepository,
  type AppDiscoveryDeviceRepository,
  type AppDiscoveryLogger,
  type InstalledApp
} from './app-discovery'
```

### 4. Created Bridge File
**File**: `/apps/web/src/lib/firecube/app-discovery.ts` (162 lines)

Replaced original implementation with:
- Database adapters for `AppDiscoveryRepository` and `AppDiscoveryDeviceRepository`
- Connection manager adapter
- Logger adapter
- Singleton instance with all adapters pre-configured
- Re-exports for backward compatibility

**Backward Compatibility**:
- All existing imports work without changes
- Singleton instance available as `appDiscoveryService`
- Class available for testing as `AppDiscoveryService`
- All types re-exported

## Architecture

### Dependency Injection Pattern

The package uses constructor injection to decouple from specific implementations:

```typescript
interface AppDiscoveryConfig {
  connectionManager: ConnectionManagerAdapter
  appRepository: AppDiscoveryRepository
  deviceRepository: AppDiscoveryDeviceRepository
  logger?: AppDiscoveryLogger
  knownSportsApps?: KnownSportsApp[]
}
```

### Bridge Pattern

The web app bridge provides adapters that implement the package interfaces:

```typescript
// Database adapter
class DatabaseAppRepository implements AppDiscoveryRepository {
  // Uses Drizzle ORM via db-helpers
}

// Device adapter
class DatabaseDeviceRepository implements AppDiscoveryDeviceRepository {
  // Uses Drizzle ORM via db-helpers
}

// Pre-configured singleton
const appDiscoveryService = createAppDiscoveryService({
  connectionManager: connectionManagerAdapter,
  appRepository: new DatabaseAppRepository(),
  deviceRepository: new DatabaseDeviceRepository(),
  logger: loggerAdapter
})
```

## Benefits

### 1. Reusability
- Can be used in other applications without Next.js/Drizzle dependencies
- Can be used in CLI tools, background services, etc.

### 2. Testability
- Easy to mock repositories and connection manager
- No database required for unit tests
- Can test business logic in isolation

### 3. Maintainability
- Single source of truth in package
- Clear separation of concerns
- Explicit dependencies via interfaces

### 4. Flexibility
- Can swap database implementations
- Can use different connection managers
- Can customize logging

## Usage

### In Web App (Existing Code)

No changes required! The bridge provides backward compatibility:

```typescript
import { appDiscoveryService } from '@/lib/firecube/app-discovery'

const apps = await appDiscoveryService.discoverApps(deviceId, ipAddress)
```

### In Other Apps

```typescript
import { createAppDiscoveryService } from '@sports-bar/firecube'

const service = createAppDiscoveryService({
  connectionManager: myConnectionManager,
  appRepository: myAppRepository,
  deviceRepository: myDeviceRepository
})

const apps = await service.discoverApps(deviceId, ipAddress)
```

## Testing

### Before (Tightly Coupled)

```typescript
// Had to mock database, logger, connection manager globally
import { AppDiscoveryService } from '@/lib/firecube/app-discovery'

jest.mock('@/db')
jest.mock('@/lib/logger')
jest.mock('@/services/firetv-connection-manager')

const service = new AppDiscoveryService()
```

### After (Dependency Injection)

```typescript
// Only mock what you need
import { createAppDiscoveryService } from '@sports-bar/firecube'

const mockRepository = { /* ... */ }
const mockConnectionManager = { /* ... */ }

const service = createAppDiscoveryService({
  connectionManager: mockConnectionManager,
  appRepository: mockRepository,
  deviceRepository: mockDeviceRepository
})

// Test in isolation
```

## Files Modified

1. **New**: `/packages/firecube/src/app-discovery.ts`
2. **Modified**: `/packages/firecube/src/scheduler-types.ts`
3. **Modified**: `/packages/firecube/src/index.ts`
4. **Replaced**: `/apps/web/src/lib/firecube/app-discovery.ts`
5. **New**: `/packages/firecube/README-APP-DISCOVERY.md`
6. **New**: `/packages/firecube/MIGRATION-APP-DISCOVERY.md` (this file)

## Breaking Changes

**None** - The bridge file maintains full backward compatibility with existing code.

## Next Steps

1. Review and test the changes
2. Run the application to verify functionality
3. Consider extracting other firecube modules using the same pattern
4. Add unit tests for the package module

## Related Packages

The app-discovery module works alongside:
- `keep-awake-scheduler.ts` - Keep devices awake during business hours
- `subscription-detector.ts` - Detect active subscriptions
- `sideload-service.ts` - Sideload apps between devices
- `sports-content-detector.ts` - Detect sports content

All use the same dependency injection pattern.
