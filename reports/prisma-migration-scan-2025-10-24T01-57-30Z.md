# Prisma to Drizzle Migration Scan Report

**Generated:** 2025-10-24T01-57-30Z

**Total Files with Prisma References:** 113

---

## 📋 Executive Summary

This automated scan identified all remaining Prisma ORM references in the Sports Bar TV Controller codebase. The migration to Drizzle ORM is partially complete, with several files still requiring updates.

## 🔍 Files Requiring Migration


- `./debug_remote_data.js`
- `./src/scripts/reprocess-uploads.ts`
- `./src/services/presetReorderService.ts`
- `./src/app/api/selected-leagues/route.ts`
- `./src/app/api/globalcache/learn/route.ts`
- `./src/app/api/globalcache/ports/[id]/route.ts`
- `./src/app/api/globalcache/devices/[id]/test/route.ts`
- `./src/app/api/globalcache/devices/[id]/route.ts`
- `./src/app/api/globalcache/devices/route.ts`
- `./src/app/api/keys/route.ts`
- `./src/app/api/channel-presets/tune/route.ts`
- `./src/app/api/channel-presets/[id]/route.ts`
- `./src/app/api/channel-presets/update-usage/route.ts`
- `./src/app/api/channel-presets/route.ts`
- `./src/app/api/channel-presets/by-device/route.ts`
- `./src/app/api/api-keys/[id]/route.ts`
- `./src/app/api/api-keys/route.ts`
- `./src/app/api/unified-tv-control/route.ts`
- `./src/app/api/todos/[id]/complete/route.ts`
- `./src/app/api/todos/[id]/documents/route.ts`
- `./src/app/api/todos/[id]/route.ts`
- `./src/app/api/todos/route.ts`
- `./src/app/api/matrix-display/route.ts`
- `./src/app/api/tests/logs/route.ts`
- `./src/app/api/tests/wolfpack/connection/route.ts`
- `./src/app/api/soundtrack/diagnose/route.ts`
- `./src/app/api/soundtrack/config/route.ts`
- `./src/app/api/soundtrack/cache/route.ts`
- `./src/app/api/soundtrack/now-playing/route.ts`
- `./src/app/api/soundtrack/players/route.ts`
- `./src/app/api/soundtrack/stations/route.ts`
- `./src/app/api/soundtrack/account/route.ts`
- `./src/app/api/cec/discovery/route.ts`
- `./src/app/api/cec/config/route.ts`
- `./src/app/api/cec/power-control/route.ts`
- `./src/app/api/cec/enhanced-control/route.ts`
- `./src/app/api/enhanced-chat/route.ts`
- `./src/app/api/audio-processor/[id]/ai-gain-control/route.ts`
- `./src/app/api/audio-processor/[id]/zones-status/route.ts`
- `./src/app/api/audio-processor/matrix-routing/route.ts`
- `./src/app/api/audio-processor/zones/route.ts`
- `./src/app/api/audio-processor/outputs/route.ts`
- `./src/app/api/audio-processor/input-levels/route.ts`
- `./src/app/api/audio-processor/meter-status/route.ts`
- `./src/app/api/audio-processor/inputs/route.ts`
- `./src/app/api/atlas/query-hardware/route.ts`
- `./src/app/api/atlas/ai-analysis/route.ts`
- `./src/app/api/atlas/route-matrix-to-zone/route.ts`
- `./src/app/api/system/status/route.ts`
- `./src/app/api/backup/route.ts`
- `./src/app/api/sports-guide/current-time/route.ts`
- `./src/app/api/schedules/logs/route.ts`
- `./src/app/api/schedules/[id]/route.ts`
- `./src/app/api/schedules/execute/route.ts`
- `./src/app/api/matrix-config/route.ts`
- `./src/app/api/sports-guide-config/route.ts`
- `./src/app/api/matrix/config/route.ts`
- `./src/app/api/matrix/initialize-connection/route.ts`
- `./src/app/api/matrix/test-connection/route.ts`
- `./src/app/api/matrix/connection-manager/route.ts`
- `./src/app/api/matrix/outputs-schedule/route.ts`
- `./src/app/api/matrix/route/route.ts`
- `./src/app/api/ai/qa-entries/route.ts`
- `./src/app/api/ai/analyze-layout/route.ts`
- `./src/app/api/ai/run-diagnostics/route.ts`
- `./src/app/api/ir/database/download/route.ts`
- `./src/app/api/ir/credentials/route.ts`
- `./src/app/api/ir/commands/route.ts`
- `./src/app/api/ir/devices/[id]/route.ts`
- `./src/app/api/ir/devices/route.ts`
- `./src/app/api/upload/route.ts`
- `./src/app/api/diagnostics/device-mapping/route.ts`
- `./src/app/api/documents/[id]/route.ts`
- `./src/app/api/documents/reprocess/route.ts`
- `./src/app/api/ai-assistant/index-codebase/route.ts`
- `./src/app/api/chat/route.ts`
- `./src/lib/atlas-meter-service.ts`
- `./src/lib/ai-tools/security/config.ts`
- `./src/lib/db.ts`
- `./src/lib/api-keys.ts`
- `./src/lib/enhanced-document-search.ts`
- `./src/lib/prisma.ts`
- `./src/lib/services/qa-uploader.ts`
- `./src/lib/services/qa-generator.ts`
- `./src/lib/services/cec-discovery-service.ts`
- `./src/lib/ai-knowledge-qa.ts`
- `./src/lib/gitSync.ts`
- `./src/lib/tvDocs/index.ts`
- `./src/lib/tvDocs/generateQA.ts`
- `./src/lib/ai-knowledge-enhanced.ts`
- `./src/lib/ai-gain-service.ts`
- `./src/lib/firecube/sideload-service.ts`
- `./src/lib/firecube/app-discovery.ts`
- `./src/lib/firecube/sports-content-detector.ts`
- `./src/lib/firecube/keep-awake-scheduler.ts`
- `./src/lib/firecube/subscription-detector.ts`
- `./src/lib/scheduler-service.ts`
- `./src/db/index.ts`
- `./src/db/prisma-adapter.ts`
- `./check-mapping.js`
- `./scripts/rename-config-file.js`
- `./scripts/get-config-filename.js`
- `./scripts/reorder-presets-cron.js`
- `./scripts/setup-wolfpack-inputs.js`
- `./scripts/seed-directv-commands.ts`
- `./scripts/seed-wolfpack-config.js`
- `./scripts/init-soundtrack.js`
- `./scripts/final-verification.js`
- `./scripts/check-data.js`
- `./scripts/force_db_creation.ts`
- `./drizzle.config.ts`
- `./insert_qa_pairs.js`
- `./update_atlas.js`

