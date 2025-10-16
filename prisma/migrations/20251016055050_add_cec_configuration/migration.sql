-- CreateTable
CREATE TABLE IF NOT EXISTS "CECConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cecInputChannel" INTEGER,
    "usbDevicePath" TEXT NOT NULL DEFAULT '/dev/ttyACM0',
    "powerOnDelay" INTEGER NOT NULL DEFAULT 2000,
    "powerOffDelay" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: Add CEC fields to MatrixOutput
ALTER TABLE "MatrixOutput" ADD COLUMN "tvBrand" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "tvModel" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "cecAddress" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "lastDiscovery" DATETIME;
