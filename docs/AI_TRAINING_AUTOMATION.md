# AI Training Automation with n8n

## Overview

This system automatically detects when documentation is added or updated, and facilitates AI training without manual intervention.

## How It Works

```
┌─────────────────────┐
│  Add/Update Docs    │
│  in /docs folder    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   n8n Workflow      │
│  (Every 15 min)     │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│  Adds to Queue   │  │  Calls API       │
│  (Database)      │  │  Endpoint        │
└──────────────────┘  └──────────────────┘
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  You get notified    │
           │  "Tell Claude Code   │
           │   to process docs"   │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  Claude Code reads   │
           │  pending docs and    │
           │  generates Q&As      │
           └──────────────────────┘
```

## Setup Instructions

### Step 1: Import n8n Workflow

1. Access n8n at http://localhost:5678
2. Click "Workflows" → "Import from File"
3. Select `/home/ubuntu/Sports-Bar-TV-Controller/n8n-workflows/ai-training-auto.json`
4. Click "Import"

### Step 2: Configure Database Credential

The workflow needs access to your production database:

1. In n8n, go to "Credentials"
2. Click "Add Credential" → "SQLite"
3. Name it: `production-db`
4. Database File Path: `/home/ubuntu/sports-bar-data/production.db`
5. Click "Create"

### Step 3: Activate the Workflow

1. Open the imported workflow
2. Click "Active" toggle in top right
3. Workflow will now run every 15 minutes

## What the Workflow Does

### 1. **Monitors /docs Folder**
- Checks every 15 minutes for new/modified `.md` files
- Looks for files changed in last 20 minutes
- Processes up to 20 files per check

### 2. **Adds to Queue**
- Stores detected files in `PendingAITraining` table
- Prevents duplicate processing
- Tracks when each file was detected

### 3. **Calls API Endpoint**
- POSTs to `/api/ai/train` with file path
- Prepares document content for processing
- Returns structured data ready for Q&A generation

### 4. **Notifies You**
- System notification when new docs detected
- You can then tell Claude Code to process them

## Using the System

### When Documentation is Detected

You'll see a notification:
```
📚 New documentation detected!
Run: tell Claude Code to process pending AI training docs
```

### Processing Pending Docs with Claude Code

Simply tell Claude Code:
```
"Process pending AI training docs"
```

or

```
"Generate Q&As for the pending documentation"
```

Claude Code will:
1. Query the database for pending files
2. Read each file
3. Generate Q&A pairs
4. Save to database
5. Mark files as processed

### Manual Check for Pending Docs

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT fileName, detectedAt, status FROM PendingAITraining WHERE status='pending'"
```

### API Endpoints

#### GET /api/ai/train
Get current training stats:
```bash
curl http://localhost:3001/api/ai/train
```

Response:
```json
{
  "success": true,
  "totalQAs": 87,
  "categories": {
    "technical": 59,
    "ai-assistant": 6,
    "directv": 5
  },
  "lastUpdated": "2025-10-29T20:30:00.000Z"
}
```

#### POST /api/ai/train
Prepare a document for training:
```bash
curl -X POST http://localhost:3001/api/ai/train \
  -H "Content-Type: application/json" \
  -d '{"filePath": "docs/MY_FEATURE.md"}'
```

Response:
```json
{
  "success": true,
  "sourceFile": "docs/MY_FEATURE.md",
  "contentLength": 1234,
  "content": "... file content ...",
  "category": "docs"
}
```

#### PUT /api/ai/train
Save generated Q&As (used by Claude Code):
```bash
curl -X PUT http://localhost:3001/api/ai/train \
  -H "Content-Type: application/json" \
  -d '{
    "qas": [
      {
        "question": "How do I...",
        "answer": "You can...",
        "category": "features",
        "tags": ["setup", "config"],
        "confidence": 0.9,
        "sourceFile": "docs/MY_FEATURE.md"
      }
    ]
  }'
