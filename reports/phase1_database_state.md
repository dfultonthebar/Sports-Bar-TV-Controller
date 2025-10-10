# Phase 1: Database State Report

**Date:** October 10, 2025  
**Server:** 24.123.87.42:224  
**Project:** ~/Sports-Bar-TV-Controller  
**Database:** SQLite at ./prisma/data/sports_bar.db

## Database Schema

### MatrixConfiguration Table
Stores matrix switcher configuration.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - Unique identifier
- `name` (TEXT) - Configuration name
- `ipAddress` (TEXT) - Matrix IP address
- `tcpPort` (INTEGER, DEFAULT 23) - TCP port
- `udpPort` (INTEGER, DEFAULT 4000) - UDP port
- `protocol` (TEXT, DEFAULT 'TCP') - Communication protocol
- `isActive` (BOOLEAN, DEFAULT true) - Active flag
- `cecInputChannel` (INTEGER, NULLABLE) - CEC input channel
- `createdAt` (DATETIME) - Creation timestamp
- `updatedAt` (DATETIME) - Last update timestamp

### MatrixInput Table
Stores input channel configuration.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - Unique identifier
- `configId` (TEXT, FOREIGN KEY) - References MatrixConfiguration.id
- `channelNumber` (INTEGER) - Input channel number (1-36)
- `label` (TEXT) - Input label/name
- `inputType` (TEXT, DEFAULT 'HDMI') - Input type
- `deviceType` (TEXT, DEFAULT 'Other') - Device type
- `isActive` (BOOLEAN, DEFAULT true) - Active flag
- `status` (TEXT, DEFAULT 'active') - Status
- `powerOn` (BOOLEAN, DEFAULT false) - Power state
- `isCecPort` (BOOLEAN, DEFAULT false) - CEC port flag
- `createdAt` (DATETIME) - Creation timestamp
- `updatedAt` (DATETIME) - Last update timestamp

**Unique Constraint:** (configId, channelNumber)

### MatrixOutput Table
Stores output channel configuration.

**Columns:**
- `id` (TEXT, PRIMARY KEY) - Unique identifier
- `configId` (TEXT, FOREIGN KEY) - References MatrixConfiguration.id
- `channelNumber` (INTEGER) - Output channel number (1-36)
- `label` (TEXT) - Output label/name
- `resolution` (TEXT, DEFAULT '1080p') - Resolution
- `isActive` (BOOLEAN, DEFAULT true) - Active flag
- `status` (TEXT, DEFAULT 'active') - Status
- `audioOutput` (TEXT, NULLABLE) - Audio output configuration
- `powerOn` (BOOLEAN, DEFAULT false) - Power state
- `createdAt` (DATETIME) - Creation timestamp
- `updatedAt` (DATETIME) - Last update timestamp
- `dailyTurnOn` (BOOLEAN, DEFAULT 1) - Morning schedule participation
- `dailyTurnOff` (BOOLEAN, DEFAULT 1) - "All off" command participation
- `isMatrixOutput` (BOOLEAN, DEFAULT 1) - Matrix output flag

**Unique Constraint:** (configId, channelNumber)

**Note:** The database has additional columns (`dailyTurnOn`, `dailyTurnOff`, `isMatrixOutput`) that are not in the Prisma schema.

## Database State Before Fix

**MatrixConfiguration records:** 0  
**MatrixInput records:** 0  
**MatrixOutput records:** 0  
**Active configurations:** NONE

### Critical Finding

The database was completely empty. No matrix configuration existed.

**This explained:**
1. Tests failing with "No active matrix configuration found"
2. Bartender Remote showing "Matrix: disconnected"
3. Configuration appearing lost after updates

## Schema Mismatch Issues

### Prisma Schema vs Database

**Fields in Prisma schema but NOT in database:**
- `MatrixOutput.selectedVideoInput` (INTEGER, NULLABLE)
- `MatrixOutput.videoInputLabel` (TEXT, NULLABLE)

**Fields in database but NOT in Prisma schema:**
- `MatrixOutput.dailyTurnOn` (BOOLEAN)
- `MatrixOutput.dailyTurnOff` (BOOLEAN)
- `MatrixOutput.isMatrixOutput` (BOOLEAN)

**Impact:** This mismatch caused errors when:
- Saving configurations (tried to insert non-existent fields)
- Loading configurations (tried to select non-existent fields)

## Root Cause Analysis

### Why Configuration Was Lost

**Possible causes:**
1. Database reset or migration issue
2. Manual deletion of records
3. Application error that cleared data
4. No backup system in place

**Evidence:**
- No backup directory found on server
- No file-based configuration backups
- Database tables exist but are empty
- Schema structure is intact

### Why Save Was Failing

**Issues identified in `/api/matrix/config` route:**

1. **Non-existent field references** (Lines 106-107)
   - Tried to save `selectedVideoInput` and `videoInputLabel`
   - These fields don't exist in database
   - Caused P2022 Prisma errors

2. **Improper UUID generation** (Line 42)
   - Used `config.id || ''` as fallback
   - Empty string is invalid UUID
   - Caused upsert failures

3. **Missing transaction wrapper**
   - Delete and create operations not atomic
   - Could leave database in inconsistent state
   - No rollback on errors

4. **Duplicate PrismaClient** (matrix-config route)
   - Created new PrismaClient instance
   - Should use singleton from @/lib/prisma
   - Caused connection pool issues

5. **Wrong relation names in GET**
   - Used `MatrixInput` and `MatrixOutput`
   - Should be `inputs` and `outputs`
   - Caused "Unknown field" errors

## Next Steps

Phase 2 will address all identified issues and implement:
- Proper UUID generation
- Transaction-wrapped operations
- Correct field references
- PrismaClient singleton usage
- Proper relation names
- Enhanced error handling
- Configuration backup system
