# @sports-bar/logger

Comprehensive logging utilities for Sports Bar TV Controller, providing both basic console logging and enhanced file-based logging with analytics.

## Features

### Basic Logger
- Colored console output with timestamps
- Category-based logging (DATABASE, API, ATLAS, NETWORK, AUTH, SYSTEM, CACHE)
- Log level filtering (DEBUG, INFO, WARN, ERROR, SUCCESS)
- Specialized logging methods for different subsystems
- Safe circular reference handling

### Enhanced Logger
- File-based logging with automatic rotation
- Log analytics and insights
- Performance monitoring
- User interaction tracking
- Hardware operation logging
- Security event logging
- React hooks for client-side logging
- Log export functionality

## Installation

This is an internal package in the Sports Bar TV Controller monorepo.

```bash
npm install @sports-bar/logger
```

## Usage

### Basic Logger

```typescript
import { logger, LogCategory } from '@sports-bar/logger'

// Generic logging
logger.info('Application started')
logger.error('Something went wrong', { error: new Error('test') })

// Database logging
logger.database.query('SELECT', 'users', { userId: 123 })
logger.database.success('INSERT', 'users', { id: 1 })
logger.database.error('DELETE', 'users', new Error('Permission denied'))

// API logging
logger.api.request('GET', '/api/devices')
logger.api.response('GET', '/api/devices', 200, { count: 5 })
logger.api.error('POST', '/api/devices', new Error('Validation failed'))

// Atlas processor logging
logger.atlas.connect('192.168.1.100', 2001)
logger.atlas.command('GET_LEVELS', { zone: 1 })
logger.atlas.response('GET_LEVELS', { level: -20 })

// System logging
logger.system.startup('WebServer')
logger.system.ready('Database')
logger.system.error('Authentication', new Error('Token expired'))

// Cache logging
logger.cache.hit('user:123')
logger.cache.miss('user:456')
logger.cache.set('user:789', 3600)
```

### Enhanced Logger

```typescript
import { enhancedLogger, useLogger } from '@sports-bar/logger'

// Server-side logging
await enhancedLogger.logUserInteraction('button_click', { button: 'power' }, userId, sessionId)

await enhancedLogger.logHardwareOperation(
  'directv',
  'device-123',
  'channel_change',
  true,
  { channel: 205 },
  150 // duration in ms
)

await enhancedLogger.logAPICall('/api/devices', 'GET', 200, 45, { deviceCount: 5 })

await enhancedLogger.logConfigurationChange(
  'audio',
  'volume',
  50,
  75,
  userId
)

await enhancedLogger.logPerformanceMetric('database_query', 250, { query: 'SELECT * FROM devices' })

await enhancedLogger.logSecurityEvent(
  'failed_login_attempt',
  'warn',
  { username: 'admin' },
  '192.168.1.50',
  'Mozilla/5.0...'
)

// Get analytics
const analytics = await enhancedLogger.getLogAnalytics(24, 'api')
console.log('Error rate:', analytics.errorRate)
console.log('Top errors:', analytics.topErrors)
console.log('Recommendations:', analytics.recommendations)

// Export logs
const exportData = await enhancedLogger.exportLogsForDownload(24, 'hardware')
// Save exportData.content to file

// Cleanup old logs
await enhancedLogger.cleanupOldLogs(30) // Keep 30 days
```

### React Hook (Client-side)

```typescript
import { useLogger } from '@sports-bar/logger'

function MyComponent() {
  const { logUserAction, logError, logPerformance } = useLogger()

  const handleClick = () => {
    logUserAction('button_click', { button: 'submit' })
  }

  const handleError = (error: Error) => {
    logError(error, 'MyComponent')
  }

  const handleExpensiveOperation = async () => {
    const startTime = Date.now()
    await doSomething()
    logPerformance('expensive_operation', startTime, { items: 100 })
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## Log Categories

### Basic Logger
- `DATABASE` - Database operations
- `API` - API requests/responses
- `ATLAS` - AtlasIED processor operations
- `NETWORK` - Network requests
- `AUTH` - Authentication events
- `SYSTEM` - System events
- `CACHE` - Cache operations

### Enhanced Logger
- `user_interaction` - User actions and interactions
- `system` - System events and status
- `api` - API calls and responses
- `hardware` - Hardware device operations
- `configuration` - Configuration changes
- `performance` - Performance metrics
- `security` - Security events
- `cec` - HDMI-CEC operations

## Log Levels

- `DEBUG` - Detailed debugging information
- `INFO` - General information
- `WARN` - Warning messages
- `ERROR` - Error messages
- `SUCCESS` - Success messages
- `CRITICAL` - Critical errors (enhanced logger only)

## Environment Variables

- `LOG_LEVEL` - Minimum log level to output (default: `DEBUG` in development, `INFO` in production)
- `NODE_ENV` - Environment mode (`development` or `production`)

## Log File Management

Enhanced logger creates the following log files in the `logs/` directory:

- `all-operations.log` - All log entries
- `system-errors.log` - Error and critical logs only
- `user-interactions.log` - User interaction logs
- `system-events.log` - System event logs
- `api-calls.log` - API call logs
- `hardware-operations.log` - Hardware operation logs
- `configuration-changes.log` - Configuration change logs
- `performance-metrics.log` - Performance metric logs
- `security-events.log` - Security event logs
- `cec-operations.log` - CEC operation logs

### Log Rotation

- Maximum file size: 50MB
- Maximum rotated files: 10
- Files are automatically rotated when size limit is reached
- Old logs are automatically cleaned up based on retention period

## Analytics

Enhanced logger provides comprehensive analytics:

- Total log count
- Error rate
- Performance metrics (average response time, slowest operations)
- Top errors with frequency
- User activity patterns
- Device usage and error rates
- Time-based activity patterns
- AI-generated recommendations

## Type Exports

```typescript
import type {
  Logger,
  LogLevel,
  LogCategory,
  EnhancedLogger,
  EnhancedLogLevel,
  EnhancedLogCategory,
  DeviceType,
  EnhancedLogEntry,
  LogAnalytics
} from '@sports-bar/logger'
```

## Migration from V1

If you're migrating from the old V1 logger:

```typescript
// Old import (still works via bridge file)
import { enhancedLogger } from '@/lib/enhanced-logger'

// New import (recommended)
import { enhancedLogger } from '@sports-bar/logger'
```

Both imports work identically thanks to the bridge file in `src/lib/enhanced-logger.ts`.

## License

Internal package for Sports Bar TV Controller
