# Auto-Reallocation Implementation

## Overview

The auto-reallocation system automatically frees up input sources (cable boxes, Fire TVs, etc.) when games end, making them available for new allocations. This prevents input sources from being locked to finished games and maximizes resource utilization.

## Architecture

### Core Components

1. **Auto-Reallocator Service** (`/src/lib/scheduling/auto-reallocator.ts`)
   - Scans active allocations for ended games
   - Automatically marks allocations as 'completed'
   - Frees up input sources
   - Activates pending allocations waiting for inputs

2. **Background Worker** (`/src/lib/scheduling/auto-reallocator-worker.ts`)
   - Runs periodic checks every 5 minutes
   - Singleton service started on server initialization
   - Configurable check interval (1-60 minutes)

3. **API Endpoints** (`/src/app/api/scheduling/auto-reallocate/route.ts`)
   - `GET /api/scheduling/auto-reallocate` - View reallocation history/stats
   - `POST /api/scheduling/auto-reallocate` - Manual trigger or free specific allocation

## Game End Detection

The system uses multiple criteria to determine if a game has ended:

### 1. Game Status Check
- **Final statuses**: 'final', 'completed', 'finished', 'F', 'FT'
- **Cancelled statuses**: 'cancelled', 'canceled', 'postponed', 'suspended'

### 2. Time-Based Check
- If current time > `estimatedEnd` + 30 minute buffer
- Handles overtime/extra innings situations

### 3. Actual End Time
- If `game.actualEnd` timestamp is set and has passed

## Database Schema

### Updated Fields

**inputSourceAllocations table:**
- `status`: 'pending' | 'active' | 'completed' | 'preempted' | 'cancelled'
- `actuallyFreedAt`: Unix timestamp when input was freed
- `expectedFreeAt`: Unix timestamp when input should be free

**inputSources table:**
- `currentlyAllocated`: Boolean flag indicating allocation status
- `updatedAt`: Unix timestamp of last update

## Workflow

### 1. Periodic Check (Every 5 Minutes)

```
Auto-Reallocator Worker
    ↓
Check all active allocations
    ↓
For each allocation:
    - Get game status
    - Check if game ended
    - If yes → Free allocation
    ↓
Check pending allocations
    ↓
Activate pending allocations if inputs are now free
```

### 2. Freeing an Allocation

```typescript
// 1. Update allocation record
UPDATE inputSourceAllocations
SET status = 'completed',
    actuallyFreedAt = NOW()
WHERE id = allocationId

// 2. Free the input source
UPDATE inputSources
SET currentlyAllocated = false,
    updatedAt = NOW()
WHERE id = inputSourceId
```

### 3. Activating Pending Allocations

```typescript
// 1. Find pending allocations
SELECT * FROM inputSourceAllocations
WHERE status = 'pending'
  AND allocatedAt <= NOW()

// 2. For each pending allocation:
//    - Check if input source is free
//    - If yes, activate it
UPDATE inputSourceAllocations
SET status = 'active'
WHERE id = pendingAllocationId

UPDATE inputSources
SET currentlyAllocated = true
WHERE id = inputSourceId
```

## API Usage

### Get Reallocation History

```bash
GET /api/scheduling/auto-reallocate?limit=50

Response:
{
  "success": true,
  "data": {
    "stats": {
      "totalReallocations": 150,
      "successfulReallocations": 148,
      "failedReallocations": 2,
      "lastCheckTime": 1700000000
    },
    "history": [
      {
        "timestamp": 1700000000,
        "allocationId": "abc-123",
        "gameId": "game-456",
        "gameName": "Bears @ Packers",
        "inputSourceId": "input-789",
        "inputSourceName": "Cable Box 1",
        "reason": "game_status_final",
        "success": true
      }
    ]
  }
}
```

### Manual Reallocation Check

```bash
POST /api/scheduling/auto-reallocate
Content-Type: application/json

{
  "action": "check"
}

Response:
{
  "success": true,
  "message": "Reallocation check completed",
  "data": {
    "allocationsChecked": 10,
    "allocationsCompleted": 3,
    "inputSourcesFreed": 3,
    "pendingAllocationsTriggered": 1,
    "errors": 0
  }
}
```

### Manually Free Allocation

```bash
POST /api/scheduling/auto-reallocate
Content-Type: application/json

{
  "action": "free_allocation",
  "allocationId": "abc-123"
}

Response:
{
  "success": true,
  "message": "Allocation freed successfully"
}
```

## Worker Management

### Check Worker Status

