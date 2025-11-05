# CEC Async Discovery Implementation

## Overview

This document describes the implementation of asynchronous CEC (Consumer Electronics Control) discovery with background job tracking to handle long-running TV discovery scans without HTTP timeout issues.

## Problem Statement

CEC discovery scans all active matrix outputs (typically 29-30 outputs) at approximately 10 seconds per output, resulting in a total scan time of 4-5 minutes. This causes HTTP timeout issues for clients waiting for synchronous responses.

## Solution Architecture

### Async Job System

The solution implements an asynchronous discovery system where:

1. **POST** starts discovery in background and returns immediately with a job ID
2. **GET** with job ID checks progress and returns results when complete
3. Progress tracking shows how many outputs have been scanned
4. Results are stored and retrievable after completion
5. Jobs auto-cleanup after 1 hour to prevent memory leaks

### Components

#### 1. Job Tracker Service (`/src/lib/services/job-tracker.ts`)

A simple in-memory job tracking system that manages long-running background tasks.

**Features:**
- In-memory storage (can be upgraded to database if persistence is needed)
- Progress tracking with current/total/message
- Job status: `running`, `completed`, `failed`
- Automatic cleanup of old jobs (1 hour after completion)
- Support for multiple job types (`cec-discovery`, `health-check`, `other`)

**Key Methods:**
```typescript
createJob(type, total, initialMessage) -> jobId
updateProgress(jobId, current, message)
completeJob(jobId, result)
failJob(jobId, error)
getJob(jobId) -> Job
```

**Auto-Cleanup:**
- Jobs are automatically cleaned up 1 hour after completion
- Cleanup runs every 10 minutes
- Prevents memory leaks from accumulating old job data

#### 2. CEC Discovery Service (`/src/lib/services/cec-discovery-service.ts`)

Enhanced to support progress callbacks during discovery.

**Changes:**
- Added optional `onProgress` callback parameter to `discoverAllTVBrands()`
- Callback signature: `(current: number, total: number, message: string) => void`
- Reports progress after each output is scanned
- Progress message includes output number and label

#### 3. CEC Discovery API (`/src/app/api/cec/discovery/route.ts`)

Updated POST endpoint with async support.

**Request Options:**
```typescript
{
  outputNumber?: number,  // Optional: discover specific output only
  async?: boolean         // Optional: run in background (default: true for all outputs)
}
```

**Behavior:**
- Single output discovery: Always synchronous (fast, 10-15 seconds)
- All outputs discovery: Default to async mode
- Async mode: Returns job ID immediately
- Sync mode: Waits for completion (backward compatible)

#### 4. Status Check Endpoint (`/src/app/api/cec/discovery/status/route.ts`)

New endpoint for checking async job status.

**Query Parameters:**
- `jobId` (required): Job ID returned from POST request

**Response Fields:**
- `job.status`: Current status (`running`, `completed`, `failed`)
- `job.progress`: Progress information (current, total, percentage, message)
- `job.result`: Discovery results (only when completed)
- `job.error`: Error message (only when failed)
- `job.duration`: Time elapsed since job started
- `job.summary`: Summary statistics when completed

## API Documentation

### POST /api/cec/discovery

Start CEC discovery on all outputs or a specific output.

#### Request Body

```json
{
  "outputNumber": 1,    // Optional: discover specific output only
  "async": true         // Optional: run in background (default: true for all outputs)
}
```

#### Response (Async Mode - Default)

```json
{
  "success": true,
  "jobId": "job_1762284086791_yuzluxam7",
  "message": "Discovery started in background. Use GET /api/cec/discovery/status?jobId=<JOB_ID> to check progress.",
  "estimatedTime": "4-5 minutes",
  "statusEndpoint": "/api/cec/discovery/status?jobId=job_1762284086791_yuzluxam7"
}
```

#### Response (Sync Mode or Single Output)

```json
{
  "success": true,
  "results": [
    {
      "outputNumber": 1,
      "label": "Cable Box 1",
      "brand": "Samsung",
      "model": "Samsung TV",
      "cecAddress": "0",
      "success": true
    }
  ],
  "message": "Discovery complete: 1/1 TVs detected"
}
```

#### Examples

**Start async discovery (all outputs):**
```bash
curl -X POST http://localhost:3001/api/cec/discovery \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Discover single output (always synchronous):**
```bash
curl -X POST http://localhost:3001/api/cec/discovery \
  -H "Content-Type: application/json" \
  -d '{"outputNumber": 1}'
```

**Force synchronous mode (all outputs):**
```bash
curl -X POST http://localhost:3001/api/cec/discovery \
  -H "Content-Type: application/json" \
  -d '{"async": false}'
