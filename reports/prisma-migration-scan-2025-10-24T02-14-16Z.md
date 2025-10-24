# Prisma to Drizzle Migration Scan Report

**Generated:** 2025-10-24 02:14:16 UTC

**Total Files Scanned:** 519
**Files Requiring Migration:** 106

## Summary

- Total lines of code requiring migration: 18528
- Total Prisma imports found: 60
- Total unique Prisma calls: 283

## Migration Priority

### Phase 1: Core Infrastructure (Already Complete)
- ✅ src/db/index.ts - Drizzle setup
- ✅ src/db/schema.ts - Schema definitions
- ✅ src/lib/db-helpers.ts - Helper functions

### Phase 2: High-Impact Files

#### API Routes (71 files)

1. `src/app/api/sports-guide-config/route.ts`
   - Lines: 190
   - Prisma calls: 10
   - Examples: prisma.sportsGuideConfiguration.findFirst, prisma.homeTeam.deleteMany, prisma.tVProvider.create, prisma.sportsGuideConfiguration.upsert, prisma.tVProvider.findMany

2. `src/app/api/soundtrack/config/route.ts`
   - Lines: 249
   - Prisma calls: 7
   - Examples: prisma.soundtrackConfig.create, prisma.soundtrackConfig.delete, prisma.soundtrackConfig.update, prisma.soundtrackPlayer.updateMany, prisma.soundtrackPlayer.upsert

3. `src/app/api/audio-processor/[id]/ai-gain-control/route.ts`
   - Lines: 223
   - Prisma calls: 7
   - Examples: prisma.aIGainConfiguration.delete, prisma.aIGainConfiguration.create, prisma.aIGainConfiguration.findFirst, prisma.audioInputMeter.findFirst, prisma.aIGainConfiguration.update

4. `src/app/api/atlas/route-matrix-to-zone/route.ts`
   - Lines: 201
   - Prisma calls: 6
   - Examples: prisma.wolfpackMatrixRouting.update, prisma.wolfpackMatrixRouting.findUnique, prisma.audioProcessor.findFirst, prisma.wolfpackMatrixRouting.findMany, prisma.audioZone.upsert

5. `src/app/api/schedules/execute/route.ts`
   - Lines: 247
   - Prisma calls: 5
   - Examples: prisma.schedule.findUnique, prisma.schedule.update, prisma.scheduleLog.create, prisma.homeTeam.findMany, prisma.matrixOutput.findMany

6. `src/app/api/ir/database/download/route.ts`
   - Lines: 166
   - Prisma calls: 5
   - Examples: prisma.iRCommand.findUnique, prisma.iRDatabaseCredentials.findFirst, prisma.iRCommand.create, prisma.iRCommand.update, prisma.iRDevice.update

7. `src/app/api/keys/route.ts`
   - Lines: 158
   - Prisma calls: 4
   - Examples: prisma.apiKey.create, prisma.apiKey.findMany, prisma.apiKey.delete, prisma.apiKey.update

8. `src/app/api/unified-tv-control/route.ts`
   - Lines: 141
   - Prisma calls: 4
   - Examples: prisma.cECConfiguration.findFirst, prisma.matrixOutput.findUnique, prisma.matrixConfiguration.findFirst, prisma.matrixOutput.findMany

9. `src/app/api/todos/[id]/documents/route.ts`
   - Lines: 135
   - Prisma calls: 4
   - Examples: prisma.todo.findUnique, prisma.todoDocument.findMany, prisma.todoDocument.create, prisma.todoDocument.delete

10. `src/app/api/matrix/route/route.ts`
   - Lines: 212
   - Prisma calls: 4
   - Examples: prisma.matrixRoute.update, prisma.matrixRoute.findFirst, prisma.matrixRoute.create, prisma.matrixConfiguration.findFirst

11. `src/app/api/enhanced-chat/route.ts`
   - Lines: 139
   - Prisma calls: 4
   - Examples: prisma.document.findMany, prisma.chatSession.update, prisma.chatSession.create, prisma.chatSession.findUnique

