# Drizzle ORM Migration Progress

## Overview

This document tracks the progress of migrating from Prisma ORM to Drizzle ORM for the Sports Bar TV Controller application.

**Migration Started:** October 20, 2025  
**Current Status:** In Progress  
**Build Status:** ✅ Compiling Successfully

---

## Summary Statistics

- **Total Files to Migrate:** 83 API routes + 20 services + 5 scripts = **108 total files**
- **Files Migrated:** 2 (test-connection, main audio-processor route)
- **Files Remaining:** 106
- **Completion:** 1.9%

---

## Completed Migrations ✅

### Audio Processor Routes

1. **`src/app/api/audio-processor/test-connection/route.ts`** ✅
   - Status: Fully migrated
   - Features: Connection testing, credential validation, error handling
   - Logging: API requests/responses, errors
   - Notes: Fixed SQLite binding errors with proper type checking

2. **`src/app/api/audio-processor/route.ts`** ✅
   - Status: Fully migrated  
   - Features: Full CRUD operations (GET, POST, PUT, DELETE)
   - Logging: All operations logged with request/response/error tracking
   - Methods migrated:
     - GET: List all processors with model config
     - POST: Create new processor with credentials
     - PUT: Update processor
     - DELETE: Delete processor

---

## Migration Infrastructure ✅

### Core Files Created

1. **`src/db/schema.ts`** ✅ (708 lines)
   - All 33 tables defined in Drizzle schema
   - Complete type safety
   - Proper relationships and constraints

2. **`src/lib/logger.ts`** ✅
   - 7 log categories (DATABASE, API, ATLAS, NETWORK, AUTH, SYSTEM, CACHE)
   - 5 log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
   - Comprehensive logging utilities

3. **`src/lib/db-helpers.ts`** ✅
   - 11 helper functions with automatic logging:
     - `findMany()`, `findFirst()`, `findUnique()`
     - `create()`, `createMany()`
     - `update()`, `updateMany()`
     - `deleteRecord()`, `deleteMany()`
     - `count()`, `upsert()`, `transaction()`
   - All Drizzle operators exported (eq, and, or, desc, asc, etc.)

4. **`drizzle.config.ts`** ✅
   - Drizzle configuration
   - Migration settings

5. **`DRIZZLE_MIGRATION_GUIDE.md`** ✅
   - Complete migration guide with examples
   - Table name mapping
   - Conversion patterns
   - Best practices

### Migration Tools Created

1. **`migrate-all-to-drizzle.sh`** ✅
   - Shell script to identify files needing migration
   - Lists all Prisma usage in the codebase
   - Counts total files to migrate

2. **`auto-migrate.py`** ✅
   - Python script for semi-automated migration
   - Pattern matching for common Prisma operations
   - Bulk migration capabilities
   - **Note:** Manual review recommended for each file

---

## Files Requiring Migration (83 Remaining)

### Audio Processor Routes (8 remaining)

- [ ] `src/app/api/audio-processor/[id]/ai-gain-control/route.ts`
- [ ] `src/app/api/audio-processor/[id]/input-gain/route.ts`
- [ ] `src/app/api/audio-processor/[id]/zones-status/route.ts`
- [ ] `src/app/api/audio-processor/control/route.ts`
- [ ] `src/app/api/audio-processor/input-levels/route.ts`
- [ ] `src/app/api/audio-processor/inputs/route.ts`
- [ ] `src/app/api/audio-processor/matrix-routing/route.ts`
- [ ] `src/app/api/audio-processor/meter-status/route.ts`
- [ ] `src/app/api/audio-processor/outputs/route.ts`
- [ ] `src/app/api/audio-processor/zones/route.ts`

### Atlas Routes (3 remaining)

- [ ] `src/app/api/atlas/ai-analysis/route.ts`
- [ ] `src/app/api/atlas/query-hardware/route.ts`
- [ ] `src/app/api/atlas/route-matrix-to-zone/route.ts`

### Matrix Routes (7 remaining)

