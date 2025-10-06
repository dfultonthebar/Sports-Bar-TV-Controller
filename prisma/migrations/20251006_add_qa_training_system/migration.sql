
-- CreateTable
CREATE TABLE "QAEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceFile" TEXT,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QAGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceType" TEXT NOT NULL,
    "sourcePath" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "generatedQAs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "QAEntry_category_idx" ON "QAEntry"("category");
CREATE INDEX "QAEntry_sourceType_idx" ON "QAEntry"("sourceType");
CREATE INDEX "QAEntry_isActive_idx" ON "QAEntry"("isActive");
CREATE INDEX "QAEntry_usageCount_idx" ON "QAEntry"("usageCount");
CREATE INDEX "QAGenerationJob_status_idx" ON "QAGenerationJob"("status");
