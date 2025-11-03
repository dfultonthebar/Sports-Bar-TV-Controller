# Logging Best Practices Guide

**Quick Reference for Developers**

---

## Quick Start

### Import the Logger

```typescript
import { logger } from '@/lib/logger'
```

### Basic Usage

```typescript
// Information
logger.info('Operation completed successfully')

// Warnings
logger.warn('Deprecated API endpoint used')

// Errors
logger.error('Failed to connect to device', { error: err })

// Debug (development only)
logger.debug('Variable state', { userId, sessionId })
```

---

## When to Use Each Log Level

### 🔵 INFO - General Information

**Use for:**
- Normal application flow
- Successful operations
- Important state changes
- User actions

```typescript
logger.info('User logged in', { username, ip: req.ip })
logger.info('Configuration loaded', { configFile: 'matrix.json' })
logger.info('Server started', { port: 3000 })
```

### 🔴 ERROR - Errors & Failures

**Use for:**
- Exceptions and errors
- Failed operations
- Connection failures
- Invalid data

```typescript
try {
  await connectDevice()
} catch (err) {
  logger.error('Device connection failed', {
    deviceId,
    error: err.message,
    stack: err.stack
  })
}
```

### 🟡 WARN - Potential Issues

**Use for:**
- Deprecated features
- Recoverable errors
- Configuration issues
- Performance concerns

```typescript
logger.warn('Using deprecated API', {
  endpoint: '/old-api',
  replacement: '/v2/api'
})

logger.warn('Cache miss', { key: 'user-session' })
```

### 🔵 DEBUG - Development Details

**Use for:**
- Debugging information
- Verbose details
- Development-only logs
- Internal state

```typescript
logger.debug('Processing step', {
  step: 3,
  data: processedData,
  timestamp: Date.now()
})
```

---

## Adding Context with Structured Data

### ✅ GOOD Examples

```typescript
// Include relevant details
logger.info('Matrix switched', {
  deviceId: 'matrix-1',
  input: 3,
  output: 5,
  timestamp: Date.now()
})

// Error with full context
logger.error('Database query failed', {
  query: 'SELECT * FROM devices',
  error: err.message,
  stack: err.stack,
  duration: '5.2s'
})

// Performance logging
logger.info('Request processed', {
  method: 'POST',
  path: '/api/devices',
  duration: Date.now() - startTime,
  statusCode: 200
})
```

### ❌ BAD Examples

```typescript
// ❌ No context
logger.info('Done')

// ❌ String concatenation
logger.info('User ' + username + ' logged in at ' + time)

// ❌ Sensitive data
logger.info('Login', { username, password })  // Never log passwords!

// ❌ Too verbose
logger.debug('x=1')
logger.debug('y=2')
logger.debug('z=3')
```

---

## Specialized Logger Methods

### Database Operations

```typescript
import { logger, LogCategory } from '@/lib/logger'

// Query logging
logger.database.query('SELECT', 'devices', { where: { active: true } })

// Success logging
logger.database.success('INSERT', 'devices', result)

// Error logging
logger.database.error('UPDATE', 'devices', error)

// Connection status
logger.database.connection('connected', './data/sports-bar.db')
```

### API Operations

```typescript
// Request logging
logger.api.request('POST', '/api/matrix/config', requestBody)

// Response logging
logger.api.response('POST', '/api/matrix/config', 200, responseData)

// Error logging
logger.api.error('POST', '/api/matrix/config', error)
```

### Atlas Processor

```typescript
// Connection
logger.atlas.connect('192.168.1.100', 23)
logger.atlas.connected('192.168.1.100', 23)

// Commands
logger.atlas.command('SETGAIN', { input: 1, gain: -10 })
logger.atlas.response('SETGAIN', responseData)

// Errors
logger.atlas.error('connection', error)

// Disconnection
logger.atlas.disconnect('192.168.1.100', 23)
```

### Network Requests

```typescript
// Request
logger.network.request('https://api.example.com/data', 'GET')

// Response
logger.network.response('https://api.example.com/data', 200)

// Error
logger.network.error('https://api.example.com/data', error)
```

### Authentication