12. `src/app/api/audio-processor/input-levels/route.ts`
   - Lines: 163
   - Prisma calls: 4
   - Examples: prisma.audioProcessor.findUnique, prisma.audioInputMeter.updateMany, prisma.audioInputMeter.findMany, prisma.audioInputMeter.create

13. `src/app/api/schedules/[id]/route.ts`
   - Lines: 95
   - Prisma calls: 3
   - Examples: prisma.schedule.findUnique, prisma.schedule.update, prisma.schedule.delete

14. `src/app/api/channel-presets/route.ts`
   - Lines: 102
   - Prisma calls: 3
   - Examples: prisma.channelPreset.findMany, prisma.channelPreset.create, prisma.channelPreset.findFirst

15. `src/app/api/channel-presets/[id]/route.ts`
   - Lines: 106
   - Prisma calls: 3
   - Examples: prisma.channelPreset.findUnique, prisma.channelPreset.delete, prisma.channelPreset.update

16. `src/app/api/ai/run-diagnostics/route.ts`
   - Lines: 421
   - Prisma calls: 3
   - Examples: prisma.matrixInput.findMany, prisma.apiKey.findMany, prisma.testLog.findMany

17. `src/app/api/todos/[id]/route.ts`
   - Lines: 124
   - Prisma calls: 3
   - Examples: prisma.todo.findUnique, prisma.todo.delete, prisma.todo.update

18. `src/app/api/atlas/query-hardware/route.ts`
   - Lines: 247
   - Prisma calls: 3
   - Examples: prisma.audioProcessor.findUnique, prisma.audioProcessor.update, prisma.audioZone.upsert

19. `src/app/api/globalcache/devices/route.ts`
   - Lines: 203
   - Prisma calls: 3
   - Examples: prisma.globalCacheDevice.findMany, prisma.globalCacheDevice.create, prisma.globalCacheDevice.findUnique

20. `src/app/api/globalcache/devices/[id]/route.ts`
   - Lines: 110
   - Prisma calls: 3
   - Examples: prisma.globalCacheDevice.update, prisma.globalCacheDevice.delete, prisma.globalCacheDevice.findUnique


... and 51 more API route files


#### Services (4 files)

- `src/lib/services/qa-generator.ts`
  - Lines: 795
  - Prisma calls: 10

- `src/lib/services/cec-discovery-service.ts`
  - Lines: 368
  - Prisma calls: 5

- `src/services/presetReorderService.ts`
  - Lines: 144
  - Prisma calls: 2

- `src/lib/services/qa-uploader.ts`
  - Lines: 323
  - Prisma calls: 1


#### Library Files (19 files)

- `src/lib/services/qa-generator.ts`
  - Lines: 795
  - Prisma calls: 10

- `src/lib/firecube/sideload-service.ts`
  - Lines: 401
  - Prisma calls: 9

- `src/lib/ai-gain-service.ts`
  - Lines: 384
  - Prisma calls: 5

- `src/lib/services/cec-discovery-service.ts`
  - Lines: 368
  - Prisma calls: 5

- `src/lib/firecube/keep-awake-scheduler.ts`
  - Lines: 357
  - Prisma calls: 5

- `src/lib/firecube/app-discovery.ts`
  - Lines: 254
  - Prisma calls: 5

- `src/lib/atlas-meter-service.ts`
  - Lines: 184
  - Prisma calls: 4

- `src/lib/ai-knowledge-enhanced.ts`
  - Lines: 227
  - Prisma calls: 4

- `src/lib/firecube/subscription-detector.ts`
  - Lines: 309
  - Prisma calls: 4

- `src/lib/firecube/sports-content-detector.ts`
  - Lines: 266
  - Prisma calls: 4

- `src/lib/api-keys.ts`
  - Lines: 197
  - Prisma calls: 3

- `src/lib/enhanced-document-search.ts`
  - Lines: 247
  - Prisma calls: 2

- `src/lib/ai-knowledge-qa.ts`
  - Lines: 174
  - Prisma calls: 2

- `src/lib/tvDocs/index.ts`
  - Lines: 192
  - Prisma calls: 2

- `src/lib/scheduler-service.ts`
  - Lines: 166
  - Prisma calls: 1

