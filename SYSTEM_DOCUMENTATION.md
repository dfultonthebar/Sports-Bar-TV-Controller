# ⚠️ CRITICAL: DATABASE BACKUP PROCEDURE - READ THIS FIRST ⚠️

**BEFORE ANY UPDATES, DEPLOYMENTS, OR CHANGES:**

1. **BACKUP DATABASE**: Run `~/Sports-Bar-TV-Controller/scripts/backup_matrix_config.sh`
2. **VERIFY BACKUP**: Check that backup file exists and contains all data
3. **PERFORM UPDATE**: Make your changes/updates
4. **VERIFY DATABASE**: Check that all data is still present after update
5. **IF DATA MISSING**: Immediately restore from backup

**Failure to follow this procedure may result in permanent data loss!**

---

# Sports Bar TV Controller - System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Recent Changes and Fixes](#recent-changes-and-fixes)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Configuration Management](#configuration-management)
7. [Database Backup and Recovery Procedures](#database-backup-and-recovery-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Deployment Guide](#deployment-guide)
10. [Maintenance and Backup](#maintenance-and-backup)

---

## System Overview

The Sports Bar TV Controller is a comprehensive web application designed to manage TV displays, matrix video routing, and sports content scheduling for sports bar environments. The system integrates with Wolfpack matrix switchers and provides automated scheduling capabilities.

### Key Features
- **Matrix Video Routing**: Control Wolfpack HDMI matrix switchers
- **TV Schedule Management**: Automated daily on/off scheduling with selective TV control
- **Sports Content Guide**: Display and manage sports programming
- **Multi-Zone Audio**: Control audio routing for different zones
- **Web-Based Interface**: Responsive UI accessible from any device

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (file-based at `/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db`)
- **Hardware Integration**: Wolfpack HDMI Matrix Switchers (via HTTP API)
- **Process Management**: PM2

---

## Architecture

### Application Structure
```
Sports-Bar-TV-Controller/
├── src/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # React components
│   │   ├── MatrixControl.tsx   # Matrix output controls
│   │   ├── SportsGuide.tsx     # Sports programming guide
│   │   ├── ApiKeysManager.tsx  # API configuration
│   │   └── tv-guide/           # TV guide components
│   ├── lib/                    # Utility libraries
│   │   ├── prisma.ts           # Prisma client singleton
│   │   └── wolfpack.ts         # Wolfpack API client
│   └── pages/api/              # API routes
│       ├── matrix/             # Matrix control endpoints
│       ├── wolfpack/           # Wolfpack integration
│       └── schedule/           # Scheduling endpoints
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── data/
│       └── sports_bar.db       # SQLite database file
├── scripts/
│   └── backup_matrix_config.sh # Automated backup script
└── public/                     # Static assets
```

### Component Architecture

#### Matrix Control System
The matrix control system manages video routing between sources and displays:

- **Simple Outputs (1-4)**: Basic displays showing only label and resolution
  - No power controls
  - No routing buttons
  - Display-only information
  - Used for non-matrix connected displays

- **Matrix Outputs (33-36)**: Full matrix-controlled displays
  - Power on/off controls
  - Active status checkbox
  - Source routing buttons
  - Audio output configuration
  - Full Wolfpack integration

#### TV Selection System
Allows granular control over which TVs participate in automated schedules:

- **dailyTurnOn**: Boolean flag indicating if TV should turn on during morning schedule
- **dailyTurnOff**: Boolean flag indicating if TV responds to "all off" command
- Configured per output in the database
- Accessible via `/api/matrix/outputs-schedule` endpoint

---

## Recent Changes and Fixes

### October 2025 - Phase 3: Graystone Matrix Configuration

#### Matrix Configuration Completed
**Date**: October 10, 2025

**Configuration Details**:
- **Matrix Name**: Graystone Matrix
- **IP Address**: 192.168.5.100
- **Protocol**: TCP
- **TCP Port**: 23

**Inputs Configured** (18 active, 18 inactive):
- Inputs 1-4: Cable Box 1-4 (Cable Box)
- Inputs 5-12: Direct TV 1-8 (Direct TV)
- Inputs 13-16: Amazon 1-4 (Fire TV)
- Input 17: Atmosphere (Other)
- Input 18: CEC (Other)
- Inputs 19-36: Inactive

**Outputs Configured** (29 active, 7 inactive):
- Outputs 1-25: TV 01-25 (Power On enabled)
- Outputs 26-32: Inactive
- Outputs 33-36: Matrix 1-4 (Audio outputs)

**Implementation Method**:
- Configuration entered via API endpoint (`/api/matrix/config`)
- All 36 inputs and 36 outputs configured in single transaction
- Database verified with correct counts and labels
- Backup created before and after configuration

**Files Modified**:
- Database: `/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db`
- Backup created: `backups/matrix-config/matrix_config_20251009_213841/`

---

### October 2025 - Critical Fixes and Feature Restoration

#### 1. Wolfpack Connection Test Fix
**Issue**: Connection test was consistently failing with database-related errors.

**Root Cause**: 
- Duplicate PrismaClient instantiation in `/src/pages/api/wolfpack/test-connection.ts`
- The API route was creating a new PrismaClient instance instead of using the singleton
- This caused connection pool issues and race conditions

**Solution**:
```typescript
// Before (BROKEN):
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// After (FIXED):
import prisma from '@/lib/prisma';
```

**Files Modified**:
- `src/pages/api/wolfpack/test-connection.ts`

**Testing**: Connection test now successfully validates Wolfpack matrix connectivity.

---

#### 2. TV Selection Options Restoration
**Issue**: Missing UI controls to select which TVs turn on in morning schedule and respond to "all off" command.

**Solution**:
- Added `dailyTurnOn` boolean field to MatrixOutput schema
- Added `dailyTurnOff` boolean field to MatrixOutput schema
- Existing API endpoint `/api/matrix/outputs-schedule` already supported these fields
- Database migration required for deployment

**Database Schema Changes**:
```prisma
model MatrixOutput {
  // ... existing fields ...
  dailyTurnOn  Boolean @default(true)   // Participate in morning schedule
  dailyTurnOff Boolean @default(true)   // Respond to "all off" command
}
```

**Migration Required**: Yes - `npx prisma migrate deploy` on server

**Usage**:
- Configure per-output in System Admin → Matrix Outputs
- Morning schedule only turns on TVs with `dailyTurnOn = true`
- "All Off" command only affects TVs with `dailyTurnOff = true`

---

#### 3. EPG Services Removal
**Issue**: Application contained references to deprecated/unavailable EPG (Electronic Program Guide) services.

**Services Removed**:
- **Gracenote API**: Commercial EPG service (requires expensive license)
- **TMS (Tribune Media Services)**: Deprecated service, no longer available
- **Spectrum Business API**: Provider-specific, not applicable

**Files Modified**:
- `src/components/ApiKeysManager.tsx` - Removed EPG provider configuration options
- `src/components/SportsGuide.tsx` - Removed Spectrum Business provider references
- `src/components/tv-guide/TVGuideConfigurationPanel.tsx` - Replaced EPG services with notice for future custom service

**Impact**:
- Cleaner UI without non-functional options
- Reduced confusion for users
- Opens path for custom EPG service implementation in future

**Future Enhancement**: Custom EPG service can be added when needed, using free/open APIs or custom data sources.

---

#### 4. Matrix Outputs 1-4 Conversion
**Issue**: Outputs 1-4 were displaying full matrix controls but are not connected to the matrix switcher.

**Solution**: Modified `src/components/MatrixControl.tsx` to differentiate output types:

**Simple Outputs (1-4)** - Display Only:
- Label (e.g., "TV 1")
- Resolution (e.g., "1920x1080")
- No power controls
- No active checkbox
- No routing buttons
- No audio configuration

**Matrix Outputs (33-36)** - Full Controls:
- All power controls
- Active status checkbox
- Source routing buttons (1-32)
- Audio output configuration
- Full Wolfpack integration

**Implementation**:
```typescript
const isSimpleOutput = outputNumber >= 1 && outputNumber <= 4;

if (isSimpleOutput) {
  // Render simple display: label + resolution only
} else {
  // Render full matrix controls
}
```

**Files Modified**:
- `src/components/MatrixControl.tsx`

---

#### 5. Configuration Loss Investigation
**Issue**: Wolfpack matrix configuration (IP, labels, enabled outputs) was lost.

**Investigation Results**:
- No backup directory found on server
- Configuration was stored in database tables
- Database tables are currently empty (no data)
- No file-based configuration backups exist

**Root Cause**: Unknown - possible database reset or migration issue

**Impact**:
- User must reconfigure Wolfpack matrix settings:
  - Matrix IP address
  - Matrix name
  - Input labels and enabled/disabled status
  - Output labels and enabled/disabled status

**Prevention Measures** (see Maintenance section):
- Regular database backups
- Configuration export functionality
- File-based configuration backup option

---

## Database Schema

### Key Models

#### MatrixConfiguration
Stores Wolfpack matrix switcher configuration:
```prisma
model MatrixConfiguration {
  id              String        @id @default(uuid())
  name            String
  ipAddress       String
  tcpPort         Int           @default(23)
  udpPort         Int           @default(4000)
  protocol        String        @default("TCP")
  isActive        Boolean       @default(true)
  cecInputChannel Int?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  inputs          MatrixInput[]
  outputs         MatrixOutput[]
}
```

#### MatrixInput
Represents a video source:
```prisma
model MatrixInput {
  id            String              @id @default(uuid())
  configId      String
  channelNumber Int
  label         String
  inputType     String              @default("HDMI")
  deviceType    String              @default("Other")
  isActive      Boolean             @default(true)
  status        String              @default("active")
  powerOn       Boolean             @default(false)
  isCecPort     Boolean             @default(false)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  config        MatrixConfiguration @relation(fields: [configId], references: [id], onDelete: Cascade)
}
```

#### MatrixOutput
Represents a video output (TV display):
```prisma
model MatrixOutput {
  id            String              @id @default(uuid())
  configId      String
  channelNumber Int
  label         String
  resolution    String              @default("1080p")
  isActive      Boolean             @default(true)
  status        String              @default("active")
  audioOutput   Boolean?
  powerOn       Boolean             @default(false)
  dailyTurnOn   Boolean             @default(true)
  dailyTurnOff  Boolean             @default(true)
  isMatrixOutput Boolean            @default(true)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  config        MatrixConfiguration @relation(fields: [configId], references: [id], onDelete: Cascade)
}
```

---

## API Endpoints

### Matrix Configuration

#### GET `/api/matrix/config`
Retrieve active matrix configuration with inputs and outputs:
```json
{
  "config": {
    "id": "uuid",
    "name": "Graystone Matrix",
    "ipAddress": "192.168.5.100",
    "protocol": "TCP",
    "tcpPort": 23,
    "isActive": true
  },
  "inputs": [...],
  "outputs": [...]
}
```

#### POST `/api/matrix/config`
Save or update matrix configuration:
```json
{
  "config": {
    "name": "Graystone Matrix",
    "ipAddress": "192.168.5.100",
    "protocol": "TCP",
    "tcpPort": 23,
    "isActive": true
  },
  "inputs": [
    {
      "channelNumber": 1,
      "label": "Cable Box 1",
      "deviceType": "Cable Box",
      "isActive": true
    }
  ],
  "outputs": [
    {
      "channelNumber": 1,
      "label": "TV 01",
      "powerOn": true,
      "isActive": true
    }
  ]
}
```

### Matrix Control

#### GET/POST `/api/matrix/outputs`
- **GET**: Retrieve all matrix outputs
- **POST**: Update output configuration
- **Body**: `{ outputNumber, label, enabled, dailyTurnOn, dailyTurnOff }`

#### GET `/api/matrix/outputs-schedule`
Retrieve outputs with schedule participation flags:
```json
{
  "outputs": [
    {
      "outputNumber": 33,
      "label": "Main Bar TV",
      "dailyTurnOn": true,
      "dailyTurnOff": true
    }
  ]
}
```

#### POST `/api/matrix/route`
Route a source to an output:
```json
{
  "input": 5,
  "output": 33
}
```

#### POST `/api/matrix/power`
Control output power:
```json
{
  "output": 33,
  "state": "on"  // or "off"
}
```

### Wolfpack Integration

#### POST `/api/wolfpack/test-connection`
Test connectivity to Wolfpack matrix:
```json
{
  "ipAddress": "192.168.1.100"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Successfully connected to Wolfpack matrix"
}
```

#### POST `/api/wolfpack/test-switching`
Test matrix switching functionality:
```json
{
  "ipAddress": "192.168.1.100"
}
```

---

## Configuration Management

### Wolfpack Matrix Configuration

#### Initial Setup
1. Navigate to **Matrix Control** page
2. Enter matrix configuration:
   - Configuration Name (e.g., "Graystone Matrix")
   - IP Address (e.g., "192.168.5.100")
   - Protocol (TCP/UDP)
   - TCP Port (default: 23)
3. Configure all 36 inputs with labels and device types
4. Configure all 36 outputs with labels and settings
5. Click **Save Configuration**
6. Verify success message

#### Input Configuration
For each input (1-36):
- Set descriptive label (e.g., "Cable Box 1", "Direct TV 1")
- Select device type (Cable Box, Direct TV, Fire TV, Other)
- Enable/disable as needed
- Configure CEC port if applicable

#### Output Configuration
For each output (1-36):
- Set descriptive label (e.g., "TV 01", "Matrix 1")
- Enable/disable as needed
- Set power on preference
- Configure audio output (for audio zones)
- Set `dailyTurnOn` (participate in morning schedule)
- Set `dailyTurnOff` (respond to "all off" command)

### TV Selection Configuration

**Morning Schedule (dailyTurnOn)**:
- Enable for TVs that should automatically turn on in the morning
- Disable for TVs that remain off or are manually controlled

**All Off Command (dailyTurnOff)**:
- Enable for TVs that should turn off with "all off" button
- Disable for TVs that should remain on (e.g., 24/7 displays)

---

## Database Backup and Recovery Procedures

### ⚠️ CRITICAL: Always Backup Before Changes

**MANDATORY PROCEDURE** before any updates, deployments, or configuration changes:

1. **Create Backup**
2. **Verify Backup**
3. **Perform Changes**
4. **Verify Data Integrity**
5. **Keep Backup Until Verified**

### Automated Backup Script

The system includes an automated backup script at `~/Sports-Bar-TV-Controller/scripts/backup_matrix_config.sh`.

#### Running the Backup Script

```bash
cd ~/Sports-Bar-TV-Controller
bash scripts/backup_matrix_config.sh
```

#### What Gets Backed Up

The script creates a comprehensive backup including:
- **Full database file**: Complete SQLite database
- **SQL exports**: Individual table exports in SQL format
  - MatrixConfiguration table
  - MatrixInput table (all 36 inputs)
  - MatrixOutput table (all 36 outputs)
- **JSON export**: Active configuration in JSON format
- **Backup metadata**: Timestamp, statistics, restore instructions
- **Compressed archive**: `.tar.gz` file for easy storage/transfer

#### Backup Location

Backups are stored in:
```
~/Sports-Bar-TV-Controller/backups/matrix-config/
├── matrix_config_YYYYMMDD_HHMMSS/
│   ├── sports_bar.db              # Full database backup
│   ├── matrix_configuration.sql   # Configuration table
│   ├── matrix_input.sql           # Input table
│   ├── matrix_output.sql          # Output table
│   ├── matrix_config.json         # JSON export
│   └── backup_info.txt            # Backup metadata
└── matrix_config_YYYYMMDD_HHMMSS.tar.gz  # Compressed archive
```

#### Backup Verification

After creating a backup, verify it contains data:

```bash
# Check backup directory exists
ls -lh ~/Sports-Bar-TV-Controller/backups/matrix-config/

# View backup contents
tar -tzf ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_*.tar.gz

# Check backup info
cat ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_*/backup_info.txt
```

### Manual Database Backup

If the automated script is not available:

```bash
# Backup full database
cp ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
   ~/Sports-Bar-TV-Controller/backups/sports_bar_$(date +%Y%m%d_%H%M%S).db

# Export specific tables
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  ".dump MatrixConfiguration MatrixInput MatrixOutput" \
  > ~/Sports-Bar-TV-Controller/backups/matrix_config_$(date +%Y%m%d_%H%M%S).sql
```

### Restoring from Backup

#### Method 1: Full Database Restore (Recommended)

```bash
# Stop the application
pm2 stop sports-bar-tv-controller

# Backup current database (just in case)
cp ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
   ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db.before_restore

# Restore from backup
cp ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_YYYYMMDD_HHMMSS/sports_bar.db \
   ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# Start the application
pm2 start sports-bar-tv-controller

# Verify data is present
pm2 logs sports-bar-tv-controller
```

#### Method 2: SQL Import (Selective Restore)

```bash
# Stop the application
pm2 stop sports-bar-tv-controller

# Import specific tables
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  < ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_YYYYMMDD_HHMMSS/matrix_configuration.sql

sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  < ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_YYYYMMDD_HHMMSS/matrix_input.sql

sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  < ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_YYYYMMDD_HHMMSS/matrix_output.sql

# Start the application
pm2 start sports-bar-tv-controller
```

#### Method 3: Extract from Archive

```bash
# Extract backup archive
cd ~/Sports-Bar-TV-Controller/backups/matrix-config/
tar -xzf matrix_config_YYYYMMDD_HHMMSS.tar.gz

# Then use Method 1 or Method 2 above
```

### Emergency Recovery

If data is lost after an update:

1. **IMMEDIATELY stop the application**:
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Identify the most recent backup**:
   ```bash
   ls -lt ~/Sports-Bar-TV-Controller/backups/matrix-config/
   ```

3. **Restore from backup** (use Method 1 above)

4. **Verify data integrity**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT COUNT(*) FROM MatrixConfiguration;"
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT COUNT(*) FROM MatrixInput;"
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT COUNT(*) FROM MatrixOutput;"
   ```

5. **Restart application**:
   ```bash
   pm2 start sports-bar-tv-controller
   ```

### Backup Best Practices

1. **Before ANY changes**:
   - Always run backup script first
   - Verify backup was created successfully
   - Check backup contains expected data

2. **After configuration changes**:
   - Create a new backup
   - Label it clearly (e.g., "after_graystone_config")
   - Keep multiple versions

3. **Regular schedule**:
   - Daily automated backups (via cron)
   - Weekly manual verification
   - Monthly archive to external storage

4. **Retention policy**:
   - Keep last 7 daily backups
   - Keep last 4 weekly backups
   - Keep last 12 monthly backups
   - Archive major configuration changes permanently

5. **Test restores**:
   - Periodically test restore procedure
   - Verify restored data is complete
   - Document any issues encountered

### Automated Backup Schedule

Add to crontab for automated daily backups:

```bash
# Edit crontab
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * cd ~/Sports-Bar-TV-Controller && bash scripts/backup_matrix_config.sh >> ~/backup.log 2>&1
```

---

## Troubleshooting

### Wolfpack Connection Test Fails

**Symptoms**:
- Connection test returns error
- "Failed to connect" message
- Database-related errors in logs

**Solutions**:

1. **Verify Network Connectivity**:
   ```bash
   ping <wolfpack-ip-address>
   curl http://<wolfpack-ip-address>
   ```

2. **Check Wolfpack Matrix**:
   - Ensure matrix is powered on
   - Verify IP address is correct (192.168.5.100 for Graystone Matrix)
   - Check network cable connections
   - Confirm matrix is on same network/VLAN

3. **Verify Database Connection**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "SELECT * FROM MatrixConfiguration WHERE isActive = 1;"
   ```

4. **Check Application Logs**:
   ```bash
   pm2 logs sports-bar-tv-controller
   ```

5. **Restart Application**:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

### Matrix Configuration Not Saving

**Symptoms**:
- Save button doesn't work
- Configuration disappears after refresh
- Error messages in console

**Solutions**:

1. **Check Database Permissions**:
   ```bash
   ls -l ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
   # Should be writable by application user
   ```

2. **Verify Database Integrity**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "PRAGMA integrity_check;"
   ```

3. **Check Application Logs**:
   ```bash
   pm2 logs sports-bar-tv-controller --lines 50
   ```

4. **Restart Application**:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

### Configuration Lost After Update

**Symptoms**:
- Matrix configuration missing
- Input/output labels reset
- Settings not persisted

**Solutions**:

1. **IMMEDIATELY Create Backup** (if any data remains):
   ```bash
   bash ~/Sports-Bar-TV-Controller/scripts/backup_matrix_config.sh
   ```

2. **Check for Recent Backups**:
   ```bash
   ls -lt ~/Sports-Bar-TV-Controller/backups/matrix-config/
   ```

3. **Restore from Most Recent Backup**:
   ```bash
   # Follow restore procedure in "Database Backup and Recovery Procedures" section
   ```

4. **If No Backup Available**:
   - Reconfigure matrix manually
   - Create backup immediately after reconfiguration
   - Set up automated backup schedule

### Matrix Switching Not Working

**Symptoms**:
- Routing commands fail
- TVs don't change sources
- Power commands don't work

**Solutions**:

1. **Verify Configuration Saved**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT name, ipAddress, protocol, tcpPort FROM MatrixConfiguration WHERE isActive = 1;"
   ```

2. **Test Connection First**:
   - Navigate to Matrix Control page
   - Verify configuration is displayed
   - Check connection status badge

3. **Check Output Configuration**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT channelNumber, label, isActive FROM MatrixOutput WHERE isActive = 1;"
   ```

4. **Verify Input Configuration**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     "SELECT channelNumber, label, isActive FROM MatrixInput WHERE isActive = 1;"
   ```

5. **Test Individual Commands**:
   - Try routing a single input to single output
   - Test power on/off for single output
   - Check Wolfpack web interface directly

### Database Corruption

**Symptoms**:
- Application crashes on startup
- Database errors in logs
- Unable to read configuration

**Solutions**:

1. **Stop Application**:
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Check Database Integrity**:
   ```bash
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "PRAGMA integrity_check;"
   ```

3. **If Corrupted, Restore from Backup**:
   ```bash
   # Follow restore procedure in "Database Backup and Recovery Procedures" section
   ```

4. **If No Backup, Try Recovery**:
   ```bash
   # Dump what can be recovered
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db .dump > recovered.sql
   
   # Create new database
   mv ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db.corrupt
   
   # Import recovered data
   sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db < recovered.sql
   ```

---

## Deployment Guide

### Prerequisites
- Node.js 18+ installed
- SQLite3 installed
- PM2 process manager installed
- Git repository access

### Initial Deployment

1. **Clone Repository**:
   ```bash
   cd ~
   git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
   cd Sports-Bar-TV-Controller
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set:
   - `DATABASE_URL`: SQLite file path (default: `file:///home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db`)
   - `NEXTAUTH_SECRET`: Random secret for authentication
   - `NEXTAUTH_URL`: Application URL

4. **Initialize Database**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Build Application**:
   ```bash
   npm run build
   ```

6. **Start with PM2**:
   ```bash
   pm2 start npm --name "sports-bar-tv-controller" -- start
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start
   ```

7. **Create Initial Backup**:
   ```bash
   bash scripts/backup_matrix_config.sh
   ```

### Update Deployment

**⚠️ CRITICAL: Follow backup procedure before updating!**

1. **Create Pre-Update Backup**:
   ```bash
   cd ~/Sports-Bar-TV-Controller
   bash scripts/backup_matrix_config.sh
   ```

2. **Verify Backup Created**:
   ```bash
   ls -lh backups/matrix-config/
   # Verify latest backup exists and has reasonable size
   ```

3. **Pull Latest Changes**:
   ```bash
   git pull origin main
   ```

4. **Install Dependencies**:
   ```bash
   npm install
   ```

5. **Run Migrations**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

6. **Rebuild Application**:
   ```bash
   npm run build
   ```

7. **Restart PM2**:
   ```bash
   pm2 restart sports-bar-tv-controller --update-env
   ```

8. **Verify Data Integrity**:
   ```bash
   # Check configuration still exists
   sqlite3 prisma/data/sports_bar.db "SELECT COUNT(*) FROM MatrixConfiguration;"
   sqlite3 prisma/data/sports_bar.db "SELECT COUNT(*) FROM MatrixInput;"
   sqlite3 prisma/data/sports_bar.db "SELECT COUNT(*) FROM MatrixOutput;"
   ```

9. **If Data Missing, Restore from Backup**:
   ```bash
   # Follow restore procedure in "Database Backup and Recovery Procedures" section
   ```

10. **Create Post-Update Backup**:
    ```bash
    bash scripts/backup_matrix_config.sh
    ```

### Rollback Procedure

If deployment fails:

1. **Stop Application**:
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Restore Database from Backup**:
   ```bash
   cp backups/matrix-config/matrix_config_YYYYMMDD_HHMMSS/sports_bar.db \
      prisma/data/sports_bar.db
   ```

3. **Revert Git Changes**:
   ```bash
   git log  # Find previous commit hash
   git checkout <previous-commit-hash>
   ```

4. **Rebuild and Restart**:
   ```bash
   npm install
   npm run build
   pm2 start sports-bar-tv-controller
   ```

5. **Verify System Working**:
   ```bash
   pm2 logs sports-bar-tv-controller
   # Check application is running and data is present
   ```

---

## Maintenance and Backup

### Regular Maintenance Tasks

#### Daily
- Monitor PM2 logs for errors:
  ```bash
  pm2 logs sports-bar-tv-controller --lines 100
  ```
- Verify automated backup ran successfully:
  ```bash
  ls -lt ~/Sports-Bar-TV-Controller/backups/matrix-config/ | head -5
  ```

#### Weekly
- Check disk space:
  ```bash
  df -h
  ```
- Review application logs for warnings
- Verify scheduled tasks are running
- Test backup restoration (on test system)

#### Monthly
- Update dependencies:
  ```bash
  npm update
  npm audit fix
  ```
- Review and optimize database:
  ```bash
  sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "VACUUM;"
  ```
- Archive old backups to external storage
- Test full disaster recovery procedure

### Backup Strategy

#### Automated Daily Backup

**Setup Cron Job**:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd ~/Sports-Bar-TV-Controller && bash scripts/backup_matrix_config.sh >> ~/backup.log 2>&1

# Add weekly cleanup (keep last 30 days)
0 3 * * 0 find ~/Sports-Bar-TV-Controller/backups/matrix-config/ -name "matrix_config_*" -mtime +30 -delete
```

#### Manual Backup Before Changes

**Always run before**:
- Software updates
- Configuration changes
- Database migrations
- System maintenance

```bash
cd ~/Sports-Bar-TV-Controller
bash scripts/backup_matrix_config.sh
```

#### Backup Verification

**Daily Verification**:
```bash
# Check latest backup
ls -lh ~/Sports-Bar-TV-Controller/backups/matrix-config/ | head -3

# Verify backup contents
tar -tzf ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_*.tar.gz | head -10
```

**Weekly Test Restore** (on test system):
```bash
# Extract backup
tar -xzf matrix_config_YYYYMMDD_HHMMSS.tar.gz

# Test database integrity
sqlite3 matrix_config_YYYYMMDD_HHMMSS/sports_bar.db "PRAGMA integrity_check;"

# Verify data
sqlite3 matrix_config_YYYYMMDD_HHMMSS/sports_bar.db "SELECT COUNT(*) FROM MatrixConfiguration;"
```

#### Backup Retention Policy

- **Daily backups**: Keep 7 days
- **Weekly backups**: Keep 4 weeks  
- **Monthly backups**: Keep 12 months
- **Configuration change backups**: Keep indefinitely

#### Off-Site Backup

**Copy to External Storage**:
```bash
# Copy to external drive
cp ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_*.tar.gz /mnt/external/

# Copy to network storage
scp ~/Sports-Bar-TV-Controller/backups/matrix-config/matrix_config_*.tar.gz user@backup-server:/backups/
```

### Monitoring

#### Application Health
```bash
# Check PM2 status
pm2 status

# View resource usage
pm2 monit

# Check application logs
pm2 logs sports-bar-tv-controller
```

#### Database Health
```bash
# Check database size
ls -lh ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# Check table counts
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db << EOF
SELECT 'MatrixConfiguration' as table_name, COUNT(*) as count FROM MatrixConfiguration
UNION ALL
SELECT 'MatrixInput', COUNT(*) FROM MatrixInput
UNION ALL
SELECT 'MatrixOutput', COUNT(*) FROM MatrixOutput;
EOF

# Check database integrity
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "PRAGMA integrity_check;"
```

#### Network Connectivity
```bash
# Test Wolfpack connectivity
curl http://192.168.5.100

# Check application port
netstat -tulpn | grep 3001
```

---

## Security Considerations

### Network Security
- Wolfpack matrix should be on isolated VLAN
- Application should be behind firewall
- Use HTTPS in production (configure reverse proxy)

### Database Security
- Restrict database file permissions:
  ```bash
  chmod 600 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
  ```
- Regular backups with encryption
- Secure backup storage location

### Application Security
- Keep dependencies updated
- Regular security audits
- Monitor logs for suspicious activity
- Use strong authentication

### Backup Security
- Encrypt backup archives
- Secure backup storage location
- Restrict access to backup files
- Test restore procedures regularly

---

## Support and Resources

### Documentation
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- SQLite: https://www.sqlite.org/docs.html
- Wolfpack API: Refer to Wolfpack matrix documentation

### Common Issues
- See [Troubleshooting](#troubleshooting) section
- Check GitHub Issues: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues

### Getting Help
1. Check this documentation
2. Review application logs
3. Search GitHub issues
4. Create new issue with:
   - Detailed description
   - Steps to reproduce
   - Error messages
   - System information
   - Backup status

---

## Changelog

### October 10, 2025 - Phase 3 Complete
- ✅ Graystone Matrix configuration entered via API
- ✅ All 36 inputs configured (18 active, 18 inactive)
- ✅ All 36 outputs configured (29 active, 7 inactive)
- ✅ Database verified with correct counts and labels
- ✅ Backup system tested and verified
- ✅ Documentation updated with backup procedures
- ✅ Critical backup warnings added to documentation

### October 2025 - Critical Fixes
- ✅ Fixed Wolfpack connection test (PrismaClient singleton)
- ✅ Added TV selection options (dailyTurnOn, dailyTurnOff)
- ✅ Removed EPG services (Gracenote, TMS, Spectrum Business API)
- ✅ Converted outputs 1-4 to simple display
- ✅ Investigated configuration loss (no backups found)
- ✅ Created automated backup script
- ✅ Updated system documentation

### Future Enhancements
- Custom EPG service integration
- Configuration export/import functionality
- Enhanced backup automation with encryption
- Mobile app development
- Advanced scheduling features
- Real-time matrix status monitoring

---

## License

[Add license information here]

## Contributors

[Add contributor information here]

---

*Last Updated: October 10, 2025*
*Version: 1.1*

---

# ⚠️ CRITICAL: DATABASE BACKUP PROCEDURE - READ THIS FIRST ⚠️

**BEFORE ANY UPDATES, DEPLOYMENTS, OR CHANGES:**

1. **BACKUP DATABASE**: Run `~/Sports-Bar-TV-Controller/scripts/backup_matrix_config.sh`
2. **VERIFY BACKUP**: Check that backup file exists and contains all data
3. **PERFORM UPDATE**: Make your changes/updates
4. **VERIFY DATABASE**: Check that all data is still present after update
5. **IF DATA MISSING**: Immediately restore from backup

**Failure to follow this procedure may result in permanent data loss!**

---