## 📊 Detailed Analysis


### `./debug_remote_data.js`

**Line 2:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 5:**
```typescript
  const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 13:**
```typescript
    const matrixInputs = await prisma.matrixInput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 68:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 115:**
```typescript
    await prisma.$disconnect()
```

---



### `./src/scripts/reprocess-uploads.ts`

**Line 4:**
```typescript
import { prisma } from '../lib/db'
```

---

**Line 21:**
```typescript
      const existingDoc = await prisma.document.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 60:**
```typescript
        const document = await prisma.document.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 78:**
```typescript
    const totalDocs = await prisma.document.count()
```

---



### `./src/services/presetReorderService.ts`

**Line 2:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 4:**
```typescript
// Using singleton prisma from @/lib/prisma
```

---

**Line 15:**
```typescript
    const cablePresets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 23:**
```typescript
    const directvPresets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 33:**
```typescript
      await prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 41:**
```typescript
      await prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 65:**
```typescript
    const allPresets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 118:**
```typescript
    const presets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/selected-leagues/route.ts`

**Line 2:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 14:**
```typescript
    const selectedLeagues = await prisma.selectedLeague.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 57:**
```typescript
    await prisma.$transaction(async (tx) => {
```

---

**Line 104:**
```typescript
    await prisma.selectedLeague.updateMany({
```

---



### `./src/app/api/globalcache/learn/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 31:**
```typescript
    const device = await prisma.globalCacheDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 103:**
```typescript
    const device = await prisma.globalCacheDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/globalcache/ports/[id]/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 16:**
```typescript
    const port = await prisma.globalCachePort.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 50:**
```typescript
    const port = await prisma.globalCachePort.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/globalcache/devices/[id]/test/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 14:**
```typescript
    const device = await prisma.globalCacheDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 30:**
```typescript
    await prisma.globalCacheDevice.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/globalcache/devices/[id]/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 13:**
```typescript
    const device = await prisma.globalCacheDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 53:**
```typescript
    await prisma.globalCacheDevice.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---

**Line 83:**
```typescript
    const device = await prisma.globalCacheDevice.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/globalcache/devices/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 11:**
```typescript
    const devices = await prisma.globalCacheDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 64:**
```typescript
    const existingDevice = await prisma.globalCacheDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 80:**
```typescript
    const device = await prisma.globalCacheDevice.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/keys/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 9:**
```typescript
    const apiKeys = await prisma.apiKey.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 48:**
```typescript
    const apiKey = await prisma.apiKey.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 101:**
```typescript
    const apiKey = await prisma.apiKey.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 142:**
```typescript
    await prisma.apiKey.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/channel-presets/tune/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 60:**
```typescript
          await prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/channel-presets/[id]/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 17:**
```typescript
    const existingPreset = await prisma.channelPreset.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 44:**
```typescript
    const preset = await prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 75:**
```typescript
    const existingPreset = await prisma.channelPreset.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 86:**
```typescript
    await prisma.channelPreset.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/channel-presets/update-usage/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 26:**
```typescript
    const updatedPreset = await prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/channel-presets/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 14:**
```typescript
    const presets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 70:**
```typescript
      const maxOrderPreset = await prisma.channelPreset.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 77:**
```typescript
    const preset = await prisma.channelPreset.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/channel-presets/by-device/route.ts`

**Line 5:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 39:**
```typescript
    const presets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/api-keys/[id]/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 25:**
```typescript
    const apiKey = await prisma.apiKey.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 47:**
```typescript
    await prisma.apiKey.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/api-keys/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 8:**
```typescript
    const apiKeys = await prisma.apiKey.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 46:**
```typescript
    const apiKey = await prisma.apiKey.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/unified-tv-control/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 27:**
```typescript
    const cecConfig = await prisma.cECConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 36:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 59:**
```typescript
      const output = await prisma.matrixOutput.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 94:**
```typescript
      const outputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/todos/[id]/complete/route.ts`

**Line 3:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 28:**
```typescript
    const todo = await prisma.todo.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/todos/[id]/documents/route.ts`

**Line 3:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 16:**
```typescript
    const documents = await prisma.todoDocument.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 51:**
```typescript
    const todo = await prisma.todo.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 80:**
```typescript
    const document = await prisma.todoDocument.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 119:**
```typescript
    await prisma.todoDocument.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/todos/[id]/route.ts`