- `src/lib/gitSync.ts`
  - Lines: 231
  - Prisma calls: 1

- `src/lib/prisma.ts`
  - Lines: 26
  - Prisma calls: 1

- `src/lib/services/qa-uploader.ts`
  - Lines: 323
  - Prisma calls: 1

- `src/lib/tvDocs/generateQA.ts`
  - Lines: 224
  - Prisma calls: 1


#### Other Files (15 files)

- `scripts/seed-wolfpack-config.js`

- `scripts/final-verification.js`

- `scripts/setup-wolfpack-inputs.js`

- `src/scripts/reprocess-uploads.ts`

- `update_atlas.js`

- `insert_qa_pairs.js`

- `scripts/check-data.js`

- `scripts/init-soundtrack.js`

- `debug_remote_data.js`

- `scripts/reorder-presets-cron.js`

- `scripts/seed-directv-commands.ts`

- `src/db/prisma-adapter.ts`

- `check-mapping.js`

- `scripts/get-config-filename.js`

- `scripts/rename-config-file.js`


## Migration Strategy

### Step 1: Update Imports
Replace:
```typescript
import prisma from "@/lib/prisma"
```

With:
```typescript
import { findMany, findFirst, create, update, deleteRecord, eq } from "@/lib/db-helpers"
import { schema } from "@/db"
import { logger } from "@/lib/logger"
```

### Step 2: Convert Prisma Calls

#### findMany
```typescript
// OLD
await prisma.schedule.findMany({ where: { enabled: true } })

// NEW
await findMany("schedules", { where: eq(schema.schedules.enabled, true) })
```

#### findFirst/findUnique
```typescript
// OLD
await prisma.schedule.findFirst({ where: { id } })

// NEW
await findFirst("schedules", { where: eq(schema.schedules.id, id) })
```

#### create
```typescript
// OLD
await prisma.schedule.create({ data: { name, enabled } })

// NEW
await create("schedules", { name, enabled })
```

#### update
```typescript
// OLD
await prisma.schedule.update({ where: { id }, data: { name } })

// NEW
await update("schedules", eq(schema.schedules.id, id), { name })
```

#### delete
```typescript
// OLD
await prisma.schedule.delete({ where: { id } })

// NEW
await deleteRecord("schedules", eq(schema.schedules.id, id))
```

## Detailed File List

### 1. src/app/api/sports-guide-config/route.ts

- **Lines:** 190
- **Imports:** 1
- **Prisma Calls:** 10

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.sportsGuideConfiguration.findFirst`
- `prisma.homeTeam.deleteMany`
- `prisma.tVProvider.create`
- `prisma.sportsGuideConfiguration.upsert`
- `prisma.tVProvider.findMany`
- `prisma.homeTeam.createMany`
- `prisma.matrixConfiguration.findFirst`
- `prisma.providerInput.deleteMany`
- `prisma.providerInput.createMany`
- `prisma.homeTeam.findMany`

---

### 2. src/lib/services/qa-generator.ts

- **Lines:** 795
- **Imports:** 1
- **Prisma Calls:** 10

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.qAEntry.groupBy`
- `prisma.qAGenerationJob.findMany`
- `prisma.qAGenerationJob.update`
- `prisma.qAEntry.findMany`
- `prisma.qAGenerationJob.create`
- `prisma.qAEntry.update`
- `prisma.processedFile.upsert`
- `prisma.qAEntry.create`
- `prisma.qAGenerationJob.findUnique`
- `prisma.qAEntry.count`

---

### 3. src/lib/firecube/sideload-service.ts