```bash
GET /api/scheduler/status

Response:
{
  "status": "running",
  "message": "Scheduler service is active",
  "autoReallocator": {
    "isRunning": true,
    "lastCheckTime": 1700000000,
    "totalChecks": 287,
    "checkIntervalMs": 300000,
    "nextCheckIn": 180000
  }
}
```

### Start/Stop Worker

```bash
POST /api/scheduler/status
Content-Type: application/json

{
  "action": "start"  // or "stop"
}

Response:
{
  "message": "Scheduler service and auto-reallocator started"
}
```

## Server Initialization

The auto-reallocator worker is automatically started when the server boots via the instrumentation file:

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { autoReallocatorWorker } = await import('./lib/scheduling/auto-reallocator-worker')
    autoReallocatorWorker.start()
  }
}
```

## Testing

### Manual Test Script

Run the comprehensive test:

```bash
npx tsx scripts/test-auto-reallocation.ts
```

This script:
1. Creates a test input source
2. Creates a test game with status='final'
3. Creates an active allocation
4. Runs auto-reallocation check
5. Verifies allocation is completed and input freed
6. Cleans up test data

### Expected Output

```
=== Auto-Reallocation Manual Test ===

1. Creating test input source...
   ✓ Created input source: <uuid>

2. Creating test game (already ended)...
   ✓ Created game: Chicago Bears @ Green Bay Packers (status: final)

3. Creating active allocation...
   ✓ Created allocation: <uuid> (status: active)

4. Verifying initial state...
   Input source allocated: true
   Allocation status: active

5. Running auto-reallocation check...
   Stats:
     - Allocations checked: 1
     - Allocations completed: 1
     - Input sources freed: 1
     - Pending allocations activated: 0
     - Errors: 0

6. Verifying final state...
   Allocation status: completed
   Actually freed at: 2025-11-15T03:28:52.000Z
   Input source allocated: false

7. Checking reallocation history...
   Last reallocation:
     - Game: Chicago Bears @ Green Bay Packers
     - Reason: game_status_final
     - Success: true

8. Test Results:
   ✅ TEST PASSED - Auto-reallocation working correctly!
```

## Reallocation History

The service maintains an in-memory history of the last 100 reallocations with:
- Timestamp
- Allocation ID
- Game name
- Input source name
- Reason for freeing (e.g., 'game_status_final', 'estimated_end_exceeded')
- Success/failure status
- Error message (if failed)

## Edge Cases Handled

1. **Overtime/Extended Games**: 30-minute buffer after estimated end time
2. **Cancelled Games**: Immediately freed
3. **Multiple Active Allocations**: Processes all in single check
4. **Pending Allocations**: Automatically activated when inputs free
5. **Concurrent Checks**: Worker prevents duplicate interval instances
6. **Database Errors**: Logged but don't crash worker

## Performance Considerations

- Runs every 5 minutes by default (configurable)
- Single database query to get all active allocations
- Batch processing of multiple allocations
- In-memory history limited to 100 entries
- Lightweight operation (~100-200ms per check)

## Monitoring

### Logs

Watch for auto-reallocation activity:

```bash
pm2 logs sports-bar-tv-controller | grep AUTO-REALLOCATOR
```

Key log messages:
- `[AUTO-REALLOCATOR-WORKER] Starting auto-reallocator worker`
- `[AUTO-REALLOCATOR] Starting reallocation check`
- `[AUTO-REALLOCATOR] Ended allocation <id> for <game> (<reason>)`
- `[AUTO-REALLOCATOR] Activated pending allocation <id>`
- `[AUTO-REALLOCATOR] Reallocation check complete`

### Metrics

Check reallocation statistics:

```bash
curl http://localhost:3001/api/scheduling/auto-reallocate | jq .data.stats
```

## Future Enhancements

1. **Predictive Freeing**: Use live game data to predict end times more accurately
2. **Priority Queuing**: Higher priority pending allocations get first access to freed inputs
3. **Notification System**: Alert operators when inputs are freed
4. **Analytics Dashboard**: Visualize reallocation patterns over time
5. **Database Persistence**: Store history in database for long-term analysis

## Files Created

- `/src/lib/scheduling/auto-reallocator.ts` - Core reallocation service
- `/src/lib/scheduling/auto-reallocator-worker.ts` - Background worker
- `/src/app/api/scheduling/auto-reallocate/route.ts` - API endpoints
- `/scripts/test-auto-reallocation.ts` - Manual test script
- `/tests/integration/auto-reallocation.test.ts` - Integration tests (vitest)

## Dependencies

- Drizzle ORM for database operations
- Existing game scheduling schema
- Input source management schema
- Logger service for monitoring
