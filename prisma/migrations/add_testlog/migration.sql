
-- CreateTable
CREATE TABLE "TestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testType" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputChannel" INTEGER,
    "outputChannel" INTEGER,
    "command" TEXT,
    "response" TEXT,
    "errorMessage" TEXT,
    "duration" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT
);

-- CreateIndex
CREATE INDEX "TestLog_testType_idx" ON "TestLog"("testType");
CREATE INDEX "TestLog_status_idx" ON "TestLog"("status");
CREATE INDEX "TestLog_timestamp_idx" ON "TestLog"("timestamp");