- **Lines:** 401
- **Imports:** 1
- **Prisma Calls:** 9

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.fireCubeDevice.findUnique`
- `prisma.fireCubeSideloadOperation.update`
- `prisma.fireCubeApp.findMany`
- `prisma.fireCubeApp.findFirst`
- `prisma.fireCubeSideloadOperation.create`
- `prisma.fireCubeSideloadOperation.findUnique`
- `prisma.fireCubeSideloadOperation.findMany`
- `prisma.fireCubeDevice.findMany`
- `prisma.fireCubeApp.upsert`

---

### 4. scripts/seed-wolfpack-config.js

- **Lines:** 178
- **Imports:** 0
- **Prisma Calls:** 8

**Prisma Calls:**
- `prisma.matrixOutput.create`
- `prisma.matrixOutput.count`
- `prisma.matrixInput.deleteMany`
- `prisma.matrixConfiguration.create`
- `prisma.matrixInput.count`
- `prisma.matrixOutput.deleteMany`
- `prisma.matrixConfiguration.findFirst`
- `prisma.matrixInput.create`

---

### 5. src/app/api/soundtrack/config/route.ts

- **Lines:** 249
- **Imports:** 1
- **Prisma Calls:** 7

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.create`
- `prisma.soundtrackConfig.delete`
- `prisma.soundtrackConfig.update`
- `prisma.soundtrackPlayer.updateMany`
- `prisma.soundtrackPlayer.upsert`
- `prisma.soundtrackConfig.findFirst`
- `prisma.soundtrackPlayer.deleteMany`

---

### 6. src/app/api/audio-processor/[id]/ai-gain-control/route.ts

- **Lines:** 223
- **Imports:** 0
- **Prisma Calls:** 7

**Prisma Calls:**
- `prisma.aIGainConfiguration.delete`
- `prisma.aIGainConfiguration.create`
- `prisma.aIGainConfiguration.findFirst`
- `prisma.audioInputMeter.findFirst`
- `prisma.aIGainConfiguration.update`
- `prisma.audioInputMeter.create`
- `prisma.audioProcessor.findUnique`

---

### 7. src/app/api/atlas/route-matrix-to-zone/route.ts

- **Lines:** 201
- **Imports:** 1
- **Prisma Calls:** 6

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.wolfpackMatrixRouting.update`
- `prisma.wolfpackMatrixRouting.findUnique`
- `prisma.audioProcessor.findFirst`
- `prisma.wolfpackMatrixRouting.findMany`
- `prisma.audioZone.upsert`
- `prisma.audioProcessor.findUnique`

---

### 8. src/app/api/schedules/execute/route.ts

- **Lines:** 247
- **Imports:** 0
- **Prisma Calls:** 5

**Prisma Calls:**
- `prisma.schedule.findUnique`
- `prisma.schedule.update`
- `prisma.scheduleLog.create`
- `prisma.homeTeam.findMany`
- `prisma.matrixOutput.findMany`

---

### 9. src/app/api/ir/database/download/route.ts

- **Lines:** 166
- **Imports:** 0
- **Prisma Calls:** 5

**Prisma Calls:**
- `prisma.iRCommand.findUnique`
- `prisma.iRDatabaseCredentials.findFirst`
- `prisma.iRCommand.create`
- `prisma.iRCommand.update`
- `prisma.iRDevice.update`

---

### 10. src/lib/ai-gain-service.ts

- **Lines:** 384
- **Imports:** 0
- **Prisma Calls:** 5

**Prisma Calls:**
- `prisma.aIGainAdjustmentLog.create`
- `prisma.aIGainConfiguration.update`
- `prisma.aIGainConfiguration.findMany`
- `prisma.aIGainAdjustmentLog.findMany`
- `prisma.audioProcessor.findUnique`

---

### 11. src/lib/services/cec-discovery-service.ts

- **Lines:** 368
- **Imports:** 1
- **Prisma Calls:** 5

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.cECConfiguration.create`
- `prisma.matrixOutput.findFirst`
- `prisma.matrixOutput.update`
- `prisma.cECConfiguration.findFirst`
- `prisma.matrixOutput.findMany`

---

### 12. src/lib/firecube/keep-awake-scheduler.ts

- **Lines:** 357
- **Imports:** 1
- **Prisma Calls:** 5

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.fireCubeDevice.findUnique`
- `prisma.fireCubeKeepAwakeLog.findMany`
- `prisma.fireCubeKeepAwakeLog.create`
- `prisma.fireCubeDevice.update`
- `prisma.fireCubeDevice.findMany`

---

### 13. src/lib/firecube/app-discovery.ts

- **Lines:** 254
- **Imports:** 1
- **Prisma Calls:** 5

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.fireCubeDevice.findUnique`
- `prisma.fireCubeApp.findMany`
- `prisma.fireCubeApp.create`
- `prisma.fireCubeApp.delete`
- `prisma.fireCubeApp.updateMany`

