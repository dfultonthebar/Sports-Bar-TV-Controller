# Rate Limiting and Streaming API Documentation

## Overview

The Sports Bar TV Controller now includes comprehensive rate limiting and streaming support for all AI and sports API endpoints. This documentation covers:

1. Rate limiting for API endpoints
2. Request throttling for external APIs
3. Streaming support for AI chat
4. Configuration and customization
5. Monitoring and metrics

---

## Table of Contents

- [Rate Limiting](#rate-limiting)
- [Request Throttling](#request-throttling)
- [Streaming Support](#streaming-support)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Monitoring](#monitoring)

---

## Rate Limiting

### Overview

Rate limiting is implemented using a **sliding window algorithm** that tracks requests per IP address. All rate limit data is stored in memory with automatic cleanup to prevent memory leaks.

### Features

- **Per-IP tracking**: Each client IP is tracked independently
- **Sliding window**: More accurate than fixed windows
- **Automatic cleanup**: Expired entries are removed every 5 minutes
- **Configurable limits**: Different limits for different endpoint types
- **Standard headers**: Responses include X-RateLimit-* headers

### Rate Limit Policies

| Endpoint Type | Max Requests | Window | Use Cases |
|--------------|--------------|--------|-----------|
| **DEFAULT** | 10 req/min | 60s | General API endpoints |
| **AI** | 5 req/min | 60s | AI chat, analysis |
| **SPORTS** | 20 req/min | 60s | Sports data, schedules |
| **EXPENSIVE** | 2 req/min | 60s | Backups, rebuilds |
| **DEVICE_CONTROL** | 30 req/min | 60s | TV/audio control |
| **LOGGING** | 15 req/min | 60s | Log endpoints |

### Response Headers

All rate-limited endpoints return these headers:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1699564800000
```

### 429 Too Many Requests Response

When rate limit is exceeded:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "limit": 5,
  "current": 6,
  "resetTime": 1699564800000,
  "resetIn": "42 seconds"
}
```

Headers include:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699564800000
```

### Implementation

#### Adding Rate Limiting to an API Route

```typescript
import { withRateLimit } from '@/lib/rate-limiting/middleware'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitCheck = await withRateLimit(request, 'AI')

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!
  }

  // Your endpoint logic here...

  const response = NextResponse.json({ success: true })
  return addRateLimitHeaders(response, rateLimitCheck.result)
}
```

#### Custom Rate Limits

```typescript
const customLimit = await withRateLimit(request, {
  maxRequests: 100,
  windowMs: 60000,
  identifier: 'custom-endpoint'
})
```

---

## Request Throttling

### Overview

Request throttling controls the rate of **outgoing** requests to external APIs (ESPN, TheSportsDB, Ollama) to avoid hitting their rate limits.

### Features

- **Request queuing**: Queues requests when limits are reached
- **Concurrent control**: Limits simultaneous requests
- **Exponential backoff**: Automatic retry with increasing delays
- **Per-service metrics**: Track success/failure rates
- **Automatic retry**: Failed requests are retried up to 3 times

### Throttling Policies

| Service | Requests/sec | Max Concurrent | Max Retries | Initial Backoff | Max Backoff |
|---------|--------------|----------------|-------------|-----------------|-------------|
| **ESPN** | 2/sec | 3 | 3 | 1s | 10s |
| **TheSportsDB** | 1/sec | 2 | 3 | 2s | 15s |
| **Ollama** | 1/sec | 1 | 2 | 0.5s | 5s |
| **Rail Media** | 2/sec | 3 | 3 | 1s | 10s |

### Usage

#### ESPN API

```typescript
import { espnAPI } from '@/lib/sports-apis/espn-api'

// Automatically throttled
const games = await espnAPI.getNFLGames('2024-11-15')

// Get throttling metrics
const metrics = espnAPI.getMetrics()
console.log(metrics.totalRequests, metrics.successfulRequests)
```

#### TheSportsDB API

```typescript
import { sportsDBAPI } from '@/lib/sports-apis/thesportsdb-api'

// Automatically throttled
const events = await sportsDBAPI.getPremierLeagueEvents('2024-11-15')

// Get throttling metrics
const metrics = sportsDBAPI.getMetrics()
```

#### Direct Throttler Usage

```typescript
import { espnThrottler } from '@/lib/rate-limiting/request-throttler'

const result = await espnThrottler.execute(
  async () => {
    return await fetch('https://api.example.com/data')
  },
  'my-service'
)
```

### Retry Logic

The throttler automatically retries failed requests with exponential backoff:

1. **First retry**: Wait 1 second (configurable)
2. **Second retry**: Wait 2 seconds
3. **Third retry**: Wait 4 seconds
4. **Max retries reached**: Request fails

Backoff formula: `min(initialBackoff * 2^(retryCount - 1), maxBackoff)`

---

## Streaming Support

### Overview

The AI chat endpoint now supports **Server-Sent Events (SSE)** for real-time streaming responses.

### Features

- **Real-time streaming**: See AI responses as they're generated
- **Status updates**: Receive status messages during processing
- **Error handling**: Graceful error messages via SSE
- **Cancellation**: Cancel streaming requests mid-stream
- **Toggle mode**: Switch between streaming and non-streaming

### Frontend Usage

#### Enabling Streaming

The EnhancedAIChat component includes a toggle for streaming mode:

```typescript
const [streamingEnabled, setStreamingEnabled] = useState(true)
```

Users can toggle between:
- **Streaming ON**: Responses stream in real-time
- **Streaming OFF**: Wait for complete responses

#### Streaming Request

```typescript
const response = await fetch('/api/ai/enhanced-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Your question here',
    stream: true,
    useKnowledge: true,
    useCodebase: true
  }),
  signal: abortController.signal
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })
  // Process SSE data...
}
```

### SSE Message Types

#### Status Message
```json
{
  "type": "status",
  "message": "Building context..."
}
```

#### Context Status
```json
{
  "type": "context",
  "usedContext": true,
  "contextError": null
}
```

#### Token (Streaming Content)
```json
{
  "type": "token",
  "content": "This is a "
}
```

#### Done
```json
{
  "type": "done",
  "model": "llama3.2:3b",
  "usedContext": true,
  "usedCodebase": true,
  "usedKnowledge": true,
  "contextError": null
}
```

#### Error
```json
{
  "type": "error",
  "error": "Connection to Ollama failed"
}
```

### Cancelling Streaming Requests

```typescript
const abortController = new AbortController()

