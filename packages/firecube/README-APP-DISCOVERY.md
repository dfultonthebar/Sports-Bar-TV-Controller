# App Discovery Service

## Overview

The `AppDiscoveryService` provides Fire TV/Cube application discovery and management capabilities with dependency injection support.

## Features

- **App Discovery**: Scan and discover all installed apps on Fire TV/Cube devices
- **Sports App Detection**: Automatically identify known sports streaming apps
- **Database Sync**: Synchronize app metadata with your database
- **App Lifecycle**: Launch and stop applications remotely
- **Dependency Injection**: Pluggable database, connection manager, and logger implementations

## Usage

### Basic Setup

```typescript
import {
  AppDiscoveryService,
  createAppDiscoveryService,
  type AppDiscoveryConfig,
  type ConnectionManagerAdapter,
  type AppDiscoveryRepository,
  type AppDiscoveryDeviceRepository
} from '@sports-bar/firecube'

// Create your adapters
const connectionManager: ConnectionManagerAdapter = {
  getOrCreateConnection: async (deviceId, ipAddress, port) => {
    // Your connection management logic
    return adbClient
  }
}

const appRepository: AppDiscoveryRepository = {
  findByDeviceId: async (deviceId) => { /* ... */ },
  create: async (app) => { /* ... */ },
  update: async (deviceId, packageName, updates) => { /* ... */ },
  delete: async (appId) => { /* ... */ },
  findAllSportsApps: async () => { /* ... */ }
}

const deviceRepository: AppDiscoveryDeviceRepository = {
  findById: async (deviceId) => { /* ... */ }
}

// Create service instance
const appDiscoveryService = createAppDiscoveryService({
  connectionManager,
  appRepository,
  deviceRepository,
  logger: myLogger // Optional
})
```

### Discover Apps

```typescript
const apps = await appDiscoveryService.discoverApps(
  'device-id',
  '192.168.1.100',
  5555
)

console.log(`Found ${apps.length} apps`)
```

### Sync to Database

```typescript
await appDiscoveryService.syncAppsToDatabase('device-id', apps)
```

### Launch App

```typescript
const success = await appDiscoveryService.launchApp(
  'device-id',
  'com.espn.score_center'
)
```

### Stop App

```typescript
const success = await appDiscoveryService.stopApp(
  'device-id',
  'com.espn.score_center'
)
```

### Get Device Apps

```typescript
const apps = await appDiscoveryService.getDeviceApps('device-id')
```

### Get All Sports Apps

```typescript
const sportsApps = await appDiscoveryService.getAllSportsApps()
```

## Interfaces

### AppDiscoveryRepository

```typescript
interface AppDiscoveryRepository {
  findByDeviceId(deviceId: string): Promise<FireCubeApp[]>
  create(app: Omit<FireCubeApp, 'id'> & { id: string }): Promise<void>
  update(deviceId: string, packageName: string, updates: Partial<FireCubeApp>): Promise<void>
  delete(appId: string): Promise<void>
  findAllSportsApps(): Promise<FireCubeApp[]>
}
```

### AppDiscoveryDeviceRepository

```typescript
interface AppDiscoveryDeviceRepository {
  findById(deviceId: string): Promise<{
    id: string
    ipAddress: string
    port: number
  } | null>
}
```

### AppDiscoveryLogger

```typescript
interface AppDiscoveryLogger {
  error(message: string, error?: any): void
  info?(message: string): void
  debug?(message: string): void
}
```

## Known Sports Apps

The service includes a built-in database of known sports streaming apps:

- ESPN (com.espn.score_center)
- MLB.TV (com.bamnetworks.mobile.android.gameday.atbat)
- NFHS Network (com.nfhs.network)
- FOX Sports (com.foxsports.android)
- NBA (com.nbaimd.gametime.nba2011)
- NFL+ (com.gotv.nflgamecenter.us.lite)

These apps are automatically tagged with `isSportsApp: true` during discovery.

## Migration from Web App

If you're migrating from the web app's built-in `AppDiscoveryService`:

### Before (apps/web)

```typescript
import { AppDiscoveryService } from '@/lib/firecube/app-discovery'

const service = new AppDiscoveryService()
await service.discoverApps(deviceId, ipAddress)
```

### After (using bridge)

The bridge file at `apps/web/src/lib/firecube/app-discovery.ts` provides a pre-configured singleton instance:

```typescript
import { appDiscoveryService } from '@/lib/firecube/app-discovery'

await appDiscoveryService.discoverApps(deviceId, ipAddress)
```

The bridge automatically wires up:
- Connection manager from `@/services/firetv-connection-manager`
- Database operations from `@/lib/db-helpers`
- Logger from `@/lib/logger`

No code changes required!

## Architecture

### Dependency Injection

The service uses constructor injection to allow testing and different implementations:

```typescript
export class AppDiscoveryService {
  constructor(config: AppDiscoveryConfig) {
    this.connectionManager = config.connectionManager
    this.appRepository = config.appRepository
    this.deviceRepository = config.deviceRepository
    this.logger = config.logger || this.createDefaultLogger()
    this.knownSportsApps = config.knownSportsApps || KNOWN_SPORTS_APPS
  }
}
```

### Connection Reuse

The service uses the connection manager to reuse ADB connections:

```typescript
const client = await this.connectionManager.getOrCreateConnection(
  deviceId,
  ipAddress,
  port
)
```

Connections are never closed by the service - the connection manager handles lifecycle.

### Sports App Detection

Apps are matched against the `KNOWN_SPORTS_APPS` database:

```typescript
const knownApp = this.knownSportsApps.find(
  (app) => app.packageName === packageName
)

const app: FireCubeApp = {
  // ...
  isSportsApp: !!knownApp,
  category: knownApp?.category || 'Other'
}
```

## Testing

### Mock Implementation

```typescript
const mockRepository: AppDiscoveryRepository = {
  findByDeviceId: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  findAllSportsApps: jest.fn().mockResolvedValue([])
}

const service = createAppDiscoveryService({
  connectionManager: mockConnectionManager,
  appRepository: mockRepository,
  deviceRepository: mockDeviceRepository
})

await service.discoverApps('test-device', '192.168.1.100')

expect(mockRepository.create).toHaveBeenCalled()
```

## Error Handling

The service logs errors but returns empty arrays or false on failure:

```typescript
try {
  const apps = await this.appRepository.findByDeviceId(deviceId)
  return apps
} catch (error) {
  this.logger.error('Failed to get device apps:', error)
  return []
}
```

This ensures graceful degradation when database or network issues occur.
