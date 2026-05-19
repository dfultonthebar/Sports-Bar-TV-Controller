# @sports-bar/utils

**Purpose:** General shared utilities — encryption, cron parsing/description, file I/O + locking, project-path resolution, AI knowledge base, text extraction (PDF), file hashing, and the cache service.

**Key exports** (`src/index.ts`):
- Encryption: `encrypt`, `decrypt` (`src/encryption.ts`)
- Cron (`src/cron-utils.ts`): `isValidCronExpression`, `getNextExecution`, `describeCronExpression`, `getNextExecutions`, `validateCronWithMessage`, `getCronExecutionInfo`, `getCronPreset`, `listCronPresets`, `CRON_PRESETS`
- File utils (`src/file-utils.ts`): `generateUniqueFilename`, `saveFile`, `saveUploadedFile`, `deleteFile`, `getFileExtension`, `isValidFileType`, `ensureDirectoryExists`
- File locking: `withFileLock` (`src/file-lock.ts`)
- Paths (`src/paths.ts`): `getProjectRoot`, `getDataDir`, `getDataPath`, `getRagDataDir`, `getLogsDir`, `getMemoryBankDir`, `getDocsDir`, `DataFiles`, `resetPathCache`
- AI knowledge (`src/ai-knowledge.ts`): `loadKnowledgeBase`, `searchKnowledgeBase`, `getKnowledgeBaseStats`, `buildContext`, `buildContextFromDocs`, `DocumentChunk`
- Text extraction (`src/text-extractor.ts`): `extractTextFromFile`, `cleanExtractedText`, `extractAndCleanText`, `TextExtractionResult` (uses `pdf-parse`)
- File hashing (`src/file-hash.ts`): `calculateFileHash`, `calculateContentHash`
- `cacheService` (`src/cache-service.ts`)
- `config-change-tracker.ts`, `enhanced-logger.ts`, `git-sync.ts`

**Protocol / port:** N/A — local filesystem + crypto.

**Used by:** Cross-cutting across `apps/web` and several packages.

**Gotchas:**
- The `encrypt` / `decrypt` here is the **legacy / general** path; the dedicated `@sports-bar/security` package exposes `encryptToString` / `decryptFromString` and `validateEncryptionSetup`. Both should converge — check git history before swapping consumers.
- `paths.ts` is the single source of truth for project-relative paths — don't hand-roll `path.join(__dirname, '../..')` chains, they break under PM2.
- `withFileLock` is OS-level file lock — required for any process-shared file (e.g. config JSON).

**See also:**
- `@sports-bar/security` (newer encryption surface)
- `@sports-bar/cache-manager` (newer cache surface — prefer for new code)