// Start request with abort signal
fetch('/api/ai/enhanced-chat', {
  signal: abortController.signal,
  // ... other options
})

// Cancel the request
abortController.abort()
```

---

## Configuration

### Environment Variables

Create or update your `.env.local` file:

```bash
# Rate Limiting
RATE_LIMITING_ENABLED=true
API_THROTTLING_ENABLED=true
LOG_RATE_LIMIT_VIOLATIONS=true
COLLECT_RATE_LIMIT_METRICS=true

# Development Mode (disable limits in dev)
DISABLE_RATE_LIMITS_IN_DEV=false

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
```

### Configuration File

All rate limits are configured in `/src/config/rate-limits.config.ts`:

```typescript
export const RATE_LIMIT_POLICIES = {
  AI: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    identifier: 'ai',
    description: 'AI chat and analysis endpoints'
  },
  // ... other policies
}
```

### Customizing Limits

#### Option 1: Modify Config File

Edit `/src/config/rate-limits.config.ts`:

```typescript
AI: {
  maxRequests: 10,  // Increase from 5 to 10
  windowMs: 60 * 1000,
  identifier: 'ai'
}
```

#### Option 2: Runtime Configuration

```typescript
import { rateLimiter } from '@/lib/rate-limiting/rate-limiter'

// Reset limits for specific IP
rateLimiter.reset('192.168.1.100', 'ai')

// Clear all limits
rateLimiter.clearAll()
```

---

## Testing

### Testing Rate Limits

#### Test Script

```bash
# Test AI endpoint rate limit (5 requests/min)
for i in {1..10}; do
  echo "Request $i"
  curl -X POST http://localhost:3000/api/ai/enhanced-chat \
    -H "Content-Type: application/json" \
    -d '{"message":"Test","stream":false}' \
    -i | grep -E "HTTP|X-RateLimit"
  sleep 1
