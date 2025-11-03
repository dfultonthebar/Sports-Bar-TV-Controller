# AI Hub Quick Start Guide

Quick reference for the new AI Hub features.

## Security Validator - Enhanced Commands

### Now Allowed:

**Command Chaining** (with context):
```bash
git status && git diff
npm list && npm outdated
```

**I/O Redirection** (to safe locations):
```bash
ls -la > /tmp/output.txt
grep "error" app.log >> /home/ubuntu/logs/errors.log
```

**Command Substitution** (safe commands only):
```bash
echo "Current time: $(date)"
echo "User: $(whoami)"
```

**Piping**:
```bash
cat file.txt | grep "search" | wc -l
find . -name "*.ts" | head -20
```

### Usage:
```typescript
import { enhancedSecurityValidator } from '@/lib/ai-tools/security/enhanced-validator'

const result = enhancedSecurityValidator.validateBashCommand(
  'git status && git diff',
  { allowChaining: true }
)
```

---

## TV Brand Detection

### Quick Detection:
```bash
POST /api/tv-brands/detect
{
  "cecAddress": "0.0.0.0",
  "forceRefresh": false
}
```

### In Code:
```typescript
import { detectBrandFromOSD } from '@/lib/tv-brands-config'

const detection = detectBrandFromOSD('BRAVIA KD-55X90J')
console.log(detection.brand) // "Sony"
console.log(detection.config.cecPowerOnDelay) // 3000
```

---

## Scheduled Commands

### Create Daily Schedule (8 AM power on):
```bash
POST /api/scheduled-commands
{
  "name": "Morning Power On",
  "commandType": "tv_power",
  "targetType": "all",
  "targets": [{"id": "tv1", "cecAddress": "0.0.0.0"}],
  "commandSequence": [{"action": "on"}],
  "scheduleType": "daily",
  "scheduleData": {"time": "08:00"}
}
```

### Create Weekly Schedule (Weekdays 8 AM):
```bash
POST /api/scheduled-commands
{
  "name": "Weekday Power On",
  "scheduleType": "weekly",
  "scheduleData": {
    "daysOfWeek": [1, 2, 3, 4, 5],
    "time": "08:00"
  }
}
```

### Start Scheduler:
```bash
POST /api/scheduler/manage
{
  "action": "start"
}
```

### Manually Trigger:
```bash
POST /api/scheduler/manage
{
  "action": "trigger",
  "commandId": "schedule-id"
}
```

---

## Document Management

### List Documents:
```bash
GET /api/ai/documents?active=true&category=Hardware&search=setup
```

### Update Document:
```bash
PUT /api/ai/documents
{
  "id": "doc-id",
  "title": "New Title",
  "category": "Hardware",
  "tags": ["setup", "guide"],
  "description": "Updated description"
}
```

### Delete Document:
```bash
# Soft delete (mark inactive)
DELETE /api/ai/documents?id=doc-id

# Permanent delete
DELETE /api/ai/documents?id=doc-id&permanent=true
```

---

## UI Integration

### Add Document Management to AI Hub:
```tsx
import DocumentManagementUI from '@/components/DocumentManagementUI'

<TabsContent value="documents">
  <DocumentManagementUI />
</TabsContent>
```

---

## Database Migration

Run the migration to add new tables:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db < src/lib/db/migrations/add-scheduled-commands.sql
```

---

## Common Tasks

### 1. Schedule Daily TV Power On/Off
```typescript
// Power On at 8 AM
{
  "name": "Morning Power On",
  "commandType": "tv_power",
  "scheduleType": "daily",
  "scheduleData": { "time": "08:00" },
  "commandSequence": [{ "action": "on", "delay": 3000 }]
}

// Power Off at 2 AM
{
  "name": "Night Power Off",
  "commandType": "tv_power",
  "scheduleType": "daily",
  "scheduleData": { "time": "02:00" },
  "commandSequence": [{ "action": "off", "delay": 1500 }]
}
```

### 2. Auto-Detect All TV Brands
```typescript
// For each TV output
const outputs = await db.select().from(matrixOutputs)

for (const output of outputs) {
  if (output.cecAddress) {
    const response = await fetch('/api/tv-brands/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cecAddress: output.cecAddress })
    })

    const { detection } = await response.json()

    // Update database with brand
    await db.update(matrixOutputs)
      .set({ tvBrand: detection.brand })
      .where(eq(matrixOutputs.id, output.id))
  }
}
```

### 3. Organize Training Documents
```typescript
// Add categories and tags to uploaded documents
await fetch('/api/ai/documents', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'doc-id',
    category: 'Hardware',
    tags: ['setup', 'installation', 'cec'],
    description: 'CEC setup and configuration guide'
  })
})
```

---

## Troubleshooting

### Scheduler Not Running
```bash
# Check status
GET /api/scheduler/status

# Start scheduler
POST /api/scheduler/manage
{ "action": "start" }
```

### Brand Detection Fails
```bash
# Test CEC connection
echo 'scan' | cec-client -s -d 1

# Force refresh detection
POST /api/tv-brands/detect
{
  "cecAddress": "0.0.0.0",
  "forceRefresh": true
}
```

### Security Validator Blocking Valid Commands
```bash
# Check if command matches safe patterns
# Add context for chaining/redirection
const result = validateBashCommand(command, {
  allowChaining: true,
  operation: 'read'
})
```

---

## Additional Resources

- Full Documentation: `/docs/AI_HUB_IMPROVEMENTS.md`
- API Reference: `/docs/API.md`
- Database Schema: `/src/db/schema.ts`
