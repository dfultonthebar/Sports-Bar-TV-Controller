# Memory Bank System

The Memory Bank is a project context tracking system that automatically saves snapshots of your project state, making it easy to resume work after terminal restarts or context switches.

## Overview

Memory Bank creates timestamped Markdown snapshots that include:
- Current git branch and commit information
- Modified, staged, and untracked files
- Recent file changes (when using file watcher)
- System state (PM2, database, port)
- Project file tree
- Quick resume commands

## Features

### 1. Manual Snapshots
Create snapshots on demand to capture current project state.

### 2. File Watcher
Automatically monitor project files and create snapshots when significant changes occur.

### 3. Context Restoration
Quickly view past snapshots to understand what you were working on.

### 4. Automatic Cleanup
Keeps only the last 30 snapshots to prevent storage bloat.

### 5. API Endpoints
RESTful API for integration with other tools.

## CLI Commands

### Create a Snapshot
```bash
npm run memory:snapshot
```
Creates a new context snapshot and saves it to `memory-bank/`.

### Restore/View Latest Context
```bash
npm run memory:restore
```
Displays the most recent context snapshot.

### Restore Specific Snapshot
```bash
npm run memory:restore 2025-11-04-172402
```
Displays a specific snapshot by ID.

### List All Snapshots
```bash
npm run memory:list
```
Shows a table of all available snapshots with metadata.

### View Statistics
```bash
npm run memory:stats
```
Displays storage statistics and current watcher status.

### Start File Watcher
```bash
npm run memory:watch
```
Starts monitoring project files for changes. Auto-creates snapshots when 10+ files change.

### Stop File Watcher
```bash
npm run memory:stop
```
Stops the file watcher.

## API Endpoints

### GET /api/memory-bank/current
Get the latest context snapshot.

**Response:**
```json
{
  "success": true,
  "content": "# Project Context - 2025-11-04...\n..."
}
```

### GET /api/memory-bank/history
List all snapshots with statistics.

**Response:**
```json
{
  "success": true,
  "snapshots": [
    {
      "id": "2025-11-04-172402",
      "timestamp": "2025-11-04T23:24:02.837Z",
      "filename": "context-2025-11-04-172402.md",
      "size": 7168,
      "branch": "main",
      "commitHash": "0bb039e"
    }
  ],
  "stats": {
    "totalSnapshots": 1,
    "totalSize": 7168,
    "storageDir": "/home/ubuntu/Sports-Bar-TV-Controller/memory-bank",
    "isWatching": false
  }
}
```

### GET /api/memory-bank/restore/:id
Get a specific snapshot by ID.

**Response:**
```json
{
  "success": true,
  "id": "2025-11-04-172402",
  "content": "# Project Context - 2025-11-04...\n..."
}
```

### POST /api/memory-bank/snapshot
Create a manual snapshot.

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "id": "2025-11-04-172402",
    "timestamp": "2025-11-04T23:24:02.837Z",
    "filename": "context-2025-11-04-172402.md",
    "size": 7168,
    "branch": "main",
    "commitHash": "0bb039e"
  }
}
```

### POST /api/memory-bank/start-watching
Start the file watcher.

**Response:**
```json
{
  "success": true,
  "message": "File watcher started",
  "stats": {
    "totalSnapshots": 1,
    "totalSize": 7168,
    "storageDir": "/home/ubuntu/Sports-Bar-TV-Controller/memory-bank",
    "isWatching": true
  }
}
```

### POST /api/memory-bank/stop-watching
Stop the file watcher.

**Response:**
```json
{
  "success": true,
  "message": "File watcher stopped"
}
```

## File Watcher Configuration

The file watcher monitors:
- `src/**/*.{ts,tsx,js,jsx}` - Source code
- `docs/**/*.md` - Documentation
- `package.json`, `package-lock.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `next.config.js` - Next.js config
- `ecosystem.config.js` - PM2 config
- `drizzle.config.ts` - Database config
- `scripts/**/*.{ts,js}` - Build scripts
- `.env.example` - Environment template

### Excluded from Watching:
- `node_modules/`
- `.next/`
- `dist/`, `build/`
- `.git/`
- `memory-bank/` (prevents infinite loops)
- `coverage/`
- `*.log` files
- PDF files
- Temporary files

### Debouncing
File changes are debounced by 500ms to prevent excessive snapshots during rapid file modifications.

### Auto-Snapshot Threshold
Automatic snapshots are created when 10 or more files have changed (configurable).

## Snapshot Format

Each snapshot is saved as a Markdown file with this structure:

