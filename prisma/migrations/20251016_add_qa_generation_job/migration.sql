-- CreateTable
CREATE TABLE "QAGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceType" TEXT NOT NULL,
    "sourcePath" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "generatedQAs" INTEGER NOT NULL DEFAULT 0,
    "entriesGenerated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "QAGenerationJob_status_idx" ON "QAGenerationJob"("status");

-- CreateIndex
CREATE INDEX "QAGenerationJob_createdAt_idx" ON "QAGenerationJob"("createdAt");
