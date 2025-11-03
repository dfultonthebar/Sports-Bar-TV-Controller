# AI Hub Improvements - November 2025

This document describes the new features and improvements added to the Sports Bar TV Controller AI Hub.

## Table of Contents

1. [Enhanced Security Validator](#enhanced-security-validator)
2. [Auto TV Brand Detection](#auto-tv-brand-detection)
3. [Scheduled Command Sequences](#scheduled-command-sequences)
4. [Document Management UI](#document-management-ui)

---

## Enhanced Security Validator

### Overview
The security validator has been significantly improved to allow more legitimate use cases while maintaining strong security controls.

### Location
`/src/lib/ai-tools/security/enhanced-validator.ts`

### Key Improvements

#### 1. Expanded Command Whitelist
- **Before**: Only 12 basic commands allowed
- **After**: 25+ commands including CEC tools, system monitoring, and file operations

New allowed commands:
- CEC commands: `cec-client`, `echo-cec`, `cec-ctl`
- JSON/YAML processors: `jq`, `yq`
- Database: `sqlite3`
- System monitoring: `ps`, `top`, `htop`, `df`, `du`, `free`
- File operations: `mkdir`, `touch`, `cp`, `mv` (with path validation)
- Text processing: `awk`, `sed`, `tr`, `cut`

#### 2. Safe Command Patterns
Predefined safe patterns that override basic restrictions:

```typescript
// Git read operations
/^git\s+(status|log|diff|branch|show|remote)\b/

// Package manager read operations
/^(npm|yarn|pnpm)\s+(list|ls|info|view|outdated)\b/

// SQLite SELECT queries
/^sqlite3\s+.+\s+"SELECT\s+/i

// CEC read commands
/^(cec-client|echo-cec)\s+-s\s+-d\s+\d+\s+tx\s+[0-9a-f]+:[0-9a-f]+$/i

// Safe file operations with output redirection
/^(grep|find|ls|cat)\s+.+\s*>\s*\/tmp\/.+\.txt$/i

// Piping between safe commands
/^(grep|cat|ls|find|head|tail|sort|uniq|wc|tr|cut)\s+.+\s*\|\s*(grep|head|tail|sort|uniq|wc|tr|cut|jq)\b/
```

#### 3. Context-Aware Validation

**Command Chaining**:
- Now allowed when `allowChaining: true` is set in context
- Each command in chain is validated individually
- Example: `git status && git diff`

**I/O Redirection**:
- Allowed to `/tmp` directory for temporary files
- Allowed to `/var/log` and `/home/ubuntu/logs` for logging
- File extensions validated (`.txt`, `.log`, `.json`, `.csv`)

**Command Substitution**:
- Allowed for safe read-only commands: `$(date)`, `$(pwd)`, `$(whoami)`, `$(hostname)`
- Example: `echo "Current time: $(date)"`

#### 4. Enhanced Dangerous Pattern Detection

Patterns now include severity levels:
- **Critical**: `rm -rf /`, disk writes, fork bombs, piped remote execution
- **High**: Dynamic code evaluation, dangerous permissions, shell subprocess

Example usage:
```typescript
import { enhancedSecurityValidator } from '@/lib/ai-tools/security/enhanced-validator'

// Basic validation
const result = enhancedSecurityValidator.validateBashCommand('ls -la /home')

// With context for command chaining
const chainResult = enhancedSecurityValidator.validateBashCommand(
  'git status && git diff',
  { allowChaining: true }
)
```

---

## Auto TV Brand Detection

### Overview
Automatically detect TV brand using CEC OSD name query (opcode 0x46) to apply brand-specific configurations.

### Location
- Configuration: `/src/lib/tv-brands-config.ts`
- API: `/src/app/api/tv-brands/detect/route.ts`

### Features

#### 1. CEC-Based Brand Detection
Uses CEC opcode 0x46 to query the OSD (On-Screen Display) name from connected TVs.

Supported brands with pattern matching:
- **Sony**: BRAVIA, KD-\*, XBR-\*
- **Samsung**: SAMSUNG, UN\*, QN\*, The Frame, The Serif
- **LG**: LG, OLED\*, webOS TV
- **TCL**: TCL, TCL Roku, \*S\*
- **Vizio**: VIZIO, SmartCast, [DEPV]\*-\*
- **Sharp**: Sharp, AQUOS, LC-\*
- **Panasonic**: Panasonic, VIERA, TX-\*, TH-\*
- **Philips**: Philips, PHL, \*PFL
- **Toshiba**: Toshiba, REGZA, \*LF\*
- **Hisense**, **Insignia**, **Element**, **Westinghouse**

#### 2. Brand Detection Cache
- Cached for 24 hours per CEC address
- Reduces redundant CEC queries
- Improves performance

#### 3. Confidence Levels
Each detection returns a confidence level:
- **High**: Exact brand pattern match
- **Medium**: Partial match
- **Low**: Generic/unknown brand

### API Usage

**Detect Brand**:
```bash
POST /api/tv-brands/detect
Content-Type: application/json

{
  "cecAddress": "0.0.0.0",
  "forceRefresh": false
}
```

Response:
```json
{
  "success": true,
  "cached": false,
  "detection": {
    "brand": "Sony",
    "confidence": "high",
    "osdName": "BRAVIA KD-55X90J",
    "config": {
      "brand": "Sony",
      "cecPowerOnDelay": 3000,
      "cecPowerOffDelay": 1500,
      "supportsWakeOnCec": true,
      "preferredControlMethod": "CEC",
      "quirks": ["BRAVIA Sync must be enabled in TV settings", ...]
    }
  }
}
```

**Get Cached Detection**:
```bash
GET /api/tv-brands/detect?cecAddress=0.0.0.0
```

### Code Example

```typescript
import {
  detectBrandFromOSD,
  getCachedBrandDetection,
  cacheBrandDetection
} from '@/lib/tv-brands-config'

// Detect from OSD name
const detection = detectBrandFromOSD('BRAVIA KD-55X90J')
console.log(detection.brand) // "Sony"
console.log(detection.config.cecPowerOnDelay) // 3000

// Check cache
const cached = getCachedBrandDetection('0.0.0.0')

// Cache a detection
cacheBrandDetection('0.0.0.0', detection)
```

---

## Scheduled Command Sequences

### Overview
Schedule automated TV power control, CEC commands, matrix switching, and custom commands with flexible scheduling options.

### Database Schema

#### ScheduledCommand Table
```sql
CREATE TABLE ScheduledCommand (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  commandType TEXT NOT NULL,           -- 'tv_power', 'cec', 'matrix', 'custom'
  targetType TEXT NOT NULL,            -- 'all', 'specific', 'group'
  targets TEXT NOT NULL,               -- JSON array of target IDs
  commandSequence TEXT NOT NULL,       -- JSON array of commands
  scheduleType TEXT NOT NULL,          -- 'once', 'daily', 'weekly', 'monthly', 'cron'
  scheduleData TEXT NOT NULL,          -- JSON schedule configuration
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  enabled INTEGER NOT NULL DEFAULT 1,
  lastExecuted TEXT,
  nextExecution TEXT,
  executionCount INTEGER NOT NULL DEFAULT 0,
  failureCount INTEGER NOT NULL DEFAULT 0,
  createdBy TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

#### ScheduledCommandLog Table
```sql
CREATE TABLE ScheduledCommandLog (
  id TEXT PRIMARY KEY,
  scheduledCommandId TEXT NOT NULL,
  executedAt TEXT NOT NULL,
  success INTEGER NOT NULL,
  commandsSent INTEGER NOT NULL DEFAULT 0,
  commandsFailed INTEGER NOT NULL DEFAULT 0,
  executionTime INTEGER,               -- Milliseconds
  errorMessage TEXT,
  details TEXT,                        -- JSON execution details
  targetResults TEXT,                  -- JSON results per target
  FOREIGN KEY (scheduledCommandId) REFERENCES ScheduledCommand(id) ON DELETE CASCADE
);
```

### Schedule Types

#### 1. Once (One-time execution)
```json
{
  "scheduleType": "once",
  "scheduleData": {
    "executeAt": "2025-11-03T08:00:00Z"
  }
}
```

#### 2. Daily
```json
{
  "scheduleType": "daily",
  "scheduleData": {
    "time": "08:00"
  }
}
```

#### 3. Weekly
```json
{
  "scheduleType": "weekly",
  "scheduleData": {
    "daysOfWeek": [1, 2, 3, 4, 5],  // Monday-Friday
    "time": "08:00"
  }
}
```

#### 4. Monthly
```json
{
  "scheduleType": "monthly",
  "scheduleData": {
    "dayOfMonth": 1,
    "time": "08:00"
  }
}
```

### Command Types

#### 1. TV Power (CEC-based)
```json
{
  "commandType": "tv_power",
  "targets": [
    { "id": "tv1", "cecAddress": "0.0.0.0", "name": "Main Bar TV" }
  ],
  "commandSequence": [
    { "action": "on", "delay": 3000 }
  ]
}
```

#### 2. CEC Commands
```json
{
  "commandType": "cec",
  "targets": [
    { "id": "tv1", "cecAddress": "0.0.0.0" }
  ],
  "commandSequence": [
    { "cecCommand": "tx 0000 04", "description": "Power on" }
  ]
}
```

#### 3. Matrix Switching
```json
{
  "commandType": "matrix",
  "targets": [
    { "id": "output1", "name": "TV 1" }
  ],
  "commandSequence": [
    { "matrixCommand": "MT00SW01NT01", "description": "Switch to input 1" }
  ]
}
```

#### 4. Custom Commands
```json
{
  "commandType": "custom",
  "targets": [
    { "id": "system", "name": "System" }
  ],
  "commandSequence": [
    { "command": "curl http://example.com/webhook", "timeout": 5000 }
  ]
}
```

### API Endpoints

#### Create Schedule
```bash
POST /api/scheduled-commands
Content-Type: application/json

{
  "name": "Morning TV Power On",
  "description": "Turn on all TVs at 8 AM weekdays",
  "commandType": "tv_power",
  "targetType": "all",
  "targets": [...],
  "commandSequence": [...],
  "scheduleType": "weekly",
  "scheduleData": {
    "daysOfWeek": [1, 2, 3, 4, 5],
    "time": "08:00"
  },
  "timezone": "America/New_York",
  "enabled": true
}
```

#### List Schedules
```bash
GET /api/scheduled-commands?enabled=true
```

#### Update Schedule
```bash
PUT /api/scheduled-commands
Content-Type: application/json

{
  "id": "schedule-id",
  "enabled": false
}
```

#### Delete Schedule
```bash
DELETE /api/scheduled-commands?id=schedule-id
```

### Scheduler Service

Location: `/src/lib/services/command-scheduler.ts`

**Starting the scheduler**:
```typescript
import { commandScheduler } from '@/lib/services/command-scheduler'

// Start scheduler (checks every minute)
commandScheduler.start()

// Stop scheduler
commandScheduler.stop()

// Manually trigger a command
await commandScheduler.triggerCommand('schedule-id')
```

The scheduler:
- Runs every 60 seconds
- Checks for commands due for execution
- Executes commands and logs results
- Calculates next execution time
- Handles failures gracefully

---

## Document Management UI

### Overview
A comprehensive UI for managing AI training documents with full CRUD operations, search, filtering, and categorization.

### Location
- Component: `/src/components/DocumentManagementUI.tsx`
- API: `/src/app/api/ai/documents/route.ts`

### Features

#### 1. Document Listing
- View all uploaded training documents
- Display metadata: title, filename, size, upload date, view count
- Show tags and categories
- Active/inactive status

#### 2. Search and Filter
- **Search**: Search by title, filename, or description
- **Category Filter**: Filter by document category
- Real-time filtering

#### 3. Document Actions

**View Document**:
- Track view count
- Update last viewed timestamp
- (Preview functionality can be extended)

**Edit Metadata**:
- Update title
- Change category
- Edit description
- Manage tags (comma-separated)
- Toggle active status

**Delete Document**:
- **Soft Delete**: Mark as inactive (default)
- **Hard Delete**: Permanently remove file and database record

#### 4. Enhanced Schema

New fields in `TrainingDocument` table:
- `filePath`: Full path to document file
- `tags`: JSON array of tags
- `description`: User-provided description
- `metadata`: JSON metadata
- `processedAt`: When document was processed for AI
- `viewCount`: Number of times viewed
- `lastViewed`: Last view timestamp

### API Endpoints

#### List Documents
```bash
GET /api/ai/documents?active=true&category=Hardware&search=setup&limit=50&offset=0
```

Response:
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-id",
      "title": "Hardware Setup Guide",
      "fileName": "setup.pdf",
      "filePath": "/home/ubuntu/Uploads/setup.pdf",
      "fileType": "pdf",
      "fileSize": 2048576,
      "category": "Hardware",
      "tags": ["setup", "installation", "guide"],
      "description": "Complete hardware setup instructions",
      "viewCount": 42,
      "lastViewed": "2025-11-02T10:30:00Z",
      "isActive": true,
      "createdAt": "2025-11-01T08:00:00Z",
      "updatedAt": "2025-11-02T10:30:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### Update Document
```bash
PUT /api/ai/documents
Content-Type: application/json

{
  "id": "doc-id",
  "title": "Updated Title",
  "description": "Updated description",
  "category": "Configuration",
  "tags": ["config", "setup"],
  "isActive": true
}
```

#### Delete Document
```bash
# Soft delete (mark inactive)
DELETE /api/ai/documents?id=doc-id

# Permanent delete
DELETE /api/ai/documents?id=doc-id&permanent=true
```

#### Track View
```bash
POST /api/ai/documents
Content-Type: application/json

{
  "id": "doc-id",
  "action": "view"
}
```

### Integration

To add the Document Management UI to the AI Hub:

```tsx
import DocumentManagementUI from '@/components/DocumentManagementUI'

// In your AI Hub page
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="documents">Documents</TabsTrigger>
  </TabsList>

  <TabsContent value="documents">
    <DocumentManagementUI />
  </TabsContent>
</Tabs>
```

---

## Database Migration

To apply the new schema changes, run:

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db < /home/ubuntu/Sports-Bar-TV-Controller/src/lib/db/migrations/add-scheduled-commands.sql
```

The migration includes:
1. New columns for `TrainingDocument` table
2. New `ScheduledCommand` table
3. New `ScheduledCommandLog` table
4. Appropriate indexes for performance

---

## Testing

### 1. Security Validator
```bash
# Test command chaining
curl -X POST http://localhost:3000/api/test/security \
  -H "Content-Type: application/json" \
  -d '{"command": "git status && git diff", "context": {"allowChaining": true}}'

# Test I/O redirection
curl -X POST http://localhost:3000/api/test/security \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la > /tmp/output.txt"}'
```

### 2. Brand Detection
```bash
# Detect brand
curl -X POST http://localhost:3000/api/tv-brands/detect \
  -H "Content-Type: application/json" \
  -d '{"cecAddress": "0.0.0.0"}'

# Get cached detection
curl http://localhost:3000/api/tv-brands/detect?cecAddress=0.0.0.0
```

### 3. Scheduled Commands
```bash
# Create daily TV power on schedule
curl -X POST http://localhost:3000/api/scheduled-commands \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Power On",
    "commandType": "tv_power",
    "targetType": "all",
    "targets": [{"id": "tv1", "cecAddress": "0.0.0.0"}],
    "commandSequence": [{"action": "on"}],
    "scheduleType": "daily",
    "scheduleData": {"time": "08:00"},
    "enabled": true
  }'

# List schedules
curl http://localhost:3000/api/scheduled-commands?enabled=true
```

### 4. Document Management
```bash
# List documents
curl http://localhost:3000/api/ai/documents?active=true

# Update document
curl -X PUT http://localhost:3000/api/ai/documents \
  -H "Content-Type: application/json" \
  -d '{"id": "doc-id", "title": "Updated Title", "tags": ["new", "tags"]}'

# Delete document
curl -X DELETE http://localhost:3000/api/ai/documents?id=doc-id
```

---

## Summary of Files Modified/Created

### Modified Files
1. `/src/lib/ai-tools/security/enhanced-validator.ts` - Enhanced security validation
2. `/src/lib/tv-brands-config.ts` - Added brand detection and caching
3. `/src/db/schema.ts` - Added scheduled commands and enhanced training documents schema

### New Files
1. `/src/app/api/tv-brands/detect/route.ts` - Brand detection API
2. `/src/app/api/scheduled-commands/route.ts` - Scheduled commands API
3. `/src/app/api/ai/documents/route.ts` - Document management API
4. `/src/lib/services/command-scheduler.ts` - Cron-like scheduler service
5. `/src/components/DocumentManagementUI.tsx` - Document management UI
6. `/src/lib/db/migrations/add-scheduled-commands.sql` - Database migration
7. `/docs/AI_HUB_IMPROVEMENTS.md` - This documentation

---

## Future Enhancements

1. **Security Validator**
   - Add machine learning-based anomaly detection
   - Implement rate limiting per user/session
   - Add audit log viewer UI

2. **Brand Detection**
   - Support for additional TV brands
   - Auto-detection on TV power on
   - Brand-specific optimization recommendations

3. **Scheduled Commands**
   - Full cron expression support
   - Schedule templates library
   - Conflict detection (prevent overlapping schedules)
   - Schedule groups (execute multiple schedules as one)

4. **Document Management**
   - Document preview/viewer
   - PDF text extraction and indexing
   - Document version history
   - Bulk operations (multi-select, batch delete)
   - Document sharing and permissions

---

## Support

For issues or questions, please refer to:
- Main README: `/README.md`
- API Documentation: `/docs/API.md`
- Troubleshooting Guide: `/docs/TROUBLESHOOTING.md`
