-- CreateTable
CREATE TABLE "WolfpackMatrixRouting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matrixOutputNumber" INTEGER NOT NULL,
    "wolfpackInputNumber" INTEGER,
    "wolfpackInputLabel" TEXT,
    "atlasInputLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRouted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WolfpackMatrixState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matrixOutputNumber" INTEGER NOT NULL,
    "wolfpackInputNumber" INTEGER NOT NULL,
    "wolfpackInputLabel" TEXT NOT NULL,
    "channelInfo" TEXT,
    "routedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "WolfpackMatrixRouting_matrixOutputNumber_idx" ON "WolfpackMatrixRouting"("matrixOutputNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WolfpackMatrixRouting_matrixOutputNumber_key" ON "WolfpackMatrixRouting"("matrixOutputNumber");

-- CreateIndex
CREATE INDEX "WolfpackMatrixState_matrixOutputNumber_idx" ON "WolfpackMatrixState"("matrixOutputNumber");

-- CreateIndex
CREATE INDEX "WolfpackMatrixState_routedAt_idx" ON "WolfpackMatrixState"("routedAt");
