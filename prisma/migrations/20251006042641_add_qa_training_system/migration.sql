/*
  Warnings:

  - You are about to drop the `NFHSGame` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NFHSSchool` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NFHSGame";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NFHSSchool";
PRAGMA foreign_keys=on;