**Line 3:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 14:**
```typescript
    const todo = await prisma.todo.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 63:**
```typescript
    const todo = await prisma.todo.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 96:**
```typescript
    const todo = await prisma.todo.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 101:**
```typescript
    await prisma.todo.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/todos/route.ts`

**Line 3:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 21:**
```typescript
    const todos = await prisma.todo.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 59:**
```typescript
    const todo = await prisma.todo.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/matrix-display/route.ts`

**Line 5:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 51:**
```typescript
    const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 127:**
```typescript
    await prisma.$disconnect()
```

---



### `./src/app/api/tests/logs/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 25:**
```typescript
      prisma.testLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 31:**
```typescript
      prisma.testLog.count({ where })
```

---

**Line 60:**
```typescript
      const result = await prisma.testLog.deleteMany({
```

---

**Line 75:**
```typescript
      const result = await prisma.testLog.deleteMany({})
```

---



### `./src/app/api/tests/wolfpack/connection/route.ts`

**Line 3:**
```typescript
import prisma from '@/lib/prisma'
```

---

**Line 81:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 90:**
```typescript
      const errorLog = await prisma.testLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 138:**
```typescript
    const testLog = await prisma.testLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 187:**
```typescript
      const errorLog = await prisma.testLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/soundtrack/diagnose/route.ts`

**Line 4:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 10:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 40:**
```typescript
    await prisma.$disconnect()
```

---



### `./src/app/api/soundtrack/config/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 10:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 99:**
```typescript
    const existingConfig = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 102:**
```typescript
      ? await prisma.soundtrackConfig.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 112:**
```typescript
      : await prisma.soundtrackConfig.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 131:**
```typescript
          await prisma.soundtrackPlayer.upsert({
```

---

**Line 192:**
```typescript
    const player = await prisma.soundtrackPlayer.updateMany({
```

---

**Line 214:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 224:**
```typescript
    await prisma.soundtrackPlayer.deleteMany({
```

---

**Line 229:**
```typescript
    await prisma.soundtrackConfig.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/soundtrack/cache/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 15:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 28:**
```typescript
    await prisma.soundtrackConfig.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/soundtrack/now-playing/route.ts`

**Line 5:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 23:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/soundtrack/players/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 14:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 24:**
```typescript
    const dbPlayers = await prisma.soundtrackPlayer.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 79:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/soundtrack/stations/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 14:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/soundtrack/account/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 13:**
```typescript
    const config = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 32:**
```typescript
    await prisma.$disconnect()
```

---



### `./src/app/api/cec/discovery/route.ts`

**Line 10:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 69:**
```typescript
    const outputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/cec/config/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 9:**
```typescript
    const cecConfig = await prisma.cECConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 35:**
```typescript
    const savedConfig = await prisma.cECConfiguration.upsert({
```

---



### `./src/app/api/cec/power-control/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 20:**
```typescript
    const cecConfig = await prisma.cECConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 29:**
```typescript
    const activeMatrix = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 43:**
```typescript
      const activeOutputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/cec/enhanced-control/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 20:**
```typescript
    const cecConfig = await prisma.cECConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 31:**
```typescript
      const output = await prisma.matrixOutput.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/enhanced-chat/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 38:**
```typescript
      session = await prisma.chatSession.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 64:**
```typescript
      await prisma.chatSession.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 69:**
```typescript
      session = await prisma.chatSession.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 110:**
```typescript
    const documents = await prisma.document.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/audio-processor/[id]/ai-gain-control/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 20:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 99:**
```typescript
    let inputMeter = await prisma.audioInputMeter.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 108:**
```typescript
      inputMeter = await prisma.audioInputMeter.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 120:**
```typescript
    let aiConfig = await prisma.aIGainConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 144:**
```typescript
      aiConfig = await prisma.aIGainConfiguration.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 150:**
```typescript
      aiConfig = await prisma.aIGainConfiguration.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 192:**
```typescript
    const aiConfig = await prisma.aIGainConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 206:**
```typescript
    await prisma.aIGainConfiguration.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/audio-processor/[id]/zones-status/route.ts`

**Line 2:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 13:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/audio-processor/matrix-routing/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 8:**
```typescript
    const routings = await prisma.wolfpackMatrixRouting.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 14:**
```typescript
    const recentStates = await prisma.wolfpackMatrixState.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 46:**
```typescript
    const routing = await prisma.wolfpackMatrixRouting.upsert({
```

---



### `./src/app/api/audio-processor/zones/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 17:**
```typescript
    const zones = await prisma.audioZone.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 44:**
```typescript
    const zone = await prisma.audioZone.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/audio-processor/outputs/route.ts`

**Line 5:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 30:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/audio-processor/input-levels/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 22:**
```typescript
    const inputMeters = await prisma.audioInputMeter.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 50:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 61:**
```typescript
    const inputMeter = await prisma.audioInputMeter.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 140:**
```typescript
    await prisma.audioInputMeter.updateMany({
```

---



### `./src/app/api/audio-processor/meter-status/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 19:**
```typescript
    const inputMeters = await prisma.audioInputMeter.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 91:**
```typescript
    await prisma.audioInputMeter.updateMany({
```

---



### `./src/app/api/audio-processor/inputs/route.ts`

**Line 5:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 28:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/atlas/query-hardware/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 26:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 141:**
```typescript
    await prisma.audioProcessor.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 151:**
```typescript
      await prisma.audioZone.upsert({
```

---



### `./src/app/api/atlas/ai-analysis/route.ts`

**Line 8:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 26:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 82:**
```typescript
    const historicalData = await prisma.audioInputMeter.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 120:**
```typescript
  const recentMeters = await prisma.audioInputMeter.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/atlas/route-matrix-to-zone/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 33:**
```typescript
      ? await prisma.audioProcessor.findUnique({ where: { id: processorId } })
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 34:**
```typescript
      : await prisma.audioProcessor.findFirst({ where: { status: 'online' } })
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 44:**
```typescript
    const matrixRouting = await prisma.wolfpackMatrixRouting.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 53:**
```typescript
        return await prisma.audioZone.upsert({
```

---

**Line 87:**
```typescript
    await prisma.wolfpackMatrixRouting.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 137:**
```typescript
      ? await prisma.audioProcessor.findUnique({ 
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 141:**
```typescript
      : await prisma.audioProcessor.findFirst({ 
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 154:**
```typescript
    const matrixRoutings = await prisma.wolfpackMatrixRouting.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/system/status/route.ts`

**Line 5:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 77:**
```typescript
    const totalDocs = await prisma.document.count()
```

---

**Line 78:**
```typescript
    const docsWithContent = await prisma.document.count({
```

---

**Line 106:**
```typescript
    await prisma.$queryRaw`SELECT 1`
```

---

**Line 109:**
```typescript
    const documentCount = await prisma.document.count()
```

---

**Line 110:**
```typescript
    const sessionCount = await prisma.chatSession.count()
```

---

**Line 111:**
```typescript
    const keyCount = await prisma.apiKey.count()
```

---



### `./src/app/api/backup/route.ts`

**Line 68:**
```typescript
        prisma/dev.db 
```

---

**Line 122:**
```typescript
        prisma/dev.db 
```

---



### `./src/app/api/sports-guide/current-time/route.ts`

**Line 4:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 13:**
```typescript
    const config = await prisma.sportsGuideConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/schedules/logs/route.ts`

**Line 5:**
```typescript
import { prisma } from '@/lib/db';
```

---

**Line 17:**
```typescript
    const logs = await prisma.scheduleLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/schedules/[id]/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db';
```

---

**Line 12:**
```typescript
    const schedule = await prisma.schedule.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 61:**
```typescript
    const schedule = await prisma.schedule.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 82:**
```typescript
    await prisma.schedule.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/schedules/execute/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db';
```

---

**Line 18:**
```typescript
    const schedule = await prisma.schedule.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 33:**
```typescript
    await prisma.schedule.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 43:**
```typescript
    await prisma.scheduleLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 88:**
```typescript
    const outputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 205:**
```typescript
    const homeTeams = await prisma.homeTeam.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/matrix-config/route.ts`

**Line 2:**
```typescript
import prisma from '@/lib/prisma';
```

---

**Line 6:**
```typescript
    const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/sports-guide-config/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 42:**
```typescript
    const config = await prisma.sportsGuideConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 46:**
```typescript
    const providers = await prisma.tVProvider.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 57:**
```typescript
    const homeTeams = await prisma.homeTeam.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 67:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 112:**
```typescript
    const config = await prisma.sportsGuideConfiguration.upsert({
```

---

**Line 132:**
```typescript
    await prisma.providerInput.deleteMany()
```

---

**Line 133:**
```typescript
    await prisma.tVProvider.deleteMany({ where: { isActive: true } })
```

---

**Line 138:**
```typescript
        const createdProvider = await prisma.tVProvider.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 150:**
```typescript
          await prisma.providerInput.createMany({
```

---

**Line 161:**
```typescript
    await prisma.homeTeam.deleteMany({ where: { isActive: true } })
```

---

**Line 164:**
```typescript
      await prisma.homeTeam.createMany({
```

---



### `./src/app/api/matrix/config/route.ts`

**Line 2:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 7:**
```typescript
    const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 84:**
```typescript
    const result = await prisma.$transaction(async (tx) => {
```

---



### `./src/app/api/matrix/initialize-connection/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 15:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/matrix/test-connection/route.ts`

**Line 4:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 10:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/matrix/connection-manager/route.ts`

**Line 5:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 67:**
```typescript
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/matrix/outputs-schedule/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 9:**
```typescript
    const activeConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 67:**
```typescript
    const updated = await prisma.matrixOutput.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/matrix/route/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 19:**
```typescript
    const activeConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 35:**
```typescript
    const existingRoute = await prisma.matrixRoute.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 41:**
```typescript
      await prisma.matrixRoute.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 50:**
```typescript
      await prisma.matrixRoute.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/ai/qa-entries/route.ts`

**Line 9:**
```typescript
import { prisma } from '@/lib/db';
```

---

**Line 144:**
```typescript
      const entry = await prisma.qAEntry.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/ai/analyze-layout/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 110:**
```typescript
      const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 175:**
```typescript
    await prisma.$disconnect()
```

---



### `./src/app/api/ai/run-diagnostics/route.ts`

**Line 2:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 35:**
```typescript
        await prisma.$queryRaw`SELECT 1`
```

---

**Line 58:**
```typescript
        const apiKeys = await prisma.apiKey.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 92:**
```typescript
        const matrixInputs = await prisma.matrixInput.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 166:**
```typescript
        const matrixInputs = await prisma.matrixInput.findMany({ where: { isActive: true } })
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 248:**
```typescript
        const recentLogs = await prisma.testLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 371:**
```typescript
      const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
```

---

**Line 372:**
```typescript
      const apiKeys = await prisma.apiKey.findMany().catch(() => [] as any[])
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/ir/database/download/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 38:**
```typescript
    const credentials = await prisma.iRDatabaseCredentials.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 76:**
```typescript
        const existingCommand = await prisma.iRCommand.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 87:**
```typescript
          const updated = await prisma.iRCommand.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 100:**
```typescript
          const created = await prisma.iRCommand.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 129:**
```typescript
    await prisma.iRDevice.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/app/api/ir/credentials/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 46:**
```typescript
    const credentials = await prisma.iRDatabaseCredentials.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 128:**
```typescript
    await prisma.iRDatabaseCredentials.updateMany({
```

---

**Line 134:**
```typescript
    const credentials = await prisma.iRDatabaseCredentials.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/ir/commands/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 43:**
```typescript
    const command = await prisma.iRCommand.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 110:**
```typescript
    await prisma.iRCommand.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/ir/devices/[id]/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 22:**
```typescript
    const device = await prisma.iRDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 110:**
```typescript
    const device = await prisma.iRDevice.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 174:**
```typescript
    await prisma.iRDevice.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---



### `./src/app/api/ir/devices/route.ts`

**Line 4:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 18:**
```typescript
    const devices = await prisma.iRDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 98:**
```typescript
    const device = await prisma.iRDevice.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/app/api/upload/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 56:**
```typescript
        const document = await prisma.document.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 98:**
```typescript
    const documents = await prisma.document.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/diagnostics/device-mapping/route.ts`

**Line 3:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 23:**
```typescript
    const wolfPackInputs = await prisma.matrixInput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/documents/[id]/route.ts`

**Line 3:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 14:**
```typescript
    const document = await prisma.document.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 31:**
```typescript
    await prisma.document.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---

**Line 52:**
```typescript
    const document = await prisma.document.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/app/api/documents/reprocess/route.ts`

**Line 50:**
```typescript
    const { prisma } = await import('@/lib/db')
```

---

**Line 52:**
```typescript
    const totalDocs = await prisma.document.count()
```

---

**Line 53:**
```typescript
    const docsWithContent = await prisma.document.count({
```

---



### `./src/app/api/ai-assistant/index-codebase/route.ts`

**Line 12:**
```typescript
const INCLUDED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.prisma'];
```

---

**Line 26:**
```typescript
  'prisma/data'
```

---

**Line 80:**
```typescript
    '.prisma': 'prisma-schema'
```

---



### `./src/app/api/chat/route.ts`

**Line 8:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 218:**
```typescript
      session = await prisma.chatSession.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 394:**
```typescript
      await prisma.chatSession.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 449:**
```typescript
    session = await prisma.chatSession.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 502:**
```typescript
    await prisma.chatSession.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/lib/atlas-meter-service.ts`

**Line 6:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 8:**
```typescript
// Using singleton prisma from @/lib/prisma
```

---

**Line 63:**
```typescript
      const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 78:**
```typescript
        await prisma.audioInputMeter.upsert({
```

---

**Line 104:**
```typescript
      await prisma.audioProcessor.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 169:**
```typescript
    const result = await prisma.audioInputMeter.deleteMany({
```

---



### `./src/lib/ai-tools/security/config.ts`

**Line 51:**
```typescript
      path.join(PROJECT_ROOT, 'prisma'),
```

---



### `./src/lib/db.ts`

**Line 4:**
```typescript
import { prisma } from '@/db/prisma-adapter'
```

---

**Line 7:**
```typescript
export { prisma, db }
```

---



### `./src/lib/api-keys.ts`

**Line 4:**
```typescript
import { prisma } from './db'
```

---

**Line 21:**
```typescript
    const apiKeys = await prisma.apiKey.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 45:**
```typescript
    const apiKey = await prisma.apiKey.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 68:**
```typescript
    const apiKeys = await prisma.apiKey.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 184:**
```typescript
    const count = await prisma.apiKey.count({
```

---



### `./src/lib/enhanced-document-search.ts`

**Line 2:**
```typescript
import { prisma } from './db'
```

---

**Line 21:**
```typescript
      const documents = await prisma.document.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 206:**
```typescript
      const documents = await prisma.document.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 222:**
```typescript
          await prisma.document.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/lib/prisma.ts`

**Line 7:**
```typescript
 * OLD: import { prisma } from '@/lib/prisma'
```

---

**Line 8:**
```typescript
 *      await prisma.schedule.findMany({ where: { enabled: true } })
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 20:**
```typescript
import { prisma } from '@/db/prisma-adapter'
```

---

**Line 25:**
```typescript
export default prisma
```

---



### `./src/lib/services/qa-uploader.ts`

**Line 7:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 9:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 268:**
```typescript
      await prisma.qAEntry.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/lib/services/qa-generator.ts`

**Line 9:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 45:**
```typescript
  const job = await prisma.qAGenerationJob.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 55:**
```typescript
    prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 103:**
```typescript
    const tracked = await prisma.processedFile.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 139:**
```typescript
    await prisma.processedFile.upsert({
```

---

**Line 171:**
```typescript
    await prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 181:**
```typescript
    await prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 236:**
```typescript
            await prisma.qAEntry.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 280:**
```typescript
    await prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 293:**
```typescript
    await prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 307:**
```typescript
    await prisma.qAGenerationJob.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 650:**
```typescript
  return await prisma.qAGenerationJob.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 673:**
```typescript
  const entries = await prisma.qAEntry.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 680:**
```typescript
  const total = await prisma.qAEntry.count({ where });
```

---

**Line 711:**
```typescript
  const entries = await prisma.qAEntry.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 735:**
```typescript
  return await prisma.qAEntry.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 745:**
```typescript
  return await prisma.qAEntry.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---

**Line 758:**
```typescript
    prisma.qAEntry.count(),
```

---

**Line 759:**
```typescript
    prisma.qAEntry.count({ where: { isActive: true } }),
```

---

**Line 760:**
```typescript
    prisma.qAEntry.groupBy({
```

---

**Line 764:**
```typescript
    prisma.qAEntry.groupBy({
```

---

**Line 768:**
```typescript
    prisma.qAGenerationJob.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/services/cec-discovery-service.ts`

**Line 9:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 13:**
```typescript
// Using singleton prisma from @/lib/prisma
```

---

**Line 65:**
```typescript
  let cecConfig = await prisma.cECConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 69:**
```typescript
    cecConfig = await prisma.cECConfiguration.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 160:**
```typescript
    const outputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 199:**
```typescript
        await prisma.matrixOutput.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 287:**
```typescript
    const output = await prisma.matrixOutput.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 320:**
```typescript
      await prisma.matrixOutput.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/lib/ai-knowledge-qa.ts`

**Line 7:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 10:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 40:**
```typescript
    const entries = await prisma.qAEntry.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 95:**
```typescript
      await prisma.qAEntry.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/lib/gitSync.ts`

**Line 6:**
```typescript
import prisma from '@/lib/prisma';
```

---

**Line 81:**
```typescript
  const todos = await prisma.todo.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/tvDocs/index.ts`

**Line 8:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 14:**
```typescript
// Using singleton prisma from @/lib/prisma
```

---

**Line 34:**
```typescript
        const existingQA = await prisma.qAEntry.count({
```

---

**Line 115:**
```typescript
    const outputs = await prisma.matrixOutput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 135:**
```typescript
      const qaCount = await prisma.qAEntry.count({
```

---



### `./src/lib/tvDocs/generateQA.ts`

**Line 8:**
```typescript
import prisma from "@/lib/prisma"
```

---

**Line 11:**
```typescript
// Using singleton prisma from @/lib/prisma
```

---

**Line 134:**
```typescript
        await prisma.qAEntry.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---



### `./src/lib/ai-knowledge-enhanced.ts`

**Line 2:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 5:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 29:**
```typescript
    const files = await prisma.indexedFile.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 185:**
```typescript
    const file = await prisma.indexedFile.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 200:**
```typescript
    const stats = await prisma.indexedFile.aggregate({
```

---

**Line 208:**
```typescript
    const filesByType = await prisma.indexedFile.groupBy({
```

---



### `./src/lib/ai-gain-service.ts`

**Line 2:**
```typescript
import { prisma } from '@/lib/db'
```

---

**Line 47:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 91:**
```typescript
    const aiConfigs = await prisma.aIGainConfiguration.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 107:**
```typescript
    const processor = await prisma.audioProcessor.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 144:**
```typescript
      await prisma.aIGainConfiguration.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 160:**
```typescript
            await prisma.aIGainConfiguration.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 178:**
```typescript
        await prisma.aIGainConfiguration.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 222:**
```typescript
      await prisma.aIGainConfiguration.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 233:**
```typescript
      await prisma.aIGainAdjustmentLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 258:**
```typescript
      await prisma.aIGainAdjustmentLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 340:**
```typescript
    return await prisma.aIGainAdjustmentLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 356:**
```typescript
    const configs = await prisma.aIGainConfiguration.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/firecube/sideload-service.ts`

**Line 5:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 10:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 44:**
```typescript
      const sourceDevice = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 53:**
```typescript
      const app = await prisma.fireCubeApp.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 65:**
```typescript
      const operation = await prisma.fireCubeSideloadOperation.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 131:**
```typescript
          const targetDevice = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 150:**
```typescript
            await prisma.fireCubeApp.upsert({
```

---

**Line 206:**
```typescript
      await prisma.fireCubeSideloadOperation.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 222:**
```typescript
      await prisma.fireCubeSideloadOperation.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 253:**
```typescript
    await prisma.fireCubeSideloadOperation.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 264:**
```typescript
      const operation = await prisma.fireCubeSideloadOperation.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 288:**
```typescript
      const operations = await prisma.fireCubeSideloadOperation.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 310:**
```typescript
      const apps = await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 350:**
```typescript
      const devices = await prisma.fireCubeDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 375:**
```typescript
      const operation = await prisma.fireCubeSideloadOperation.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 387:**
```typescript
      await prisma.fireCubeSideloadOperation.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---



### `./src/lib/firecube/app-discovery.ts`

**Line 6:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 8:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 98:**
```typescript
      const existingApps = await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 109:**
```typescript
          await prisma.fireCubeApp.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 128:**
```typescript
          await prisma.fireCubeApp.updateMany({
```

---

**Line 147:**
```typescript
          await prisma.fireCubeApp.delete({
```

💡 **Suggestion:** Use `db.delete(table).where(condition)`

---

**Line 163:**
```typescript
      return await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 181:**
```typescript
      return await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 199:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 224:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/firecube/sports-content-detector.ts`

**Line 6:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 8:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 17:**
```typescript
      const subscribedApps = await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 127:**
```typescript
      await prisma.fireCubeSportsContent.deleteMany({
```

---

**Line 138:**
```typescript
        await prisma.fireCubeSportsContent.upsert({
```

---

**Line 175:**
```typescript
      return await prisma.fireCubeSportsContent.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 198:**
```typescript
      return await prisma.fireCubeSportsContent.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 224:**
```typescript
      return await prisma.fireCubeSportsContent.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 249:**
```typescript
      return await prisma.fireCubeSportsContent.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/firecube/keep-awake-scheduler.ts`

**Line 6:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 8:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 18:**
```typescript
      const devices = await prisma.fireCubeDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 47:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 141:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 172:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 204:**
```typescript
      const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 240:**
```typescript
      await prisma.fireCubeKeepAwakeLog.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 269:**
```typescript
      await prisma.fireCubeDevice.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 290:**
```typescript
      return await prisma.fireCubeKeepAwakeLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 306:**
```typescript
      const devices = await prisma.fireCubeDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 313:**
```typescript
        const recentLogs = await prisma.fireCubeKeepAwakeLog.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/firecube/subscription-detector.ts`

**Line 6:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 8:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 18:**
```typescript
    const device = await prisma.fireCubeDevice.findUnique({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 217:**
```typescript
      const apps = await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 228:**
```typescript
          await prisma.fireCubeApp.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 251:**
```typescript
      return await prisma.fireCubeApp.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 271:**
```typescript
      const devices = await prisma.fireCubeDevice.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/lib/scheduler-service.ts`

**Line 9:**
```typescript
import prisma from "@/lib/prisma";
```

---

**Line 11:**
```typescript
// Using singleton prisma from @/lib/prisma;
```

---

**Line 58:**
```typescript
      const schedules = await prisma.schedule.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---



### `./src/db/index.ts`

**Line 8:**
```typescript
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'
```

---



### `./src/db/prisma-adapter.ts`

**Line 7:**
```typescript
 * OLD: import { prisma } from '@/lib/db'
```

---

**Line 8:**
```typescript
 *      await prisma.schedule.findMany({ where: { enabled: true } })
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 92:**
```typescript
console.warn(`[prisma-adapter] Column ${field} not found in table`)
```

---

**Line 421:**
```typescript
export const prisma = {
```

---

**Line 535:**
```typescript
return callback(prisma)
```

---

**Line 545:**
```typescript
export default prisma
```

---



### `./check-mapping.js`

**Line 2:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 6:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 11:**
```typescript
    const wolfPackInputs = await prisma.matrixInput.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 68:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/rename-config-file.js`

**Line 7:**
```typescript
const { PrismaClient } = require('@prisma/client');
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 11:**
```typescript
const prisma = new PrismaClient();
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 17:**
```typescript
    const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 67:**
```typescript
    await prisma.$disconnect();
```

---



### `./scripts/get-config-filename.js`

**Line 7:**
```typescript
const { PrismaClient } = require('@prisma/client');
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 9:**
```typescript
const prisma = new PrismaClient();
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 13:**
```typescript
    const config = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 26:**
```typescript
    await prisma.$disconnect();
```

---



### `./scripts/reorder-presets-cron.js`

**Line 16:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 18:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 60:**
```typescript
  const presets = await prisma.channelPreset.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 102:**
```typescript
    return prisma.channelPreset.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 125:**
```typescript
    await prisma.$disconnect()
```

---

**Line 129:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/setup-wolfpack-inputs.js`

**Line 2:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 6:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 13:**
```typescript
    let matrixConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 19:**
```typescript
      matrixConfig = await prisma.matrixConfiguration.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 80:**
```typescript
    await prisma.matrixInput.deleteMany({
```

---

**Line 86:**
```typescript
      await prisma.matrixInput.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 203:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/seed-directv-commands.ts`

**Line 4:**
```typescript
import { prisma } from '../src/lib/db';
```

---

**Line 18:**
```typescript
      await prisma.direcTVCommand.upsert({
```

---

**Line 60:**
```typescript
    await prisma.$disconnect();
```

---



### `./scripts/seed-wolfpack-config.js`

**Line 11:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 12:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 19:**
```typescript
    const existingConfig = await prisma.matrixConfiguration.findFirst({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 34:**
```typescript
      matrixConfig = await prisma.matrixConfiguration.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 49:**
```typescript
    const deletedInputs = await prisma.matrixInput.deleteMany({
```

---

**Line 52:**
```typescript
    const deletedOutputs = await prisma.matrixOutput.deleteMany({
```

---

**Line 71:**
```typescript
      await prisma.matrixInput.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 92:**
```typescript
      await prisma.matrixOutput.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 117:**
```typescript
      await prisma.matrixOutput.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 137:**
```typescript
    const inputCount = await prisma.matrixInput.count({
```

---

**Line 140:**
```typescript
    const outputCount = await prisma.matrixOutput.count({
```

---

**Line 164:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/init-soundtrack.js`

**Line 1:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 3:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 12:**
```typescript
    const existing = await prisma.soundtrackConfig.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 16:**
```typescript
      await prisma.soundtrackConfig.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 27:**
```typescript
      await prisma.soundtrackConfig.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 46:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/final-verification.js`

**Line 1:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 2:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 9:**
```typescript
  const matrixConfig = await prisma.matrixConfiguration.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 19:**
```typescript
    const inputCount = await prisma.matrixInput.count({ where: { configId: matrixConfig.id } })
```

---

**Line 20:**
```typescript
    const outputCount = await prisma.matrixOutput.count({ where: { configId: matrixConfig.id } })
```

---

**Line 28:**
```typescript
  const audioProcessor = await prisma.audioProcessor.findFirst()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 38:**
```typescript
    const zoneCount = await prisma.audioZone.count({ where: { processorId: audioProcessor.id } })
```

---

**Line 55:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/check-data.js`

**Line 1:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 2:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 8:**
```typescript
  const matrixConfigs = await prisma.matrixConfiguration.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 15:**
```typescript
  const audioProcessors = await prisma.audioProcessor.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 22:**
```typescript
  const audioZones = await prisma.audioZone.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 34:**
```typescript
    await prisma.$disconnect()
```

---



### `./scripts/force_db_creation.ts`

**Line 21:**
```typescript
const DB_PATH = join(process.cwd(), 'prisma', 'dev.db');
```

---

**Line 22:**
```typescript
const BACKUP_PATH = join(process.cwd(), 'prisma', 'dev.db.backup');
```

---

**Line 160:**
```typescript
    'npx prisma db push --accept-data-loss --skip-generate',
```

---

**Line 173:**
```typescript
      'npx prisma migrate reset --force --skip-generate --skip-seed',
```

---

**Line 197:**
```typescript
  executeCommand('npx prisma generate', 'Prisma Client Generation');
```

---



### `./drizzle.config.ts`

**Line 9:**
```typescript
    url: process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'
```

---



### `./insert_qa_pairs.js`

**Line 1:**
```typescript
const { PrismaClient } = require('@prisma/client');
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 4:**
```typescript
const prisma = new PrismaClient();
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 18:**
```typescript
        await prisma.qAEntry.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 48:**
```typescript
    const totalCount = await prisma.qAEntry.count();
```

---

**Line 53:**
```typescript
    const samples = await prisma.qAEntry.findMany({
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 67:**
```typescript
    await prisma.$disconnect();
```

---



### `./update_atlas.js`

**Line 1:**
```typescript
const { PrismaClient } = require('@prisma/client')
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 2:**
```typescript
const prisma = new PrismaClient()
```

💡 **Suggestion:** Replace PrismaClient with Drizzle database connection

---

**Line 7:**
```typescript
  const processors = await prisma.audioProcessor.findMany()
```

💡 **Suggestion:** Use `db.select().from(table)` with appropriate `where()` clauses

---

**Line 20:**
```typescript
    const updated = await prisma.audioProcessor.update({
```

💡 **Suggestion:** Use `db.update(table).set(data).where(condition).returning()`

---

**Line 41:**
```typescript
    const processor = await prisma.audioProcessor.create({
```

💡 **Suggestion:** Use `db.insert(table).values(data).returning()`

---

**Line 68:**
```typescript
    await prisma.$disconnect()
```

---

## 🎯 Migration Priority

### High Priority (Critical Path)
1. **Database Connection Files**
   - `src/lib/prisma.ts` - Core Prisma client instantiation
   - `src/lib/db.ts` - Database connection wrapper
   - `src/db/prisma-adapter.ts` - Prisma adapter layer

### Medium Priority (API Routes)
2. **API Endpoints** - All route handlers using Prisma queries
   - Channel presets management
   - Global Cache device management
   - Matrix configuration
   - Soundtrack integration
   - CEC control
   - Audio processor control
   - Todo management
   - Document management

### Low Priority (Scripts & Utilities)
3. **Maintenance Scripts**
   - Seed scripts
   - Cron jobs
   - Debug utilities

## 💡 Migration Patterns

### Pattern 1: PrismaClient Instantiation
**Current (Prisma):**
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

**Migrated (Drizzle):**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './db/schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })
```

### Pattern 2: Query Operations
**Current (Prisma):**
```typescript
// Find many
const items = await prisma.model.findMany({ where: { status: 'active' } })

// Find unique
const item = await prisma.model.findUnique({ where: { id } })

// Create
const newItem = await prisma.model.create({ data: { name: 'test' } })

// Update
const updated = await prisma.model.update({ 
  where: { id }, 
  data: { name: 'updated' } 
})

// Delete
await prisma.model.delete({ where: { id } })
```

**Migrated (Drizzle):**
```typescript
import { eq, and } from 'drizzle-orm'

// Find many
const items = await db.select().from(model).where(eq(model.status, 'active'))

// Find unique
const item = await db.select().from(model).where(eq(model.id, id)).limit(1)

// Create
const newItem = await db.insert(model).values({ name: 'test' }).returning()

// Update
const updated = await db.update(model)
  .set({ name: 'updated' })
  .where(eq(model.id, id))
  .returning()

// Delete
await db.delete(model).where(eq(model.id, id))
```

### Pattern 3: Transactions
**Current (Prisma):**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.model1.create({ data: {...} })
  await tx.model2.update({ where: {...}, data: {...} })
})
```

**Migrated (Drizzle):**
```typescript
await db.transaction(async (tx) => {
  await tx.insert(model1).values({...})
  await tx.update(model2).set({...}).where(eq(model2.id, id))
})
```

## 📚 Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle vs Prisma Comparison](https://orm.drizzle.team/docs/prisma-to-drizzle)
- [Migration Guide](https://orm.drizzle.team/docs/migrations)
- [Drizzle Query Examples](https://orm.drizzle.team/docs/select)

## ✅ Next Steps

1. **Phase 1:** Migrate core database connection files (`src/lib/prisma.ts`, `src/lib/db.ts`)
2. **Phase 2:** Update API routes in batches (start with least critical endpoints)
3. **Phase 3:** Migrate utility scripts and cron jobs
4. **Phase 4:** Remove Prisma dependencies from `package.json`
5. **Phase 5:** Delete Prisma schema and migration files

## 🔧 Testing Strategy

- Test each migrated endpoint individually
- Verify database queries return expected results
- Check transaction handling
- Validate error handling
- Ensure backward compatibility during transition

---

**Report generated by:** Prisma to Drizzle Migration Scanner (n8n workflow)
**Scan date:** 2025-10-24T01-57-30Z