---

### 14. scripts/final-verification.js

- **Lines:** 57
- **Imports:** 0
- **Prisma Calls:** 5

**Prisma Calls:**
- `prisma.matrixOutput.count`
- `prisma.audioZone.count`
- `prisma.matrixInput.count`
- `prisma.audioProcessor.findFirst`
- `prisma.matrixConfiguration.findFirst`

---

### 15. src/app/api/keys/route.ts

- **Lines:** 158
- **Imports:** 0
- **Prisma Calls:** 4

**Prisma Calls:**
- `prisma.apiKey.create`
- `prisma.apiKey.findMany`
- `prisma.apiKey.delete`
- `prisma.apiKey.update`

---

### 16. src/app/api/unified-tv-control/route.ts

- **Lines:** 141
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.cECConfiguration.findFirst`
- `prisma.matrixOutput.findUnique`
- `prisma.matrixConfiguration.findFirst`
- `prisma.matrixOutput.findMany`

---

### 17. src/app/api/todos/[id]/documents/route.ts

- **Lines:** 135
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.todo.findUnique`
- `prisma.todoDocument.findMany`
- `prisma.todoDocument.create`
- `prisma.todoDocument.delete`

---

### 18. src/app/api/matrix/route/route.ts

- **Lines:** 212
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixRoute.update`
- `prisma.matrixRoute.findFirst`
- `prisma.matrixRoute.create`
- `prisma.matrixConfiguration.findFirst`

---

### 19. src/app/api/enhanced-chat/route.ts

- **Lines:** 139
- **Imports:** 0
- **Prisma Calls:** 4

**Prisma Calls:**
- `prisma.document.findMany`
- `prisma.chatSession.update`
- `prisma.chatSession.create`
- `prisma.chatSession.findUnique`

---

### 20. src/app/api/audio-processor/input-levels/route.ts

- **Lines:** 163
- **Imports:** 0
- **Prisma Calls:** 4

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`
- `prisma.audioInputMeter.updateMany`
- `prisma.audioInputMeter.findMany`
- `prisma.audioInputMeter.create`

---

### 21. src/lib/atlas-meter-service.ts

- **Lines:** 184
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`
- `prisma.audioInputMeter.deleteMany`
- `prisma.audioInputMeter.upsert`
- `prisma.audioProcessor.update`

---

### 22. src/lib/ai-knowledge-enhanced.ts

- **Lines:** 227
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.indexedFile.groupBy`
- `prisma.indexedFile.findMany`
- `prisma.indexedFile.aggregate`
- `prisma.indexedFile.findUnique`

---

### 23. src/lib/firecube/subscription-detector.ts

- **Lines:** 309
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.fireCubeDevice.findUnique`
- `prisma.fireCubeDevice.findMany`
- `prisma.fireCubeApp.findMany`
- `prisma.fireCubeApp.update`

---

### 24. src/lib/firecube/sports-content-detector.ts

- **Lines:** 266
- **Imports:** 1
- **Prisma Calls:** 4

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.fireCubeApp.findMany`
- `prisma.fireCubeSportsContent.deleteMany`
- `prisma.fireCubeSportsContent.findMany`
- `prisma.fireCubeSportsContent.upsert`

---

### 25. scripts/setup-wolfpack-inputs.js

- **Lines:** 208
- **Imports:** 0
- **Prisma Calls:** 4

**Prisma Calls:**
- `prisma.matrixInput.deleteMany`
- `prisma.matrixConfiguration.create`
- `prisma.matrixInput.create`
- `prisma.matrixConfiguration.findFirst`

---

### 26. src/scripts/reprocess-uploads.ts