- [ ] `src/app/api/matrix/config/route.ts`
- [ ] `src/app/api/matrix/connection-manager/route.ts`
- [ ] `src/app/api/matrix/initialize-connection/route.ts`
- [ ] `src/app/api/matrix/outputs-schedule/route.ts`
- [ ] `src/app/api/matrix/route/route.ts`
- [ ] `src/app/api/matrix/test-connection/route.ts`
- [ ] `src/app/api/matrix/video-input-selection/route.ts`
- [ ] `src/app/api/matrix-config/route.ts`
- [ ] `src/app/api/matrix-display/route.ts`

### Channel Presets Routes (5 remaining)

- [ ] `src/app/api/channel-presets/[id]/route.ts`
- [ ] `src/app/api/channel-presets/by-device/route.ts`
- [ ] `src/app/api/channel-presets/route.ts`
- [ ] `src/app/api/channel-presets/tune/route.ts`
- [ ] `src/app/api/channel-presets/update-usage/route.ts`

### Todo Routes (4 remaining)

- [ ] `src/app/api/todos/[id]/complete/route.ts`
- [ ] `src/app/api/todos/[id]/documents/route.ts`
- [ ] `src/app/api/todos/[id]/route.ts`
- [ ] `src/app/api/todos/route.ts`

### IR/GlobalCache Device Routes (10 remaining)

- [ ] `src/app/api/ir/commands/route.ts`
- [ ] `src/app/api/ir/credentials/route.ts`
- [ ] `src/app/api/ir/database/download/route.ts`
- [ ] `src/app/api/ir/devices/[id]/route.ts`
- [ ] `src/app/api/ir/devices/route.ts`
- [ ] `src/app/api/globalcache/devices/[id]/route.ts`
- [ ] `src/app/api/globalcache/devices/[id]/test/route.ts`
- [ ] `src/app/api/globalcache/devices/route.ts`
- [ ] `src/app/api/globalcache/learn/route.ts`
- [ ] `src/app/api/globalcache/ports/[id]/route.ts`

### CEC Routes (4 remaining)

- [ ] `src/app/api/cec/config/route.ts`
- [ ] `src/app/api/cec/discovery/route.ts`
- [ ] `src/app/api/cec/enhanced-control/route.ts`
- [ ] `src/app/api/cec/power-control/route.ts`

### Wolfpack Routes (2 remaining)

- [ ] `src/app/api/wolfpack/inputs/route.ts`
- [ ] `src/app/api/wolfpack/route-to-matrix/route.ts`

### Schedule Routes (2 remaining)

- [ ] `src/app/api/schedules/[id]/route.ts`
- [ ] `src/app/api/schedules/execute/route.ts`
- [ ] `src/app/api/schedules/logs/route.ts`

### Soundtrack Routes (6 remaining)

- [ ] `src/app/api/soundtrack/account/route.ts`
- [ ] `src/app/api/soundtrack/cache/route.ts`
- [ ] `src/app/api/soundtrack/config/route.ts`
- [ ] `src/app/api/soundtrack/diagnose/route.ts`
- [ ] `src/app/api/soundtrack/now-playing/route.ts`
- [ ] `src/app/api/soundtrack/players/route.ts`
- [ ] `src/app/api/soundtrack/stations/route.ts`

### AI/Assistant Routes (7 remaining)

- [ ] `src/app/api/ai-assistant/index-codebase/route.ts`
- [ ] `src/app/api/ai-assistant/search-code/route.ts`
- [ ] `src/app/api/ai-hub/qa-training/stats/route.ts`
- [ ] `src/app/api/ai-providers/status/route.ts`
- [ ] `src/app/api/ai/analyze-layout/route.ts`
- [ ] `src/app/api/ai/qa-entries/route.ts`
- [ ] `src/app/api/ai/run-diagnostics/route.ts`

### Other API Routes (25 remaining)

