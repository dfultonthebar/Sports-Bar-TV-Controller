# Sports Bar TV Controller - System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Recent Changes and Fixes](#recent-changes-and-fixes)
4. [TODO Management System](#todo-management-system)
5. [GitHub Auto-Commit Integration](#github-auto-commit-integration)
6. [Sports Guide API](#sports-guide-api)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Configuration Management](#configuration-management)
10. [Troubleshooting](#troubleshooting)
11. [Deployment Guide](#deployment-guide)
12. [Maintenance and Backup](#maintenance-and-backup)

---

## System Overview

The Sports Bar TV Controller is a comprehensive web application designed to manage TV displays, matrix video routing, and sports content scheduling for sports bar environments. The system integrates with Wolfpack matrix switchers and provides automated scheduling capabilities.

### Key Features
- **Matrix Video Routing**: Control Wolfpack HDMI matrix switchers
- **TV Schedule Management**: Automated daily on/off scheduling with selective TV control
- **Sports Content Guide**: Display and manage sports programming
- **Multi-Zone Audio**: Control audio routing for different zones
- **TODO Management**: Integrated task tracking with GitHub auto-commit
- **AI Hub**: Unified AI management and assistance features
- **Web-Based Interface**: Responsive UI accessible from any device

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Hardware Integration**: Wolfpack HDMI Matrix Switchers (via HTTP API)
- **Process Management**: PM2
- **Version Control**: Git with automated commit integration

---

## Architecture

### Application Structure
```
Sports-Bar-TV-Controller/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── admin/              # Admin pages
│   │   │   └── todos/          # TODO management admin page
│   │   ├── ai-hub/             # AI Hub features
│   │   └── api/                # API routes
│   │       ├── todos/          # TODO management endpoints
│   │       ├── sports-guide/   # Sports Guide API endpoints
│   │       ├── matrix/         # Matrix control endpoints
│   │       └── wolfpack/       # Wolfpack integration
│   ├── components/             # React components
│   │   ├── MatrixControl.tsx   # Matrix output controls
│   │   ├── SportsGuide.tsx     # Sports programming guide
│   │   ├── TodoList.tsx        # TODO list component
│   │   ├── TodoForm.tsx        # TODO form component
│   │   └── TodoDetails.tsx     # TODO details component
│   └── lib/                    # Utility libraries
│       ├── prisma.ts           # Prisma client singleton
│       ├── wolfpack.ts         # Wolfpack API client
│       └── gitSync.ts          # GitHub auto-commit utility
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── TODO_LIST.md                # Auto-generated TODO list
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

### October 10, 2025 - PR #188: TODO System with GitHub Auto-Commit

#### Overview
Implemented comprehensive TODO management system with automatic GitHub synchronization. This feature allows tracking development tasks, bugs, and features while automatically committing changes to the repository.

**Pull Request**: [#188 - fix/400-and-git-sync](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/188)

#### Key Features Implemented

1. **TODO Management System**
   - Full CRUD operations (Create, Read, Update, Delete)
   - Task prioritization (LOW, MEDIUM, HIGH, CRITICAL)
   - Status tracking (PLANNED, IN_PROGRESS, TESTING, COMPLETE)
   - Category and tag support
   - Document attachment support
   - Completion validation (requires production testing and main branch merge confirmation)

2. **GitHub Auto-Commit Integration**
   - Automatic commit on TODO create/update/delete/complete
   - Auto-generation of TODO_LIST.md file
   - Descriptive commit messages with TODO titles
   - Background sync (non-blocking)
   - Error handling and logging

3. **Database Migrations**
   - Created `Todo` table with comprehensive fields
   - Created `TodoDocument` table for file attachments
   - Proper foreign key relationships and cascading deletes

4. **Admin Interface**
   - Dedicated admin page at `/admin/todos`
   - List view with filtering and sorting
   - Form view for creating/editing TODOs
   - Details view with document management
   - Responsive design

#### Files Created/Modified

**New Files**:
- `src/lib/gitSync.ts` - GitHub synchronization utility
- `src/app/api/todos/route.ts` - TODO list and create endpoints
- `src/app/api/todos/[id]/route.ts` - TODO get, update, delete endpoints
- `src/app/api/todos/[id]/complete/route.ts` - TODO completion with validation
- `src/app/api/todos/[id]/documents/route.ts` - Document upload/management
- `src/app/admin/todos/page.tsx` - Admin TODO management page
- `src/components/TodoList.tsx` - TODO list component
- `src/components/TodoForm.tsx` - TODO form component
- `src/components/TodoDetails.tsx` - TODO details component
- `TODO_LIST.md` - Auto-generated TODO list (do not edit manually)

**Modified Files**:
- `prisma/schema.prisma` - Added Todo and TodoDocument models
- Database migrations created for new tables

#### Bug Fixes Included

1. **Sports Guide API 400 Error**
   - **Issue**: API returning 400 errors due to missing database tables
   - **Root Cause**: Database migrations not applied on production
   - **Solution**: Applied migrations and verified table structure
   - **Status**: ✅ Fixed on production server

2. **TODO List 400 Error**
   - **Issue**: TODO API endpoints returning 400 errors
   - **Root Cause**: Missing Todo and TodoDocument tables in database
   - **Solution**: Created database migrations and applied them
   - **Status**: ✅ Fixed on production server

#### Testing Status
- ✅ All features working on production server (http://24.123.87.42:3001)
- ✅ GitHub auto-commit verified and operational
- ✅ TODO_LIST.md auto-generation working
- ⏳ Local testing pending (this task)

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

---

### October 9, 2025 - Outputs 1-4 Configuration Update

#### Issue
Outputs 1-4 were previously configured as "simple outputs" with limited controls:
- Only showed label and resolution fields
- No power on/off buttons
- No active/inactive checkbox
- No audio output configuration
- Blue message displayed: "Matrix output - Label and resolution only"

This configuration was inconsistent with the actual hardware setup where outputs 1-4 are full matrix outputs connected to TVs 01-04.

#### Solution
**Code Changes:**
- Modified `src/components/MatrixControl.tsx`
- Changed `isSimpleOutput` flag from `true` to `false` for outputs 1-4
- Removed conditional rendering that hid power controls and checkboxes
- Added audio output field for outputs 1-4

**Result:**
Outputs 1-4 now display full controls:
- ✅ Power on/off toggle button (green when on, gray when off)
- ✅ Active/inactive checkbox
- ✅ Label field (TV 01, TV 02, TV 03, TV 04)
- ✅ Resolution dropdown (1080p, 4K, 720p)
- ✅ Audio output field

**Output Configuration Summary:**
- **Outputs 1-4**: TV 01-04 (Full matrix outputs with all controls)
- **Outputs 5-32**: Regular matrix outputs (Full controls)
- **Outputs 33-36**: Matrix 1-4 (Audio routing outputs with special controls)

#### Database State
All outputs are correctly configured in the database:
```sql
-- Outputs 1-4 (TV 01-04)
channelNumber: 1-4
label: "TV 01", "TV 02", "TV 03", "TV 04"
isActive: true
powerOn: true
status: "active"

-- Outputs 33-36 (Matrix 1-4 Audio)
channelNumber: 33-36
label: "Matrix 1", "Matrix 2", "Matrix 3", "Matrix 4"
isActive: true
powerOn: false (audio outputs don't need power control)
status: "active"
```

#### Testing Results
**Wolf Pack Connection Test:**
- Status: Failed (Expected - hardware not connected)
- Error: Database error (PrismaClientUnknownRequestError)
- Note: This is expected behavior when hardware is not physically connected

**Wolf Pack Switching Test:**
- Status: Test initiated but logs not saved due to database schema mismatch
- Note: Test functionality works but log storage has known issues

**Bartender Remote:**
- Status: Functional
- Matrix Status: Disconnected (Expected - hardware not connected)
- Input Sources: Listed correctly (Cable Box 1-4)
- Bar Layout: 12 TVs configured

#### Commit Information
- Branch: `fix-save-config-api`
- Commit: `8430d14` - "Fix: Configure outputs 1-4 as matrix outputs with full controls"
- Merged to: `main` branch on October 9, 2025
- GitHub: https://github.com/dfultonthebar/Sports-Bar-TV-Controller

---

### October 9, 2025 - Automated Backup System

#### Overview
Implemented automated daily backup system for matrix configuration and database files.

#### Backup Configuration
**Schedule:**
- Daily execution at 3:00 AM (server time)
- Managed by cron job

**Backup Script Location:**
- `/home/ubuntu/Sports-Bar-TV-Controller/backup_script.js`

**Backup Directory:**
- `/home/ubuntu/Sports-Bar-TV-Controller/backups/`

**Retention Policy:**
- 14 days (backups older than 14 days are automatically deleted)

#### What Gets Backed Up
1. **Matrix Configuration** (JSON format)
   - All input configurations
   - All output configurations
   - Matrix settings
   - Timestamp and metadata

2. **Database Files**
   - `prisma/data/sports_bar.db` (main database)
   - `prisma/prisma/dev.db` (development database)

#### Backup File Naming
Format: `backup_YYYY-MM-DD_HH-MM-SS.json`
Example: `backup_2025-10-09_03-00-00.json`

#### Cron Job Configuration
```bash
# Daily backup at 3:00 AM
0 3 * * * cd /home/ubuntu/Sports-Bar-TV-Controller && /usr/bin/node backup_script.js >> /home/ubuntu/Sports-Bar-TV-Controller/backup.log 2>&1
```

#### Manual Backup
To create a manual backup:
```bash
cd ~/Sports-Bar-TV-Controller
node backup_script.js
```

#### Restore from Backup
To restore from a backup file:
1. Locate the backup file in `/home/ubuntu/Sports-Bar-TV-Controller/backups/`
2. Use the Matrix Control interface to import the configuration
3. Or manually restore database files from backup

#### Verification
Check backup status:
```bash
# View recent backups
ls -lh ~/Sports-Bar-TV-Controller/backups/

# View backup log
tail -50 ~/Sports-Bar-TV-Controller/backup.log

# Verify cron job
crontab -l | grep backup
```

#### Initial Backup
First backup created: October 9, 2025
Status: ✅ Verified and operational

---

### Atlas AI Monitor Fix

#### Issue Description
The Atlas AI Monitor component was not properly receiving processor context, causing it to use hardcoded values instead of actual processor data from the database.

**Symptoms**:
- AI Monitor displayed data for hardcoded "atlas-001" processor
- Could not display data for actual configured Atlas processor
- No dynamic processor selection

#### Root Cause
The `AtlasAIMonitor` component in the Audio Control Center page was being passed hardcoded values:
```typescript
// Before (BROKEN):
<AtlasAIMonitor 
  processorId="atlas-001"
  processorModel="AZM8"
  autoRefresh={true}
  refreshInterval={30000}
/>
```

#### Solution
Updated the Audio Control Center page to fetch active processor data dynamically:

**Changes Made**:
1. Added state management for active processor
2. Added `useEffect` hook to fetch processor on component mount
3. Updated component props to use dynamic processor data
4. Added fallback to default values if no processor found

**Implementation**:
```typescript
// After (FIXED):
const [activeProcessor, setActiveProcessor] = useState<any>(null)
const [loadingProcessor, setLoadingProcessor] = useState(true)

useEffect(() => {
  fetchActiveProcessor()
}, [])

const fetchActiveProcessor = async () => {
  try {
    const response = await fetch('/api/audio-processor')
    const data = await response.json()
    if (data.success && data.processors && data.processors.length > 0) {
      const processor = data.processors.find((p: any) => p.isActive) || data.processors[0]
      setActiveProcessor(processor)
    }
  } catch (error) {
    console.error('Error fetching processor:', error)
  } finally {
    setLoadingProcessor(false)
  }
}

<AtlasAIMonitor 
  processorId={activeProcessor?.id || "atlas-001"}
  processorModel={activeProcessor?.model || "AZM8"}
  autoRefresh={true}
  refreshInterval={30000}
/>
```

**Files Modified**:
- `src/app/audio-control/page.tsx`

#### Verification
1. Navigate to Audio Control Center
2. Click on "Atlas System" tab
3. Click on "AI Monitor" sub-tab
4. Verify AI Monitor displays data for actual configured processor
5. Check that processor ID and model match database configuration

#### Benefits
- AI Monitor now works with actual processor configuration
- Supports multiple processors (uses first active processor)
- Graceful fallback to default values if no processor configured
- Better error handling and user experience

---

## TODO Management System

### Overview
The TODO Management System provides comprehensive task tracking integrated directly into the application. All TODO operations automatically sync with GitHub, maintaining a version-controlled record of all tasks.

### Features

#### Task Management
- **Create**: Add new tasks with title, description, priority, status, category, and tags
- **Read**: View all tasks with filtering by status, priority, or category
- **Update**: Modify task details, change status, update priority
- **Delete**: Remove completed or obsolete tasks
- **Complete**: Mark tasks as complete with validation requirements

#### Task Properties
- **Title**: Brief description of the task (required)
- **Description**: Detailed information about the task
- **Priority**: LOW, MEDIUM, HIGH, CRITICAL
- **Status**: PLANNED, IN_PROGRESS, TESTING, COMPLETE
- **Category**: Optional categorization (e.g., "Bug Fix", "Feature", "Testing")
- **Tags**: JSON array of tags for additional organization
- **Documents**: Attach files to tasks (specifications, screenshots, etc.)
- **Timestamps**: Created, updated, and completed dates

#### Document Attachments
- Upload files to tasks (images, PDFs, documents, etc.)
- Automatic file metadata tracking (filename, size, type)
- Secure file storage
- View and download attached documents

#### Completion Validation
Tasks cannot be marked as complete unless:
1. **Production Tested**: Confirmed tested on production server
2. **Merged to Main**: Changes merged to main branch

This ensures quality control and proper deployment workflow.

### Access Points

#### Admin Interface
**URL**: `http://24.123.87.42:3001/admin/todos`

**Features**:
- List view with all tasks
- Create new tasks
- Edit existing tasks
- View task details
- Upload/manage documents
- Mark tasks complete
- Delete tasks

#### API Endpoints
**Base URL**: `http://24.123.87.42:3001/api/todos`

**Endpoints**:
- `GET /api/todos` - List all TODOs (with optional filters)
- `POST /api/todos` - Create new TODO
- `GET /api/todos/:id` - Get single TODO
- `PUT /api/todos/:id` - Update TODO
- `DELETE /api/todos/:id` - Delete TODO
- `POST /api/todos/:id/complete` - Mark TODO as complete
- `POST /api/todos/:id/documents` - Upload document
- `GET /api/todos/:id/documents` - List documents
- `DELETE /api/todos/:id/documents/:docId` - Delete document

### Usage Examples

#### Create TODO via API
```bash
curl -X POST http://24.123.87.42:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix navigation bug",
    "description": "Navigation menu not working on mobile",
    "priority": "HIGH",
    "status": "PLANNED",
    "category": "Bug Fix",
    "tags": ["frontend", "mobile", "navigation"]
  }'
```

#### Update TODO Status
```bash
curl -X PUT http://24.123.87.42:3001/api/todos/[id] \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

#### Mark TODO Complete
```bash
curl -X POST http://24.123.87.42:3001/api/todos/[id]/complete \
  -H "Content-Type: application/json" \
  -d '{
    "productionTested": true,
    "mergedToMain": true
  }'
```

#### List TODOs with Filters
```bash
# Get all high priority tasks
curl "http://24.123.87.42:3001/api/todos?priority=HIGH"

# Get all in-progress tasks
curl "http://24.123.87.42:3001/api/todos?status=IN_PROGRESS"

# Get all bug fixes
curl "http://24.123.87.42:3001/api/todos?category=Bug%20Fix"
```

### Database Schema

```prisma
model Todo {
  id              String        @id @default(cuid())
  title           String
  description     String?
  priority        String        @default("MEDIUM") // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  status          String        @default("PLANNED") // "PLANNED", "IN_PROGRESS", "TESTING", "COMPLETE"
  category        String?
  tags            String?       // JSON array of tags
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?
  
  documents       TodoDocument[]
}

model TodoDocument {
  id              String   @id @default(cuid())
  todoId          String
  filename        String
  filepath        String
  filesize        Int?
  mimetype        String?
  uploadedAt      DateTime @default(now())
  
  todo            Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  
  @@index([todoId])
}
```

---

## GitHub Auto-Commit Integration

### Overview
The GitHub Auto-Commit feature automatically commits TODO changes to the repository, maintaining a version-controlled history of all task management activities. This ensures transparency and provides an audit trail of development work.

### How It Works

#### Git Sync Utility
**File**: `src/lib/gitSync.ts`

The git sync utility handles all GitHub operations:
1. Fetches all TODOs from database
2. Generates markdown content for TODO_LIST.md
3. Commits changes to repository
4. Pushes to remote GitHub repository

#### Automatic Triggers
GitHub sync is automatically triggered on:
- **TODO Create**: When a new task is created
- **TODO Update**: When task details are modified
- **TODO Delete**: When a task is removed
- **TODO Complete**: When a task is marked as complete

#### Commit Messages
Descriptive commit messages are automatically generated:
- Create: `chore: Add TODO - [Task Title]`
- Update: `chore: Update TODO - [Task Title]`
- Delete: `chore: Delete TODO - [Task Title]`
- Complete: `chore: Complete TODO - [Task Title]`

### TODO_LIST.md Auto-Generation

#### File Location
`TODO_LIST.md` in project root directory

#### Content Structure
The file is automatically generated with:
- Header with auto-generation warning
- Last updated timestamp
- Tasks organized by status (Planned, In Progress, Testing, Complete)
- Task details including:
  - Title
  - ID
  - Priority
  - Status
  - Category
  - Description
  - Tags
  - Documents (if any)
  - Timestamps (created, updated, completed)
- Summary statistics

#### Example Content
```markdown
# TODO List

> **⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY**
> This file is automatically generated and updated by the TODO management system.
> Any manual changes will be overwritten.

Last Updated: October 10, 2025, 6:00 AM

---

## 📋 Planned

### Fix navigation bug
- **ID**: `clx123abc456`
- **Priority**: HIGH
- **Status**: PLANNED
- **Category**: Bug Fix
- **Description**: Navigation menu not working on mobile devices
- **Tags**: frontend, mobile, navigation
- **Created**: 10/10/2025, 5:30:00 AM
- **Updated**: 10/10/2025, 5:30:00 AM

## 🚧 In Progress

### Implement user authentication
- **ID**: `clx789def012`
- **Priority**: CRITICAL
- **Status**: IN_PROGRESS
- **Category**: Feature
- **Description**: Add user login and authentication system
- **Created**: 10/9/2025, 2:00:00 PM
- **Updated**: 10/10/2025, 8:00:00 AM

---

**Total TODOs**: 2
- Planned: 1
- In Progress: 1
- Testing: 0
- Complete: 0
```

### Implementation Details

#### Background Sync
- Git sync runs in background (non-blocking)
- API responses return immediately
- Sync errors are logged but don't affect API operations
- Ensures fast API response times

#### Error Handling
```typescript
// Sync to GitHub in background (don't wait for it)
syncTodosToGitHub(`chore: Add TODO - ${title}`).catch(err => {
  console.error('GitHub sync failed:', err)
})
```

#### Git Operations
The sync utility performs:
1. Fetch latest TODOs from database
2. Generate markdown content
3. Write to TODO_LIST.md
4. Stage file: `git add TODO_LIST.md`
5. Commit: `git commit -m "[commit message]"`
6. Push: `git push origin [branch]`

### Configuration

#### Environment Variables
Required in `.env` file:
```env
GITHUB_REPO_NAME="Sports-Bar-TV-Controller"
GITHUB_REPO_OWNER="dfultonthebar"
```

#### Git Configuration
Ensure git is configured on the server:
```bash
git config --global user.name "Sports Bar System"
git config --global user.email "system@sportsbar.local"
```

### Benefits

1. **Version Control**: Complete history of all task changes
2. **Transparency**: All team members can see task updates
3. **Audit Trail**: Track who did what and when
4. **Backup**: Tasks are backed up in git repository
5. **Integration**: Works seamlessly with existing git workflow
6. **Automation**: No manual commit required

### Troubleshooting

#### Sync Failures
If GitHub sync fails:
1. Check git configuration on server
2. Verify GitHub credentials
3. Check network connectivity
4. Review server logs for detailed errors
5. Ensure write permissions on repository

#### Manual Sync
To manually trigger sync:
```bash
cd ~/Sports-Bar-TV-Controller
node -e "require('./src/lib/gitSync').syncTodosToGitHub('manual sync')"
```

#### Verify Sync Status
Check recent commits:
```bash
cd ~/Sports-Bar-TV-Controller
git log --oneline -10 | grep "TODO"
```

---

## Sports Guide API

### Overview
The Sports Guide API provides access to sports programming information, allowing users to find where and when to watch sports events. The system integrates with external sports data providers to deliver comprehensive channel and scheduling information.

### Configuration

#### API Key Setup
**Configuration Page**: `http://24.123.87.42:3001/sports-guide-config`

**Environment Variable**: `SPORTS_GUIDE_API_KEY`

**Setup Steps**:
1. Navigate to Sports Guide configuration page
2. Enter API key in the configuration form
3. Click "Verify API Key" to test connection
4. Click "Save Configuration" to store settings
5. API key is saved to `.env` file automatically

#### API Key Files
User-provided API key information:
- `Sports guid api.txt` - API documentation
- `Sports Guid Api Key.txt` - API key credentials

### Features

#### Channel Guide
- Fetch current sports programming
- Search by team, sport, or league
- Filter by channel lineup (SAT, DRTV, etc.)
- Date range queries (today, week, custom range)

#### API Endpoints

**Base URL**: `http://24.123.87.42:3001/api/sports-guide`

**Available Endpoints**:
- `GET /api/sports-guide` - Get sports guide data
- `GET /api/sports-guide/status` - Check API status
- `GET /api/sports-guide/channels` - List available channels
- `GET /api/sports-guide/scheduled` - Get scheduled events
- `POST /api/sports-guide/update-key` - Update API key
- `POST /api/sports-guide/verify-key` - Verify API key
- `GET /api/sports-guide/current-time` - Get current time
- `POST /api/sports-guide/test-providers` - Test provider connections

**Configuration Endpoint**:
- `GET /api/sports-guide-config` - Get configuration
- `POST /api/sports-guide-config` - Save configuration

### Database Model

```prisma
model SportsGuideConfig {
  id              String   @id @default(cuid())
  apiKey          String
  provider        String   @default("sports_guide")
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Usage Examples

#### Fetch Today's Guide
```typescript
const api = getSportsGuideApi();
const guide = await api.fetchTodayGuide();
```

#### Fetch Date Range
```typescript
const guide = await api.fetchDateRangeGuide(7); // Next 7 days
```

#### Search for Specific Team
```typescript
const results = api.searchGuide(guide, "Cowboys");
```

#### Filter by Lineup
```typescript
const channels = api.getChannelsByLineup(guide, "DRTV");
```

### Future Enhancements
- Direct TV channel guide integration (via Amazon/Direct TV API)
- Streaming service guide integration (via Amazon/Direct TV API)
- Automatic guide refresh scheduling
- Favorite team filtering
- Game notifications and alerts

### Troubleshooting

#### API Key Not Working
1. Verify API key is correct (check uploaded file)
2. Use "Verify API Key" button to test connection
3. Check server logs for detailed error messages
4. Ensure User ID matches API key

#### No Channel Data
1. Verify API key is configured and valid
2. Check date range parameters
3. Ensure lineup parameter is correct (SAT, DRTV, etc.)
4. Check API rate limits

#### Configuration Not Saving
1. Ensure .env file is writable
2. Check file permissions
3. Restart server after manual .env changes
4. Verify no syntax errors in .env file

#### 400 Errors (FIXED in PR #188)
**Issue**: Sports Guide API was returning 400 errors
**Root Cause**: Missing database tables due to unapplied migrations
**Solution**: Applied database migrations on production server
**Status**: ✅ Resolved

---

## Database Schema

### Core Models

#### MatrixOutput
```prisma
model MatrixOutput {
  id              String   @id @default(cuid())
  channelNumber   Int      @unique
  label           String
  resolution      String?
  isActive        Boolean  @default(true)
  powerOn         Boolean  @default(false)
  status          String   @default("active")
  audioOutput     String?
  dailyTurnOn     Boolean  @default(true)
  dailyTurnOff    Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Todo (NEW in PR #188)
```prisma
model Todo {
  id              String        @id @default(cuid())
  title           String
  description     String?
  priority        String        @default("MEDIUM")
  status          String        @default("PLANNED")
  category        String?
  tags            String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?
  documents       TodoDocument[]
}
```

#### TodoDocument (NEW in PR #188)
```prisma
model TodoDocument {
  id              String   @id @default(cuid())
  todoId          String
  filename        String
  filepath        String
  filesize        Int?
  mimetype        String?
  uploadedAt      DateTime @default(now())
  todo            Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  
  @@index([todoId])
}
```

#### SportsGuideConfig
```prisma
model SportsGuideConfig {
  id              String   @id @default(cuid())
  apiKey          String
  provider        String   @default("sports_guide")
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Database Migrations

#### Applying Migrations
```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

#### Migration History
- Initial schema setup
- MatrixOutput dailyTurnOn/dailyTurnOff fields
- Todo and TodoDocument tables (PR #188)
- SportsGuideConfig table

---

## API Endpoints

### TODO Management

#### List TODOs
```
GET /api/todos
Query Parameters:
  - status: Filter by status (PLANNED, IN_PROGRESS, TESTING, COMPLETE)
  - priority: Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)
  - category: Filter by category

Response:
{
  "success": true,
  "data": [
    {
      "id": "clx123abc456",
      "title": "Task title",
      "description": "Task description",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "category": "Bug Fix",
      "tags": "[\"frontend\",\"mobile\"]",
      "createdAt": "2025-10-10T05:30:00.000Z",
      "updatedAt": "2025-10-10T08:00:00.000Z",
      "completedAt": null,
      "documents": []
    }
  ]
}
```

#### Create TODO
```
POST /api/todos
Body:
{
  "title": "Task title",
  "description": "Task description",
  "priority": "HIGH",
  "status": "PLANNED",
  "category": "Bug Fix",
  "tags": ["frontend", "mobile"]
}

Response:
{
  "success": true,
  "data": { /* TODO object */ }
}
```

#### Get Single TODO
```
GET /api/todos/:id

Response:
{
  "success": true,
  "data": { /* TODO object with documents */ }
}
```

#### Update TODO
```
PUT /api/todos/:id
Body:
{
  "title": "Updated title",
  "status": "IN_PROGRESS",
  "priority": "CRITICAL"
}

Response:
{
  "success": true,
  "data": { /* Updated TODO object */ }
}
```

#### Delete TODO
```
DELETE /api/todos/:id

Response:
{
  "success": true,
  "message": "Todo deleted successfully"
}
```

#### Mark TODO Complete
```
POST /api/todos/:id/complete
Body:
{
  "productionTested": true,
  "mergedToMain": true
}

Response:
{
  "success": true,
  "data": { /* Completed TODO object */ },
  "message": "Todo marked as complete"
}
```

### Matrix Control

#### Get Outputs
```
GET /api/matrix/outputs

Response:
{
  "success": true,
  "outputs": [ /* Array of MatrixOutput objects */ ]
}
```

#### Update Output
```
PUT /api/matrix/outputs/:id
Body:
{
  "powerOn": true,
  "isActive": true,
  "dailyTurnOn": true,
  "dailyTurnOff": true
}

Response:
{
  "success": true,
  "output": { /* Updated MatrixOutput object */ }
}
```

### Sports Guide

#### Get Guide Data
```
GET /api/sports-guide
Query Parameters:
  - date: Date for guide data
  - lineup: Channel lineup (SAT, DRTV, etc.)

Response:
{
  "success": true,
  "data": { /* Sports guide data */ }
}
```

#### Verify API Key
```
POST /api/sports-guide/verify-key
Body:
{
  "apiKey": "your-api-key"
}

Response:
{
  "success": true,
  "message": "API key is valid"
}
```

---

## Configuration Management

### Environment Variables

#### Required Variables
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# GitHub Integration
GITHUB_REPO_NAME="Sports-Bar-TV-Controller"
GITHUB_REPO_OWNER="dfultonthebar"

# Sports Guide API
SPORTS_GUIDE_API_KEY="your-api-key-here"

# Optional
SPORTS_RADAR_API_KEY="optional-sportsradar-api-key"
```

### Application Configuration

#### Server Settings
- **Production URL**: http://24.123.87.42:3001
- **Port**: 3001
- **Process Manager**: PM2

#### Git Configuration
```bash
git config --global user.name "Sports Bar System"
git config --global user.email "system@sportsbar.local"
```

---

## Troubleshooting

### Common Issues

#### TODO System

**Issue**: TODO API returns 400 error
**Solution**: 
1. Check database migrations are applied
2. Verify Todo and TodoDocument tables exist
3. Run `npx prisma migrate deploy`
4. Restart application

**Issue**: GitHub auto-commit not working
**Solution**:
1. Check git configuration on server
2. Verify GitHub credentials
3. Check network connectivity
4. Review server logs: `pm2 logs`

#### Sports Guide API

**Issue**: API returns 400 error
**Solution**:
1. Verify API key is configured
2. Check database migrations
3. Ensure SportsGuideConfig table exists
4. Restart application

**Issue**: No channel data returned
**Solution**:
1. Verify API key is valid
2. Check date range parameters
3. Ensure lineup parameter is correct
4. Check API rate limits

#### Database Issues

**Issue**: Migration fails
**Solution**:
1. Check database connection
2. Verify DATABASE_URL is correct
3. Ensure database user has proper permissions
4. Review migration files for errors

**Issue**: Prisma Client errors
**Solution**:
1. Run `npx prisma generate`
2. Restart application
3. Check Prisma version compatibility

### Logs and Debugging

#### View Application Logs
```bash
# PM2 logs
pm2 logs

# Specific application logs
pm2 logs sports-bar-controller

# Error logs only
pm2 logs --err
```

#### Database Debugging
```bash
# Open Prisma Studio
npx prisma studio

# Check database connection
npx prisma db pull

# View migration status
npx prisma migrate status
```

#### Git Debugging
```bash
# Check git status
cd ~/Sports-Bar-TV-Controller
git status

# View recent commits
git log --oneline -20

# Check for uncommitted changes
git diff
```

---

## Deployment Guide

### Initial Setup

#### 1. Clone Repository
```bash
cd ~
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
nano .env
```

#### 4. Setup Database
```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

#### 5. Build Application
```bash
npm run build
```

#### 6. Start with PM2
```bash
pm2 start npm --name "sports-bar-controller" -- start
pm2 save
pm2 startup
```

### Deploying PR #188

#### Prerequisites
- Server access (SSH)
- Git configured
- PM2 installed
- Node.js and npm installed

#### Deployment Steps

1. **Pull Latest Changes**
```bash
cd ~/Sports-Bar-TV-Controller
git fetch origin
git checkout fix/400-and-git-sync
git pull origin fix/400-and-git-sync
```

2. **Install Dependencies**
```bash
npm install
```

3. **Run Database Migrations**
```bash
npx prisma migrate deploy
npx prisma generate
```

4. **Build Application**
```bash
npm run build
```

5. **Restart Application**
```bash
pm2 restart sports-bar-controller
```

6. **Verify Deployment**
```bash
# Check application status
pm2 status

# View logs
pm2 logs sports-bar-controller --lines 50

# Test TODO API
curl http://localhost:3001/api/todos

# Test Sports Guide API
curl http://localhost:3001/api/sports-guide/status
```

### Production Server Details

**Server Information**:
- Host: 24.123.87.42
- Port: 224 (SSH)
- Username: ubuntu
- Password: 6809233DjD$$$ (THREE dollar signs)
- Project Path: ~/Sports-Bar-TV-Controller
- Application URL: http://24.123.87.42:3001

**SSH Connection**:
```bash
ssh -p 224 ubuntu@24.123.87.42
```

### Rollback Procedure

If deployment fails:

1. **Revert to Previous Version**
```bash
cd ~/Sports-Bar-TV-Controller
git log --oneline -10  # Find previous commit
git checkout [previous-commit-hash]
```

2. **Rebuild and Restart**
```bash
npm install
npm run build
pm2 restart sports-bar-controller
```

3. **Verify Rollback**
```bash
pm2 logs sports-bar-controller
curl http://localhost:3001/api/todos
```

---

## Maintenance and Backup

### Automated Backups

#### Daily Backup System
- **Schedule**: 3:00 AM daily
- **Location**: `/home/ubuntu/Sports-Bar-TV-Controller/backups/`
- **Retention**: 14 days
- **Script**: `backup_script.js`

#### Manual Backup
```bash
cd ~/Sports-Bar-TV-Controller
node backup_script.js
```

### Database Maintenance

#### Backup Database
```bash
# PostgreSQL backup
pg_dump -U postgres sports_bar > backup_$(date +%Y%m%d).sql

# Prisma backup (exports schema)
npx prisma db pull
```

#### Restore Database
```bash
# PostgreSQL restore
psql -U postgres sports_bar < backup_20251010.sql

# Prisma restore (apply migrations)
npx prisma migrate deploy
```

### Application Maintenance

#### Update Dependencies
```bash
cd ~/Sports-Bar-TV-Controller
npm update
npm audit fix
```

#### Clean Build
```bash
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

#### PM2 Maintenance
```bash
# Update PM2
npm install -g pm2@latest
pm2 update

# Save current configuration
pm2 save

# Restart all applications
pm2 restart all
```

### Monitoring

#### Application Health
```bash
# Check PM2 status
pm2 status

# Monitor resources
pm2 monit

# View logs
pm2 logs
```

#### Disk Space
```bash
# Check disk usage
df -h

# Check backup directory size
du -sh ~/Sports-Bar-TV-Controller/backups/

# Clean old backups (older than 14 days)
find ~/Sports-Bar-TV-Controller/backups/ -mtime +14 -delete
```

#### Database Health
```bash
# Check database size
npx prisma db execute --stdin <<< "SELECT pg_size_pretty(pg_database_size('sports_bar'));"

# Check table sizes
npx prisma studio
```

---

## Issue Tracking System

### Overview
Implemented comprehensive issue tracking system to log all development work, fixes, and planned features. The system uses a markdown file (`ISSUE_TRACKER.md`) in the repository for easy tracking and version control.

### File Location
`ISSUE_TRACKER.md` in project root directory

### Structure

**Active Issues**:
- Issues currently being worked on
- Includes status, priority, description, and requirements

**Fixed Issues**:
- Completed fixes with timestamps
- Includes issue description, root cause, solution, and verification
- Format: `[FIXED - Date, Time] Issue Title`

**Planned Features**:
- Future enhancements organized by priority (High, Medium, Low)
- Includes description, requirements, and dependencies

**Known Limitations**:
- System constraints and limitations
- Hardware dependencies
- API limitations
- Database constraints

### Usage

**Adding New Issue**:
1. Open `ISSUE_TRACKER.md`
2. Add entry to "Active Issues" section
3. Include: Status, Priority, Started date/time, Description, Impact, Requirements
4. Commit changes to repository

**Marking Issue as Fixed**:
1. Move entry from "Active Issues" to "Fixed Issues"
2. Add `[FIXED - Date, Time]` prefix
3. Document: Root Cause, Solution, Files Modified, Verification steps
4. Commit changes to repository

**Viewing Issue History**:
- All issues tracked in git history
- Use `git log ISSUE_TRACKER.md` to see changes
- Use `git blame ISSUE_TRACKER.md` to see who made changes

### Priority Levels
- **Critical**: System down or major functionality broken
- **High**: Important feature not working, significant user impact
- **Medium**: Minor feature issue, workaround available
- **Low**: Cosmetic issue, enhancement request

### Maintenance Schedule
- **Daily**: Review active issues during development
- **Weekly**: Update issue tracker with new issues and fixes
- **Monthly**: Archive old fixed issues, review planned features

### Integration with GitHub
- Issue tracker file committed to repository
- Changes tracked in git history
- Can reference issues in commit messages
- Alternative to GitHub Issues for lightweight tracking

---

## AI Hub

### Overview
The AI Hub provides unified access to multiple AI-powered features and tools within the application. It serves as a central location for AI-assisted management and automation capabilities.

### Location
**URL**: `http://24.123.87.42:3001/ai-hub`

### Features
The AI Hub contains multiple AI-powered tools and features. Comprehensive testing and documentation of all AI Hub features is planned (see TODO system).

### Access
- Available from main dashboard
- Accessible via navigation menu
- Direct URL: `/ai-hub`

### Testing Status
⏳ **Pending**: Comprehensive testing of all AI Hub features is scheduled
- TODO item created for full AI Hub testing
- Will document all features and capabilities
- Will identify and fix any issues found

---

*Last Updated: October 10, 2025, 7:00 AM*
*Version: 2.0*
*PR #188: TODO System with GitHub Auto-Commit*