# Note: This will take 4-5 minutes and may timeout
```

### GET /api/cec/discovery/status

Check status of an async discovery job.

#### Query Parameters

- `jobId` (required): Job ID returned from POST request

#### Response (Running)

```json
{
  "success": true,
  "job": {
    "id": "job_1762284086791_yuzluxam7",
    "type": "cec-discovery",
    "status": "running",
    "progress": {
      "current": 15,
      "total": 30,
      "percentage": 50,
      "message": "Scanning output 15 (Sports Bar 3)..."
    },
    "startedAt": "2025-11-04T19:21:26.791Z",
    "duration": "2m 30s",
    "durationSeconds": 150
  }
}
```

#### Response (Completed)

```json
{
  "success": true,
  "job": {
    "id": "job_1762284086791_yuzluxam7",
    "type": "cec-discovery",
    "status": "completed",
    "progress": {
      "current": 30,
      "total": 30,
      "percentage": 100,
      "message": "Scanning output 30 (Sports Bar 6)..."
    },
    "startedAt": "2025-11-04T19:21:26.791Z",
    "completedAt": "2025-11-04T19:26:28.445Z",
    "duration": "5m 1s",
    "durationSeconds": 301,
    "result": [
      {
        "outputNumber": 1,
        "label": "Cable Box 1",
        "brand": "Samsung",
        "model": "Samsung TV",
        "cecAddress": "0",
        "success": true
      },
      // ... more results
    ],
    "summary": {
      "totalOutputs": 30,
      "discovered": 25,
      "failed": 5,
      "successRate": 83
    }
  }
}
```

#### Response (Failed)

```json
{
  "success": true,
  "job": {
    "id": "job_1762284086791_yuzluxam7",
    "type": "cec-discovery",
    "status": "failed",
    "progress": {
      "current": 5,
      "total": 30,
      "percentage": 17,
      "message": "Scanning output 5..."
    },
    "startedAt": "2025-11-04T19:21:26.791Z",
    "completedAt": "2025-11-04T19:22:15.123Z",
    "duration": "48s",
    "durationSeconds": 48,
    "error": "CEC adapter not found at /dev/ttyACM0"
  }
}
```

#### Response (Job Not Found)

```json
{
  "success": false,
  "error": "Job not found. It may have expired (jobs are kept for 1 hour after completion)."
}
```

#### Example

```bash
curl "http://localhost:3001/api/cec/discovery/status?jobId=job_1762284086791_yuzluxam7"
```

## Usage Patterns

### Frontend Polling Pattern

```javascript
// Start discovery
const startResponse = await fetch('/api/cec/discovery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})

const { jobId, statusEndpoint } = await startResponse.json()

// Poll for status every 2 seconds
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(statusEndpoint)
  const { job } = await statusResponse.json()

  // Update UI with progress
  updateProgressBar(job.progress.percentage)
  updateStatusMessage(job.progress.message)

  // Check if complete
  if (job.status === 'completed') {
    clearInterval(pollInterval)
    displayResults(job.result)
    showSummary(job.summary)
  } else if (job.status === 'failed') {
    clearInterval(pollInterval)
    showError(job.error)
  }
}, 2000)
```

### CLI Polling Pattern

```bash
#!/bin/bash

# Start discovery
RESPONSE=$(curl -s -X POST http://localhost:3001/api/cec/discovery \
  -H "Content-Type: application/json" \
  -d '{}')

JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
echo "Discovery started. Job ID: $JOB_ID"

# Poll for status
while true; do
  STATUS=$(curl -s "http://localhost:3001/api/cec/discovery/status?jobId=$JOB_ID")

  JOB_STATUS=$(echo "$STATUS" | jq -r '.job.status')
  PERCENTAGE=$(echo "$STATUS" | jq -r '.job.progress.percentage')
  MESSAGE=$(echo "$STATUS" | jq -r '.job.progress.message')

  echo "[$PERCENTAGE%] $MESSAGE"

  if [ "$JOB_STATUS" = "completed" ]; then
    echo "Discovery complete!"
    echo "$STATUS" | jq '.job.summary'
    break
  elif [ "$JOB_STATUS" = "failed" ]; then
    echo "Discovery failed:"
    echo "$STATUS" | jq -r '.job.error'
    break
  fi

  sleep 2
done
```

## Performance Characteristics

### Timing

- **Single output discovery**: 10-15 seconds (synchronous)
- **All outputs discovery**: 4-5 minutes (async recommended)
- **Scan rate**: ~10 seconds per output
- **Typical output count**: 29-30 active outputs

### Polling Recommendations

- **Poll interval**: 2-3 seconds
- **Too frequent**: < 1 second (unnecessary load)
- **Too infrequent**: > 5 seconds (poor UX)

### Memory Usage

- **Job overhead**: ~1-2 KB per job
- **Discovery results**: ~5-10 KB for 30 outputs
- **Cleanup interval**: 10 minutes
- **Job retention**: 1 hour after completion

## Implementation Details

### Job ID Format

```
job_<timestamp>_<random>
Example: job_1762284086791_yuzluxam7
```

- Timestamp: Milliseconds since epoch (for chronological ordering)
- Random: 9-character alphanumeric string (for uniqueness)

### Progress Calculation

```typescript
percentage = Math.round((current / total) * 100)
```

- Current: Number of outputs scanned (1-30)
- Total: Total number of active outputs (typically 30)
- Percentage: 0-100

### Duration Formatting

```typescript
if (seconds < 60) return `${seconds}s`
if (seconds < 3600) return `${minutes}m ${seconds}s`
return `${hours}h ${minutes}m`
```

### Error Handling

**Job Tracker Errors:**
- Attempt to update non-existent job: Logged as warning
- Attempt to update non-running job: Logged as warning

**Discovery Errors:**
- CEC not enabled: Throws error immediately
- CEC adapter not found: Fails job with error message
- Individual output failures: Recorded in results, doesn't stop scan

## Testing

### Test Cases

1. **Async discovery (default)**:
   ```bash
   curl -X POST http://localhost:3001/api/cec/discovery \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Expected: Returns immediately with job ID