done
```

Expected output:
```
Request 1: HTTP/1.1 200 OK, X-RateLimit-Remaining: 4
Request 2: HTTP/1.1 200 OK, X-RateLimit-Remaining: 3
Request 3: HTTP/1.1 200 OK, X-RateLimit-Remaining: 2
Request 4: HTTP/1.1 200 OK, X-RateLimit-Remaining: 1
Request 5: HTTP/1.1 200 OK, X-RateLimit-Remaining: 0
Request 6: HTTP/1.1 429 Too Many Requests
```

### Testing Streaming

#### cURL Test

```bash
curl -X POST http://localhost:3000/api/ai/enhanced-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain rate limiting",
    "stream": true,
    "useKnowledge": false,
    "useCodebase": false
  }' \
  --no-buffer
```

Expected output:
```
data: {"type":"status","message":"Building context..."}

data: {"type":"context","usedContext":false,"contextError":null}

data: {"type":"status","message":"Generating response..."}

data: {"type":"token","content":"Rate"}

data: {"type":"token","content":" limiting"}

data: {"type":"done","model":"llama3.2:3b",...}
```

### Frontend Testing

1. Navigate to AI Hub page
2. Toggle **Streaming Mode ON**
3. Send a message
4. Observe real-time response streaming
5. Test cancel button during streaming
6. Toggle **Streaming Mode OFF**
7. Verify complete responses

### Load Testing

```typescript
// test-rate-limits.ts
import { withRateLimit } from '@/lib/rate-limiting/middleware'

async function testRateLimits() {
  const mockIP = '192.168.1.100'
  const results = []

  for (let i = 0; i < 10; i++) {
    const mockRequest = {
      headers: { get: () => mockIP }
    } as any

    const result = await withRateLimit(mockRequest, 'AI')
    results.push({
      attempt: i + 1,
      allowed: result.allowed,
      remaining: result.result.remaining
    })
  }

  console.table(results)
}
```

---

## Troubleshooting

### Common Issues

#### 1. Rate Limit Not Working

**Symptom**: No 429 responses even after many requests

**Solutions**:
- Check `RATE_LIMITING_ENABLED` environment variable
- Verify rate limit middleware is imported
- Check if development overrides are active
- Clear rate limit cache: `rateLimiter.clearAll()`

#### 2. Streaming Not Working

**Symptom**: No streaming data received

**Solutions**:
- Verify `stream: true` in request body
- Check Ollama service is running
- Look for CORS issues in browser console
- Verify response Content-Type is `text/event-stream`

#### 3. Throttling Too Aggressive

**Symptom**: Requests take too long to complete

**Solutions**:
- Adjust `requestsPerSecond` in config
- Increase `maxConcurrent` for the service
- Check throttler metrics: `espnAPI.getMetrics()`
- Clear throttler queue if stuck

#### 4. Memory Issues

**Symptom**: Memory usage growing over time

**Solutions**:
- Verify cleanup is running (check logs)
- Reduce `ENTRY_MAX_AGE_MS` for faster cleanup
- Set `MAX_IPS_TRACKED` limit
- Restart application to clear memory

### Debug Mode

Enable verbose logging:

```typescript
// In your API route
console.log('[RateLimit]', rateLimitCheck)
console.log('[Throttler]', espnThrottler.getStatus())
```

### Reset Rate Limits

```typescript
import { rateLimiter } from '@/lib/rate-limiting/rate-limiter'

// Reset specific IP for specific endpoint
rateLimiter.reset('192.168.1.100', 'ai')

// Reset all limits for an endpoint
rateLimiter.resetAll('ai')

// Clear everything
rateLimiter.clearAll()
```

---

## Monitoring

### Rate Limit Metrics

#### Get Statistics

```typescript
import { rateLimiter } from '@/lib/rate-limiting/rate-limiter'