- **Lines:** 95
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.document.count`
- `prisma.document.create`
- `prisma.document.findFirst`

---

### 27. src/app/api/schedules/[id]/route.ts

- **Lines:** 95
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.schedule.findUnique`
- `prisma.schedule.update`
- `prisma.schedule.delete`

---

### 28. src/app/api/channel-presets/route.ts

- **Lines:** 102
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.findMany`
- `prisma.channelPreset.create`
- `prisma.channelPreset.findFirst`

---

### 29. src/app/api/channel-presets/[id]/route.ts

- **Lines:** 106
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.findUnique`
- `prisma.channelPreset.delete`
- `prisma.channelPreset.update`

---

### 30. src/app/api/ai/run-diagnostics/route.ts

- **Lines:** 421
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixInput.findMany`
- `prisma.apiKey.findMany`
- `prisma.testLog.findMany`

---

### 31. src/app/api/todos/[id]/route.ts

- **Lines:** 124
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.todo.findUnique`
- `prisma.todo.delete`
- `prisma.todo.update`

---

### 32. src/app/api/atlas/query-hardware/route.ts

- **Lines:** 247
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`
- `prisma.audioProcessor.update`
- `prisma.audioZone.upsert`

---

### 33. src/app/api/globalcache/devices/route.ts

- **Lines:** 203
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.globalCacheDevice.findMany`
- `prisma.globalCacheDevice.create`
- `prisma.globalCacheDevice.findUnique`

---

### 34. src/app/api/globalcache/devices/[id]/route.ts

- **Lines:** 110
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.globalCacheDevice.update`
- `prisma.globalCacheDevice.delete`
- `prisma.globalCacheDevice.findUnique`

---

### 35. src/app/api/system/status/route.ts

- **Lines:** 242
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.document.count`
- `prisma.chatSession.count`
- `prisma.apiKey.count`

---

### 36. src/app/api/tests/logs/route.ts

- **Lines:** 91
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.testLog.deleteMany`
- `prisma.testLog.count`
- `prisma.testLog.findMany`

---

### 37. src/app/api/ir/credentials/route.ts

- **Lines:** 170
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.iRDatabaseCredentials.findFirst`
- `prisma.iRDatabaseCredentials.create`
- `prisma.iRDatabaseCredentials.updateMany`

---

### 38. src/app/api/ir/devices/[id]/route.ts

- **Lines:** 201
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.iRDevice.findUnique`
- `prisma.iRDevice.delete`
- `prisma.iRDevice.update`

---

### 39. src/app/api/cec/power-control/route.ts

- **Lines:** 377
- **Imports:** 1
- **Prisma Calls:** 3

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.cECConfiguration.findFirst`
- `prisma.matrixConfiguration.findFirst`
- `prisma.matrixOutput.findMany`

---

### 40. src/app/api/audio-processor/matrix-routing/route.ts

- **Lines:** 72
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.wolfpackMatrixRouting.findMany`
- `prisma.wolfpackMatrixState.findMany`
- `prisma.wolfpackMatrixRouting.upsert`

---

### 41. src/lib/api-keys.ts

- **Lines:** 197
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.apiKey.count`
- `prisma.apiKey.findFirst`
- `prisma.apiKey.findMany`

---

### 42. update_atlas.js

- **Lines:** 70
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.audioProcessor.update`
- `prisma.audioProcessor.create`
- `prisma.audioProcessor.findMany`

---

### 43. insert_qa_pairs.js

- **Lines:** 72
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.qAEntry.count`
- `prisma.qAEntry.create`
- `prisma.qAEntry.findMany`

---

### 44. scripts/check-data.js

- **Lines:** 36
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.audioZone.findMany`
- `prisma.matrixConfiguration.findMany`
- `prisma.audioProcessor.findMany`

---

### 45. scripts/init-soundtrack.js

- **Lines:** 51
- **Imports:** 0
- **Prisma Calls:** 3

**Prisma Calls:**
- `prisma.soundtrackConfig.update`
- `prisma.soundtrackConfig.create`
- `prisma.soundtrackConfig.findFirst`

---

### 46. src/services/presetReorderService.ts

- **Lines:** 144
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.findMany`
- `prisma.channelPreset.update`

---