2. **Progress tracking**:
   ```bash
   curl "http://localhost:3001/api/cec/discovery/status?jobId=<JOB_ID>"
   ```
   Expected: Shows progress percentage and message

3. **Single output (synchronous)**:
   ```bash
   curl -X POST http://localhost:3001/api/cec/discovery \
     -H "Content-Type: application/json" \
     -d '{"outputNumber": 1}'
   ```
   Expected: Returns results in 10-15 seconds

4. **Sync mode (all outputs)**:
   ```bash
   curl -X POST http://localhost:3001/api/cec/discovery \
     -H "Content-Type: application/json" \
     -d '{"async": false}'
   ```
   Expected: Waits 4-5 minutes, returns all results

5. **Job not found**:
   ```bash
   curl "http://localhost:3001/api/cec/discovery/status?jobId=invalid_job"
   ```
   Expected: 404 with error message

6. **Missing jobId parameter**:
   ```bash
   curl "http://localhost:3001/api/cec/discovery/status"
   ```
   Expected: 400 with error message

## Migration Guide

### For Existing API Consumers

**No breaking changes!** The API is backward compatible.

**Old synchronous code (still works):**
```javascript
// This still works but will wait 4-5 minutes
const response = await fetch('/api/cec/discovery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ async: false })
})
const { results } = await response.json()
```

**Recommended async pattern:**
```javascript
// Start discovery (returns immediately)
const startResponse = await fetch('/api/cec/discovery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}) // async: true is default
})
const { jobId } = await startResponse.json()

// Poll for status
// (see polling patterns above)
```

## Future Enhancements

### Possible Improvements

1. **Database persistence**: Store jobs in database for persistence across restarts
2. **WebSocket updates**: Push progress updates to clients instead of polling
3. **Job cancellation**: Add ability to cancel running jobs
4. **Job queue**: Limit concurrent discovery jobs to prevent CEC bus conflicts
5. **Historical results**: Store discovery history for trend analysis
6. **Retry mechanism**: Automatically retry failed outputs
7. **Partial results**: Return partial results for outputs scanned so far

### Scalability Considerations

Current implementation assumes:
- Single server instance (in-memory storage)
- Low discovery frequency (occasional scans)
- Moderate concurrent usage (< 10 simultaneous jobs)

For production at scale, consider:
- Database-backed job storage (multi-instance support)
- Redis for distributed job tracking
- Message queue for job processing (RabbitMQ, AWS SQS)
- Job result caching to reduce redundant scans

## Troubleshooting

### Common Issues

**Issue: Job not found after creation**
- Check: Job ID copied correctly
- Check: Less than 1 hour since completion
- Check: Server hasn't restarted (in-memory storage)

**Issue: Progress stuck at same percentage**
- Check: CEC discovery service logs for errors
- Check: Individual output failures in results
- Wait: Some outputs take longer to scan

**Issue: Job marked as failed immediately**
- Check: CEC is enabled in configuration
- Check: CEC adapter connected at /dev/ttyACM0
- Check: CEC service initialized successfully

**Issue: HTTP 429 (Too Many Requests)**
- Cause: Rate limiting triggered
- Solution: Wait before retrying
- Note: Status endpoint also rate limited

### Debug Logging

Enable debug logging to troubleshoot issues:

```bash
# View job tracker logs
pm2 logs sports-bar-tv-controller | grep "JobTracker"

# View CEC discovery logs
pm2 logs sports-bar-tv-controller | grep "CEC Discovery"

# View all logs
pm2 logs sports-bar-tv-controller
```

## Related Documentation

- [CEC Control Documentation](./CEC_CONTROL.md) (if exists)
- [Rate Limiting Configuration](./RATE_LIMITING.md) (if exists)
- [API Authentication](./AUTHENTICATION.md) (if exists)

## Change Log

### Version 1.0 (2025-11-04)

- Initial implementation of async CEC discovery
- Added job tracking service
- Added status check endpoint
- Implemented progress tracking
- Added auto-cleanup mechanism
- Maintained backward compatibility with sync mode

## Contributors

- Implemented as part of Quick Win #6: Async CEC Discovery
- Addresses HTTP timeout issues for long-running discovery scans
- Improves user experience with real-time progress tracking