```typescript
// Login attempt
logger.auth.attempt('john.doe')

// Success
logger.auth.success('john.doe')

// Failure
logger.auth.failure('john.doe', 'Invalid password')

// Logout
logger.auth.logout('john.doe')
```

### System Events

```typescript
// Startup
logger.system.startup('Matrix Controller')

// Ready
logger.system.ready('Matrix Controller')

// Shutdown
logger.system.shutdown('Matrix Controller')

// Errors
logger.system.error('Matrix Controller', error)
```

### Cache Operations

```typescript
// Cache hit
logger.cache.hit('user-session-123')

// Cache miss
logger.cache.miss('user-session-123')

// Set cache
logger.cache.set('user-session-123', 3600)

// Invalidate
logger.cache.invalidate('user-session-123')
```

---

## Common Patterns

### API Route Logging

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    logger.info('API request received', {
      method: 'POST',
      path: '/api/devices',
      body
    })

    // ... process request ...

    logger.info('API request completed', {
      method: 'POST',
      path: '/api/devices',
      duration: Date.now() - startTime,
      statusCode: 200
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('API request failed', {
      method: 'POST',
      path: '/api/devices',
      error: err.message,
      stack: err.stack,
      duration: Date.now() - startTime
    })

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Service Function Logging

```typescript
import { logger } from '@/lib/logger'

export async function connectToDevice(deviceId: string, ipAddress: string) {
  logger.info('Connecting to device', { deviceId, ipAddress })

  try {
    const connection = await establishConnection(ipAddress)

    logger.info('Device connected successfully', {
      deviceId,
      ipAddress,
      connectionId: connection.id
    })

    return connection
  } catch (err) {
    logger.error('Device connection failed', {
      deviceId,
      ipAddress,
      error: err.message,
      stack: err.stack
    })

    throw err
  }
}
```

### Database Operation Logging

```typescript
import { logger } from '@/lib/logger'
import { db, schema } from '@/db'

export async function getDevices() {
  logger.database.query('SELECT', 'devices', {})

  try {
    const devices = await db.select()
      .from(schema.devices)
      .all()

    logger.database.success('SELECT', 'devices', devices)

    return devices
  } catch (err) {
    logger.database.error('SELECT', 'devices', err)
    throw err
  }
}
```

### Long-Running Operation Logging

```typescript
import { logger } from '@/lib/logger'

export async function processLargeDataset(datasetId: string) {
  const startTime = Date.now()
  let processedCount = 0

  logger.info('Starting dataset processing', { datasetId })

  try {
    for (const item of dataset) {
      await processItem(item)
      processedCount++

      // Log progress every 100 items
      if (processedCount % 100 === 0) {
        logger.debug('Processing progress', {
          datasetId,
          processed: processedCount,
          total: dataset.length,
          percentComplete: (processedCount / dataset.length * 100).toFixed(1)
        })
      }
    }

    logger.info('Dataset processing completed', {
      datasetId,
      totalProcessed: processedCount,
      duration: Date.now() - startTime
    })
  } catch (err) {
    logger.error('Dataset processing failed', {
      datasetId,
      processedCount,
      error: err.message,
      stack: err.stack,
      duration: Date.now() - startTime
    })

    throw err
  }
}
```

---

## Security Considerations

### ✅ Safe to Log

- User IDs
- Usernames (without PII)
- IP addresses (be mindful of privacy regulations)
- Request paths
- Response status codes
- Timestamps
- Device IDs
- Configuration values (non-sensitive)

### ❌ Never Log

- Passwords
- API keys
- Authentication tokens
- Credit card numbers
- Social security numbers
- Private encryption keys
- Session tokens
- OAuth secrets

### Example: Filtering Sensitive Data

```typescript
// ❌ BAD: Logging full request body with password
logger.info('User registration', { body: requestBody })

// ✅ GOOD: Excluding sensitive fields
const { password, ...safeData } = requestBody
logger.info('User registration', { data: safeData })

// ✅ GOOD: Explicit safe fields
logger.info('User registration', {
  username: requestBody.username,
  email: requestBody.email,
  // password intentionally excluded
})
```

---

## Performance Tips

### 1. Use Appropriate Log Levels

```typescript
// ✅ GOOD: Debug logs are cheap to disable
if (process.env.DEBUG) {
  logger.debug('Detailed state', { largeObject })
}

// ❌ BAD: Always serializing large objects
logger.info('State', { largeObject })
```

### 2. Avoid Expensive Operations in Logs

```typescript
// ❌ BAD: Expensive computation for logging
logger.debug('Data summary', {
  summary: data.map(item => expensiveTransform(item))
})

// ✅ GOOD: Log minimal data
logger.debug('Data summary', {
  count: data.length,
  firstItem: data[0]
})
```

### 3. Use Log Sampling for High-Volume Endpoints

```typescript
// Sample 10% of debug logs in production
if (process.env.NODE_ENV !== 'production' || Math.random() < 0.1) {
  logger.debug('High-volume endpoint hit', { details })
}
```

---

## Searching and Filtering Logs

### By Log Level

```bash
# View only errors
grep "ERROR" logs/app.log

# View warnings and errors
grep -E "(WARN|ERROR)" logs/app.log
```

### By Category

```bash
# View only database logs
grep "DATABASE" logs/app.log

# View only API logs
grep "API" logs/app.log
```

### By Timestamp

```bash
# Logs from specific time
grep "2025-11-03T12:" logs/app.log

# Logs from specific date
grep "2025-11-03" logs/app.log
```

### Structured Search (with jq if logs are JSON)

```bash
# If using JSON logging
cat logs/app.json | jq 'select(.level == "ERROR")'
cat logs/app.json | jq 'select(.deviceId == "matrix-1")'
cat logs/app.json | jq 'select(.duration > 1000)'
```

---

## Troubleshooting with Logs

### Finding Errors

```bash
# Recent errors
tail -f logs/app.log | grep ERROR

# Count errors by type
grep ERROR logs/app.log | cut -d':' -f2 | sort | uniq -c
```

### Tracing a Request

```bash
# Find all logs for a specific request
grep "requestId-123" logs/app.log
```

### Performance Analysis

```bash
# Find slow operations (duration > 1000ms)
grep "duration" logs/app.log | grep -E "duration.*[0-9]{4,}"
```

---

## Testing with Logs

### Verify Logs in Tests

```typescript
import { logger } from '@/lib/logger'

// Mock logger for testing
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))

test('should log error on failure', async () => {
  await expect(failingFunction()).rejects.toThrow()

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('failed'),
    expect.objectContaining({
      error: expect.any(String)
    })
  )
})
```

---

## Migration from Console

If you still have console.* statements, replace them:

```typescript
// ❌ Old way
console.log('User logged in')
console.error('Connection failed:', error)
console.warn('Deprecated API used')

// ✅ New way
logger.info('User logged in', { username })
logger.error('Connection failed', { error: error.message })
logger.warn('Deprecated API used', { endpoint: '/old-api' })
```

**Use the migration script:**
```bash
node scripts/migrate-to-logger.js --file path/to/file.ts
```

---

## Summary

### Key Principles

1. **Always add context** - Include relevant data with every log
2. **Use appropriate levels** - INFO for normal, ERROR for problems, DEBUG for details
3. **Structure your data** - Use objects, not string concatenation
4. **Never log secrets** - Filter sensitive data
5. **Be concise** - Log what's useful, not everything
6. **Think about searching** - Include fields you'll want to search by

### Quick Reference

| Situation | Method | Example |
|-----------|--------|---------|
| Normal operation | `logger.info()` | `logger.info('User logged in', { username })` |
| Error occurred | `logger.error()` | `logger.error('Failed', { error: err.message })` |
| Potential issue | `logger.warn()` | `logger.warn('Cache miss', { key })` |
| Debug details | `logger.debug()` | `logger.debug('State', { data })` |
| Database ops | `logger.database.*` | `logger.database.query('SELECT', 'users')` |
| API calls | `logger.api.*` | `logger.api.request('GET', '/api/users')` |

---

**For more details, see:** [LOGGING_MIGRATION_REPORT.md](./LOGGING_MIGRATION_REPORT.md)