```markdown
# Project Context - [ISO Timestamp]

## Current Status
- Branch, commit info, file counts

## Recent Changes
- Added, modified, deleted files (when using watcher)

## Staged Files
- Files staged for commit

## Modified Files (Unstaged)
- Files with uncommitted changes

## Untracked Files
- New files not yet in git

## System State
- Database path, port, Node version, PM2 status

## Key Project Structure
- Directory tree of important folders

## Quick Resume
- Commands to get back to work
```

## Storage

### Location
Snapshots are stored in `/memory-bank/` directory at project root.

### Index
An `INDEX.md` file maintains a catalog of all snapshots with metadata.

### Cleanup
The system automatically maintains the last 30 snapshots. Older snapshots are deleted automatically.

### Size
Average snapshot size: ~7 KB
30 snapshots: ~210 KB total

## Use Cases

### 1. Terminal Session Restart
After SSH disconnection or terminal restart:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run memory:restore
```
Instantly see what you were working on.

### 2. Context Switching
Before switching to a different task:
```bash
npm run memory:snapshot
```
Save current context for easy return.

### 3. Daily Work Log
Start of day:
```bash
npm run memory:list
npm run memory:restore
```
Review yesterday's work and continue.

### 4. Debugging
When something breaks:
```bash
npm run memory:list
npm run memory:restore [id-from-before-break]
```
See what changed since the last working state.

### 5. Onboarding
New developer joining the project:
```bash
npm run memory:restore
```
Get up-to-speed on current work.

## Integration with PM2

The Memory Bank system can be integrated with PM2 to auto-snapshot on app restarts.

Add to `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'sports-bar-tv',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    // ... other config ...

    // Memory Bank hooks
    post_update: 'npm run memory:snapshot',
    restart_delay: 2000,
  }]
};
```

## Programmatic Usage

```typescript
import { getMemoryBank } from '@/lib/memory-bank';

const memoryBank = getMemoryBank();

// Create snapshot
const snapshot = await memoryBank.createSnapshot();

// Get latest
const latest = await memoryBank.getLatestSnapshot();

// List all
const snapshots = await memoryBank.listSnapshots();

// Start watching
await memoryBank.startWatching();

// Stop watching
await memoryBank.stopWatching();

// Get stats
const stats = await memoryBank.getStats();
```

## Architecture

### Components

1. **FileWatcher** (`src/lib/memory-bank/file-watcher.ts`)
   - Monitors project files using chokidar
   - Debounces rapid changes
   - Emits change events

2. **ContextGenerator** (`src/lib/memory-bank/context-generator.ts`)
   - Executes git commands to gather project state
   - Generates Markdown formatted context
   - Creates quick resume commands

3. **Storage** (`src/lib/memory-bank/storage.ts`)
   - Saves snapshots to disk
   - Maintains index
   - Handles cleanup

4. **MemoryBank** (`src/lib/memory-bank/index.ts`)
   - Main orchestration service
   - Ties together all components
   - Provides simple API

5. **API Endpoints** (`src/app/api/memory-bank/`)
   - RESTful HTTP interface
   - Integrates with Next.js

6. **CLI** (`scripts/memory-bank.ts`)
   - Command-line interface
   - User-friendly output

## Best Practices

### When to Create Snapshots

✅ **DO:**
- Before ending work session
- Before major refactoring
- After completing a feature
- Before switching branches
- When debugging starts

❌ **DON'T:**
- During active development (use watcher instead)
- In CI/CD pipelines (unnecessary)
- Too frequently (watcher handles this)

### File Watcher

✅ **DO:**
- Use during active development
- Stop when done for the day
- Monitor output for unusual patterns

❌ **DON'T:**
- Leave running overnight
- Use in production
- Watch too many files

## Troubleshooting

### "No snapshots found"
Run `npm run memory:snapshot` to create the first snapshot.

### File watcher not detecting changes
Check that files match include patterns in `file-watcher.ts`.

### Snapshots too large
Some untracked files might be getting captured in git status. Add them to `.gitignore`.

### Auto-snapshots not creating
Ensure 10+ files have changed or lower the threshold in `src/lib/memory-bank/index.ts`.

### Permission errors
Ensure the `memory-bank/` directory is writable:
```bash
chmod 755 memory-bank/
```

## Future Enhancements

Potential future features:
- Snapshot compression
- Remote backup to cloud storage
- Diff view between snapshots
- Web UI for browsing snapshots
- Integration with task tracking systems
- Snapshot search functionality
- Custom snapshot templates
- Team collaboration features

## License

Part of the Sports Bar TV Controller project.

---

*Memory Bank - Never lose context again.*