### 47. src/app/api/chat/route.ts

- **Lines:** 620
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.chatSession.update`
- `prisma.chatSession.findUnique`

---

### 48. src/app/api/selected-leagues/route.ts

- **Lines:** 123
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.selectedLeague.findMany`
- `prisma.selectedLeague.updateMany`

---

### 49. src/app/api/documents/[id]/route.ts

- **Lines:** 69
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.document.findUnique`
- `prisma.document.delete`

---

### 50. src/app/api/soundtrack/players/route.ts

- **Lines:** 115
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.findFirst`
- `prisma.soundtrackPlayer.findMany`

---

### 51. src/app/api/soundtrack/cache/route.ts

- **Lines:** 50
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.update`
- `prisma.soundtrackConfig.findFirst`

---

### 52. src/app/api/todos/route.ts

- **Lines:** 90
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.todo.create`
- `prisma.todo.findMany`

---

### 53. src/app/api/upload/route.ts

- **Lines:** 119
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.document.create`
- `prisma.document.findMany`

---

### 54. src/app/api/atlas/ai-analysis/route.ts

- **Lines:** 385
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`
- `prisma.audioInputMeter.findMany`

---

### 55. src/app/api/globalcache/ports/[id]/route.ts

- **Lines:** 76
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.globalCachePort.findUnique`
- `prisma.globalCachePort.update`

---

### 56. src/app/api/globalcache/devices/[id]/test/route.ts

- **Lines:** 140
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.globalCacheDevice.update`
- `prisma.globalCacheDevice.findUnique`

---

### 57. src/app/api/matrix/outputs-schedule/route.ts

- **Lines:** 87
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixOutput.update`
- `prisma.matrixConfiguration.findFirst`

---

### 58. src/app/api/tests/wolfpack/connection/route.ts

- **Lines:** 226
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.testLog.create`
- `prisma.matrixConfiguration.findFirst`

---

### 59. src/app/api/api-keys/route.ts

- **Lines:** 66
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.apiKey.create`
- `prisma.apiKey.findMany`

---

### 60. src/app/api/api-keys/[id]/route.ts

- **Lines:** 60
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.apiKey.delete`
- `prisma.apiKey.update`

---

### 61. src/app/api/ir/commands/route.ts

- **Lines:** 136
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.iRCommand.create`
- `prisma.iRCommand.delete`

---

### 62. src/app/api/ir/devices/route.ts

- **Lines:** 147
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.iRDevice.create`
- `prisma.iRDevice.findMany`

---

### 63. src/app/api/cec/enhanced-control/route.ts

- **Lines:** 154
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.cECConfiguration.findFirst`
- `prisma.matrixOutput.findFirst`

---

### 64. src/app/api/cec/config/route.ts

- **Lines:** 66
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.cECConfiguration.findFirst`
- `prisma.cECConfiguration.upsert`

---

### 65. src/app/api/audio-processor/meter-status/route.ts

- **Lines:** 106
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.audioInputMeter.updateMany`
- `prisma.audioInputMeter.findMany`

---

### 66. src/app/api/audio-processor/zones/route.ts

- **Lines:** 66
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.audioZone.findMany`
- `prisma.audioZone.create`

---

### 67. src/lib/enhanced-document-search.ts

- **Lines:** 247
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.document.update`
- `prisma.document.findMany`

---

### 68. src/lib/ai-knowledge-qa.ts

- **Lines:** 174
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.qAEntry.findMany`
- `prisma.qAEntry.update`

---

### 69. src/lib/tvDocs/index.ts

- **Lines:** 192
- **Imports:** 1
- **Prisma Calls:** 2

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.qAEntry.count`
- `prisma.matrixOutput.findMany`

---

### 70. debug_remote_data.js

- **Lines:** 120
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.matrixInput.findMany`
- `prisma.matrixConfiguration.findFirst`

---

### 71. scripts/reorder-presets-cron.js

- **Lines:** 135
- **Imports:** 0
- **Prisma Calls:** 2

**Prisma Calls:**
- `prisma.channelPreset.findMany`
- `prisma.channelPreset.update`

---