const stats = rateLimiter.getStats()
console.log({
  totalIdentifiers: stats.totalIdentifiers,
  totalIPs: stats.totalIPs,
  memoryUsage: stats.memoryUsage
})
```

### Throttler Metrics

#### ESPN API Metrics

```typescript
import { espnAPI } from '@/lib/sports-apis/espn-api'

const metrics = espnAPI.getMetrics()
console.log({
  totalRequests: metrics.totalRequests,
  successfulRequests: metrics.successfulRequests,
  failedRequests: metrics.failedRequests,
  totalRetries: metrics.totalRetries,
  averageResponseTime: metrics.averageResponseTime
})
```

#### All Services

```typescript
import { espnThrottler, sportsDBThrottler, ollamaThrottler } from '@/lib/rate-limiting/request-throttler'

console.log('ESPN:', espnThrottler.getAllMetrics())
console.log('SportsDB:', sportsDBThrottler.getAllMetrics())
console.log('Ollama:', ollamaThrottler.getAllMetrics())
```

### Logging

Rate limit violations are logged when `LOG_RATE_LIMIT_VIOLATIONS=true`:

```
[RateLimit] Rate limit exceeded for IP 192.168.1.100 on endpoint ai
  Limit: 5 requests/minute
  Current: 6 requests
  Reset in: 42 seconds
```

Throttler retries are logged:

```
[RequestThrottler] Request to espn-api failed, retrying in 1000ms (attempt 2/4)
```

---

## API Reference

### Rate Limiter

```typescript
import { rateLimiter, RateLimitConfig } from '@/lib/rate-limiting/rate-limiter'

// Check rate limit
const result = rateLimiter.checkLimit(ip: string, config: RateLimitConfig)

// Reset limits
rateLimiter.reset(ip: string, identifier: string)
rateLimiter.resetAll(identifier: string)
rateLimiter.clearAll()

// Get statistics
const stats = rateLimiter.getStats()
```

### Middleware

```typescript
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limiting/middleware'

// Apply rate limiting
const check = await withRateLimit(request, 'AI')

// Add headers to response
addRateLimitHeaders(response, check.result)
```

### Request Throttler

```typescript
import { RequestThrottler, ThrottleConfig } from '@/lib/rate-limiting/request-throttler'

const throttler = new RequestThrottler(config)

// Execute throttled request
await throttler.execute(() => fetch(...), 'service-name')

// Get metrics
throttler.getMetrics('service-name')
throttler.getAllMetrics()

// Get status
throttler.getStatus()
```

---

## Best Practices

1. **Choose Appropriate Limits**
   - Start conservative, increase if needed
   - Monitor metrics to find optimal values
   - Different limits for different use cases

2. **Handle 429 Responses**
   - Show user-friendly error messages
   - Display retry time from headers
   - Implement exponential backoff on client

3. **Monitor Metrics**
   - Track rate limit violations
   - Monitor throttler retry rates
   - Watch memory usage over time

4. **Test Before Deployment**
   - Load test with realistic traffic
   - Verify rate limits work correctly
   - Test streaming under load

5. **Document Custom Limits**
   - Document any custom rate limits
   - Explain why limits were chosen
   - Keep configuration in version control

---

## Files Modified/Created

### New Files
- `/src/lib/rate-limiting/rate-limiter.ts` - Core rate limiting service
- `/src/lib/rate-limiting/middleware.ts` - Next.js middleware helpers
- `/src/lib/rate-limiting/request-throttler.ts` - External API throttling
- `/src/config/rate-limits.config.ts` - Centralized configuration
- `/docs/RATE_LIMITING_AND_STREAMING.md` - This documentation

### Modified Files
- `/src/app/api/ai/enhanced-chat/route.ts` - Added rate limiting and improved streaming
- `/src/components/EnhancedAIChat.tsx` - Added streaming UI and toggle
- `/src/lib/sports-apis/espn-api.ts` - Added request throttling
- `/src/lib/sports-apis/thesportsdb-api.ts` - Added request throttling
- `/src/app/api/sports-guide/route.ts` - Added rate limiting

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review configuration in `/src/config/rate-limits.config.ts`
3. Check server logs for rate limit violations
4. Monitor metrics for anomalies

---

**Last Updated**: November 2, 2025
**Version**: 1.0.0