```

## Customization

### Change Check Frequency

Edit the workflow in n8n:
1. Click on "Check Every 15 Minutes" node
2. Modify the interval (options: minutes, hours, days)
3. Click "Execute Workflow" to test

### Change Monitored Folder

Edit the "Find Recently Modified Docs" node:
```bash
# Current command:
find /home/ubuntu/Sports-Bar-TV-Controller/docs -name '*.md' -type f -mmin -20

# To monitor additional folders:
find /home/ubuntu/Sports-Bar-TV-Controller/docs \
     /home/ubuntu/Sports-Bar-TV-Controller/guides \
     -name '*.md' -type f -mmin -20
```

### Change File Types

To monitor PDF files too:
```bash
find /home/ubuntu/Sports-Bar-TV-Controller/docs \
  \( -name '*.md' -o -name '*.pdf' \) -type f -mmin -20
```

## Troubleshooting

### Workflow Not Triggering

Check if workflow is active:
```bash
curl http://localhost:5678/rest/workflows
```

### Database Connection Error

Verify database path in n8n credential:
```bash
ls -la /home/ubuntu/sports-bar-data/production.db
```

### No Notifications Appearing

Test the notification manually:
```bash
echo "Test notification" | wall
```

### API Endpoint Not Responding

Check if main app is running:
```bash
pm2 list | grep sports-bar-tv-controller
```

Restart if needed:
```bash
pm2 restart sports-bar-tv-controller
```

## Database Schema

The `PendingAITraining` table structure:

```sql
CREATE TABLE PendingAITraining (
  id TEXT PRIMARY KEY,
  filePath TEXT UNIQUE NOT NULL,  -- Full path to file
  fileName TEXT NOT NULL,          -- Just the filename
  detectedAt TEXT NOT NULL,        -- When it was detected
  status TEXT DEFAULT 'pending',   -- pending/processing/completed/error
  processedAt TEXT,                -- When Claude Code processed it
  errorMessage TEXT,               -- If any errors occurred
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

### Useful Queries

**Check queue:**
```sql
SELECT * FROM PendingAITraining WHERE status='pending';
```

**Mark as processed:**
```sql
UPDATE PendingAITraining
SET status='completed', processedAt=datetime('now'), updatedAt=datetime('now')
WHERE filePath='/path/to/file.md';
```

**Clear old entries:**
```sql
DELETE FROM PendingAITraining
WHERE status='completed'
AND datetime(processedAt) < datetime('now', '-7 days');
```

## Benefits

### 1. **Automatic Detection**
- No need to remember to train AI after docs changes
- Catches all documentation updates automatically

### 2. **Centralized Queue**
- All pending training in one place
- Easy to see what needs processing
- Can process in batches

### 3. **Integration Ready**
- API endpoints for automation
- Works with Claude Code seamlessly
- Can integrate with other tools

### 4. **Audit Trail**
- Track when docs were added
- See processing history
- Monitor AI knowledge growth

## Best Practices

1. **Document First, Then Commit**
   - Write/update docs in `/docs` folder
   - Wait 15 min for detection (or trigger manually)
   - Process with Claude Code
   - Then commit code and docs together

2. **Batch Processing**
   - Let multiple docs accumulate
   - Process them all at once with Claude Code
   - More efficient than one-by-one

3. **Review Before Training**
   - Check pending queue before processing
   - Ensure docs are final/reviewed
   - Remove test files from queue if needed

4. **Monitor Queue Size**
   - If queue gets large (20+ files), process incrementally
   - Claude Code works best with 5-10 files at a time

## Example Workflow

```bash
# 1. Add new documentation
echo "# New Feature\n..." > docs/NEW_FEATURE.md

# 2. Wait for n8n to detect it (or check manually)
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT COUNT(*) FROM PendingAITraining WHERE status='pending'"

# 3. Tell Claude Code
# (In Claude Code session)
"Process pending AI training docs"

# 4. Verify
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT COUNT(*) FROM QAEntry"
```

## Future Enhancements

Potential improvements:
- Slack/Discord notifications instead of wall
- Automatic Claude API integration (with API key)
- Priority queue for urgent documentation
- Diff detection (only process changed sections)
- Web UI for queue management