### 72. scripts/seed-directv-commands.ts

- **Lines:** 62
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.direcTVCommand.upsert`

---

### 73. src/db/prisma-adapter.ts

- **Lines:** 546
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.schedule.findMany`

---

### 74. src/app/api/schedules/logs/route.ts

- **Lines:** 32
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.scheduleLog.findMany`

---

### 75. src/app/api/matrix-config/route.ts

- **Lines:** 31
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 76. src/app/api/matrix-display/route.ts

- **Lines:** 130
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 77. src/app/api/diagnostics/device-mapping/route.ts

- **Lines:** 82
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixInput.findMany`

---

### 78. src/app/api/channel-presets/by-device/route.ts

- **Lines:** 73
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.findMany`

---

### 79. src/app/api/channel-presets/tune/route.ts

- **Lines:** 188
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.update`

---

### 80. src/app/api/channel-presets/update-usage/route.ts

- **Lines:** 53
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.channelPreset.update`

---

### 81. src/app/api/documents/reprocess/route.ts

- **Lines:** 76
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.document.count`

---

### 82. src/app/api/ai/qa-entries/route.ts

- **Lines:** 263
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.qAEntry.create`

---

### 83. src/app/api/ai/analyze-layout/route.ts

- **Lines:** 646
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 84. src/app/api/sports-guide/current-time/route.ts

- **Lines:** 82
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.sportsGuideConfiguration.findFirst`

---

### 85. src/app/api/soundtrack/diagnose/route.ts

- **Lines:** 44
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.findFirst`

---

### 86. src/app/api/soundtrack/stations/route.ts

- **Lines:** 42
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.findFirst`

---

### 87. src/app/api/soundtrack/now-playing/route.ts

- **Lines:** 45
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.findFirst`

---

### 88. src/app/api/soundtrack/account/route.ts

- **Lines:** 35
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.soundtrackConfig.findFirst`

---

### 89. src/app/api/todos/[id]/complete/route.ts

- **Lines:** 57
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.todo.update`

---

### 90. src/app/api/globalcache/learn/route.ts

- **Lines:** 406
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.globalCacheDevice.findUnique`

---

### 91. src/app/api/matrix/connection-manager/route.ts

- **Lines:** 199
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 92. src/app/api/matrix/config/route.ts

- **Lines:** 195
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 93. src/app/api/matrix/test-connection/route.ts

- **Lines:** 212
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 94. src/app/api/matrix/initialize-connection/route.ts

- **Lines:** 92
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 95. src/app/api/cec/discovery/route.ts

- **Lines:** 110
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.matrixOutput.findMany`

---

### 96. src/app/api/audio-processor/outputs/route.ts

- **Lines:** 164
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`

---

### 97. src/app/api/audio-processor/[id]/zones-status/route.ts

- **Lines:** 140
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`

---

### 98. src/app/api/audio-processor/inputs/route.ts

- **Lines:** 123
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.audioProcessor.findUnique`

---

### 99. src/lib/scheduler-service.ts

- **Lines:** 166
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.schedule.findMany`

---

### 100. src/lib/gitSync.ts

- **Lines:** 231
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.todo.findMany`

---

### 101. src/lib/prisma.ts

- **Lines:** 26
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import { prisma } from '@/lib/prisma'`

**Prisma Calls:**
- `prisma.schedule.findMany`

---

### 102. src/lib/services/qa-uploader.ts

- **Lines:** 323
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.qAEntry.create`

---

### 103. src/lib/tvDocs/generateQA.ts

- **Lines:** 224
- **Imports:** 1
- **Prisma Calls:** 1

**Imports:**
- `import prisma from "@/lib/prisma"`

**Prisma Calls:**
- `prisma.qAEntry.create`

---

### 104. check-mapping.js

- **Lines:** 73
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.matrixInput.findMany`

---

### 105. scripts/get-config-filename.js

- **Lines:** 44
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

### 106. scripts/rename-config-file.js

- **Lines:** 106
- **Imports:** 0
- **Prisma Calls:** 1

**Prisma Calls:**
- `prisma.matrixConfiguration.findFirst`

---

