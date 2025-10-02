
-- CreateTable
CREATE TABLE IF NOT EXISTS "IndexedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "lastModified" DATETIME NOT NULL,
    "lastIndexed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "IndexedFile_filePath_key" ON "IndexedFile"("filePath");

-- CreateIndex
CREATE INDEX "IndexedFile_fileType_idx" ON "IndexedFile"("fileType");

-- CreateIndex
CREATE INDEX "IndexedFile_lastIndexed_idx" ON "IndexedFile"("lastIndexed");