- [ ] `src/app/api/api-keys/[id]/route.ts`
- [ ] `src/app/api/api-keys/route.ts`
- [ ] `src/app/api/chat/route.ts`
- [ ] `src/app/api/diagnostics/bartender-remote/route.ts`
- [ ] `src/app/api/diagnostics/device-mapping/route.ts`
- [ ] `src/app/api/documents/[id]/route.ts`
- [ ] `src/app/api/documents/reprocess/route.ts`
- [ ] `src/app/api/enhanced-chat/route.ts`
- [ ] `src/app/api/keys/route.ts`
- [ ] `src/app/api/selected-leagues/route.ts`
- [ ] `src/app/api/sports-guide-config/route.ts`
- [ ] `src/app/api/sports-guide/current-time/route.ts`
- [ ] `src/app/api/system/status/route.ts`
- [ ] `src/app/api/tests/logs/route.ts`
- [ ] `src/app/api/tests/wolfpack/connection/route.ts`
- [ ] `src/app/api/tests/wolfpack/switching/route.ts`
- [ ] `src/app/api/unified-tv-control/route.ts`
- [ ] `src/app/api/upload/route.ts`

### Service Files (~20 remaining)

- [ ] `src/lib/ai-knowledge-enhanced.ts`
- [ ] `src/lib/ai-knowledge-qa.ts`
- [ ] `src/lib/tvDocs/index.ts`
- [ ] `src/lib/tvDocs/generateQA.ts`
- [ ] `src/lib/firecube/sports-content-detector.ts`
- [ ] `src/lib/firecube/app-discovery.ts`
- [ ] `src/lib/firecube/subscription-detector.ts`
- [ ] `src/lib/firecube/keep-awake-scheduler.ts`
- [ ] `src/lib/firecube/sideload-service.ts`
- [ ] `src/lib/ai-gain-service.ts`
- [ ] `src/lib/gitSync.ts`
- [ ] `src/lib/enhanced-document-search.ts`
- [ ] `src/lib/scheduler-service.ts`
- [ ] `src/lib/atlas-meter-service.ts`
- [ ] `src/lib/services/qa-generator.ts`
- [ ] `src/lib/services/cec-discovery-service.ts`
- [ ] `src/lib/services/qa-uploader.ts`
- [ ] `src/lib/api-keys.ts`
- [ ] `src/services/presetReorderService.ts`

### Script Files (~5 remaining)

- [ ] `scripts/seed-directv-commands.ts`
- [ ] `src/scripts/reprocess-uploads.ts`

---

## Migration Pattern Reference

### Import Statements

**Before (Prisma):**
```typescript
import { prisma } from '@/lib/db'
```

**After (Drizzle):**
```typescript
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { findMany, findFirst, create, update, deleteRecord, eq, and, or, desc, asc } from '@/lib/db-helpers'
```

### Common Operations

#### Find Many
**Before:** `await prisma.audioProcessor.findMany({ orderBy: { name: 'asc' } })`  
**After:** `await findMany('audioProcessors', { orderBy: asc(schema.audioProcessors.name) })`

#### Create
**Before:** `await prisma.audioProcessor.create({ data: { ... } })`  
**After:** `await create('audioProcessors', { ... })`

#### Update
**Before:** `await prisma.audioProcessor.update({ where: { id }, data: { ... } })`  
**After:** `await update('audioProcessors', eq(schema.audioProcessors.id, id), { ... })`

#### Delete
**Before:** `await prisma.audioProcessor.delete({ where: { id } })`  
**After:** `await deleteRecord('audioProcessors', eq(schema.audioProcessors.id, id))`

### Logging Pattern

```typescript
export async function GET(request: NextRequest) {
  logger.api.request('GET', '/api/endpoint')
  
  try {
    const results = await findMany('tableName', { ... })
    
    logger.api.response('GET', '/api/endpoint', 200, { count: results.length })
    return NextResponse.json({ results })
  } catch (error: any) {
    logger.api.error('GET', '/api/endpoint', error)
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 })
  }
}
```

---

## Table Name Mapping (Prisma → Drizzle)

| Prisma Model | Drizzle Table Name |
|--------------|-------------------|
| `audioProcessor` | `'audioProcessors'` |
| `audioZone` | `'audioZones'` |
| `audioScene` | `'audioScenes'` |
| `audioMessage` | `'audioMessages'` |
| `channelPreset` | `'channelPresets'` |
| `schedule` | `'schedules'` |
| `scheduleLog` | `'scheduleLogs'` |
| `homeTeam` | `'homeTeams'` |
| `matrixConfiguration` | `'matrixConfigurations'` |
| `matrixInput` | `'matrixInputs'` |
| `matrixOutput` | `'matrixOutputs'` |
| `qaEntry` | `'qaEntries'` |
| `chatSession` | `'chatSessions'` |
| `chatMessage` | `'chatMessages'` |
| `document` | `'documents'` |
| `documentChunk` | `'documentChunks'` |
| `todo` | `'todos'` |
| `deviceSubscription` | `'deviceSubscriptions'` |
| `globalCacheDevice` | `'globalCacheDevices'` |
| `irDevice` | `'irDevices'` |
| `irCommand` | `'irCommands'` |
| `selectedLeague` | `'selectedLeagues'` |
| `apiKey` | `'apiKeys'` |

---

## Next Steps

### Immediate Priority (High Impact)

1. **Audio Processor Routes** (8 files)
   - Core functionality for audio control
   - Actively used by the application
   - Includes zones-status which has runtime errors

2. **Channel Presets Routes** (5 files)
   - Critical for TV channel management
   - Frequently accessed endpoints

3. **Matrix Routes** (7 files)
   - Video routing functionality
   - Integration with hardware

### Medium Priority

4. **Todo Routes** (4 files)
5. **Schedule Routes** (3 files)
6. **IR/GlobalCache Routes** (10 files)

### Lower Priority

7. **AI/Assistant Routes** (7 files)
8. **Soundtrack Routes** (6 files)
9. **Other API Routes** (25 files)
10. **Service Files** (20 files)
11. **Script Files** (5 files)

### Final Steps

12. **Remove Prisma Completely**
    - Delete `src/db/prisma-adapter.ts`
    - Delete `src/lib/prisma.ts`
    - Remove from `package.json`: `@prisma/client`, `prisma`
    - Delete `prisma/schema.prisma.deprecated`
    - Keep database file: `prisma/data/sports_bar.db`

13. **Final Testing**
    - Build application
    - Test all endpoints
    - Verify logging
    - Check for any remaining Prisma references

14. **Commit and Push**
    - Commit all changes with clear messages
    - Push to main branch
    - Update documentation

---

## Testing Commands

```bash
# Build the application
npm run build

# Find remaining Prisma usage
./migrate-all-to-drizzle.sh

# Run Drizzle Studio (database GUI)
npm run db:studio

# Generate new migrations
npm run db:generate

# Push schema changes
npm run db:push
```

---

## Known Issues

1. **SQLite Binding Errors** ✅ FIXED
   - Issue: `new Date()` objects can't be directly bound to SQLite
   - Solution: Convert to ISO string: `new Date().toISOString()`

2. **Processor ID Type Checking** ✅ FIXED
   - Issue: `processorId` might be undefined or wrong type
   - Solution: Add type check: `if (processorId && typeof processorId === 'string')`

3. **prisma-adapter.ts Syntax Error** ✅ FIXED
   - Issue: Embedded line numbers in file
   - Solution: Cleaned with sed command

---

## Resources

- **Migration Guide:** `DRIZZLE_MIGRATION_GUIDE.md`
- **Schema:** `src/db/schema.ts`
- **DB Helpers:** `src/lib/db-helpers.ts`
- **Logger:** `src/lib/logger.ts`
- **Examples:**
  - `src/app/api/schedules/route.ts`
  - `src/app/api/home-teams/route.ts`
  - `src/app/api/audio-processor/route.ts`
  - `src/app/api/audio-processor/test-connection/route.ts`

---

## Progress Timeline

- **Oct 20, 2025 - Morning**: Foundation complete (schema, helpers, logger, guide)
- **Oct 20, 2025 - Afternoon**: First critical routes migrated (test-connection, main audio-processor)
- **Oct 20, 2025 - Next**: Continue with remaining audio-processor routes

---

## Conclusion

The migration infrastructure is complete and working. The first two critical files have been successfully migrated and tested. The remaining 106 files follow the same patterns established in the migration guide and example files.

**Estimated Time to Complete:** 
- With manual migration: ~10-15 hours for remaining 106 files
- With semi-automated script + review: ~6-8 hours

**Recommendation:** Use the migration patterns from the completed files as templates. Test each major group (audio-processor, channel-presets, etc.) before moving to the next.
