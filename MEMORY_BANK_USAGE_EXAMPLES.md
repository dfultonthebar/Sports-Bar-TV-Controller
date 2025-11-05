# Memory Bank - Usage Examples

Real-world usage scenarios for the Memory Bank system.

## Example 1: Quick Resume After SSH Disconnect

**Scenario:** Your SSH connection dropped while working on a feature.

```bash
# Reconnect and navigate to project
ssh user@server
cd /home/ubuntu/Sports-Bar-TV-Controller

# View latest context to see what you were doing
npm run memory:restore
```

**Output:**
```
# Project Context - 2025-11-04T23:25:44.029Z

## Current Status
- Branch: feature/authentication
- Last Commit: abc1234 - WIP: Adding JWT authentication
- Modified Files: 12

## Modified Files (Unstaged)
- src/lib/auth/jwt-handler.ts
- src/app/api/auth/login/route.ts
- src/middleware.ts
...

## Quick Resume
# Navigate to project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Check application status
pm2 status
pm2 logs sports-bar-tv --lines 20
```

**Result:** You immediately know:
- You were on the `feature/authentication` branch
- Last commit was WIP on JWT
- 12 files modified
- Exact commands to continue

---

## Example 2: Pre-Commit Snapshot

**Scenario:** Before committing, save a snapshot for easy rollback.

```bash
# Working on a feature, ready to commit
npm run memory:snapshot

# Commit your changes
git add .
git commit -m "feat: Add authentication system"

# If you need to undo, you have the pre-commit state
npm run memory:list
npm run memory:restore 2025-11-04-170000
```

**Benefit:** Easy rollback reference if the commit causes issues.

---

## Example 3: Active Development with File Watcher

**Scenario:** Actively developing a new feature throughout the day.

```bash
# Morning: Start file watcher
npm run memory:watch
```

**Output:**
```
👁️  Starting file watcher...
✅ File watcher started successfully!
   Watching for changes in key project files...
   Auto-snapshot will be created on significant changes.

   Press Ctrl+C to stop watching.
```

**During the day:**
- Watcher monitors your changes
- When you modify 10+ files, auto-snapshot is created
- Snapshots timestamped for easy reference

**End of day:**
```bash
# Press Ctrl+C
# Or from another terminal:
npm run memory:stop
```

**Review your day:**
```bash
npm run memory:list
```

**Output:**
```
Found 5 snapshot(s):

┌─────────────────────────┬──────────────────────┬────────────┬──────────┬─────────┐
│ Timestamp               │ ID                   │ Branch     │ Commit   │ Size    │
├─────────────────────────┼──────────────────────┼────────────┼──────────┼─────────┤
│ 11/4/2025, 5:30:15 PM   │ 2025-11-04-173015    │ main       │ def5678  │ 8.2 KB  │
│ 11/4/2025, 3:45:22 PM   │ 2025-11-04-154522    │ main       │ abc1234  │ 7.5 KB  │
│ 11/4/2025, 1:20:08 PM   │ 2025-11-04-132008    │ main       │ abc1234  │ 7.1 KB  │
│ 11/4/2025, 10:15:33 AM  │ 2025-11-04-101533    │ main       │ xyz9876  │ 6.9 KB  │
│ 11/4/2025, 9:00:00 AM   │ 2025-11-04-090000    │ main       │ xyz9876  │ 6.8 KB  │
└─────────────────────────┴──────────────────────┴────────────┴──────────┴─────────┘
```

---

## Example 4: Debugging "What Changed?"

**Scenario:** Tests were passing this morning, now they fail. What changed?

```bash
# List snapshots to find the last known good state
npm run memory:list

# Restore to this morning's snapshot
npm run memory:restore 2025-11-04-090000
```

**Output:**
```markdown
## Modified Files (Unstaged)
- src/lib/validation/schemas.ts
- src/app/api/users/route.ts

## Quick Resume
git diff xyz9876..HEAD  # See what changed since this snapshot
```

**Follow the breadcrumbs:**
```bash
# See exactly what changed since the working state
git diff xyz9876..HEAD

# Review the specific files that changed
git diff xyz9876..HEAD src/lib/validation/schemas.ts
```

**Result:** Quickly identify what broke the tests.

---

## Example 5: Onboarding New Developer

**Scenario:** New developer joins, needs to understand current project state.

```bash
# Show them the latest context
npm run memory:restore
```

They see:
```markdown
# Project Context - Current

## Current Status
- Branch: main
- Last Commit: 0bb039e - feat: Migrate console.* to logger.*
- Modified Files: 116

## System State
- Database: /home/ubuntu/sports-bar-data/production.db
- Port: 3001
- Node Version: v20.19.5
- PM2 Status: online

## Quick Resume
# Navigate to project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Start the application
pm2 start ecosystem.config.js

# Development commands
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run db:studio    # Open database studio
```

**Result:** New developer has instant context on:
- Where the project is deployed
- What's currently being worked on
- How to start development
- What commands to use

---

## Example 6: Context Switching Between Tasks

**Scenario:** Need to switch from Feature A to urgent Bug Fix.

**Save Feature A context:**
```bash
# On feature/user-dashboard branch
npm run memory:snapshot

# Note the snapshot ID
# Output: ID: 2025-11-04-140000
```

**Work on bug fix:**
```bash
git checkout main
git checkout -b fix/urgent-bug

# Work on fix...
# Commit and push

# Back to feature work
git checkout feature/user-dashboard
npm run memory:restore 2025-11-04-140000
```

**Result:** Instantly recall what you were doing on Feature A.

---

## Example 7: Monitoring Project Activity

**Scenario:** Want to see how much work happened this week.

```bash
# List all snapshots
npm run memory:list

# View statistics
npm run memory:stats
```

**Output:**
```
📊 Memory Bank Statistics

Total Snapshots: 15
Total Size: 0.10 MB
Storage Dir: /home/ubuntu/Sports-Bar-TV-Controller/memory-bank
Watching: ❌ No
Average Size: 7.0 KB
```

**Analyze:**
```bash
# Review snapshots from each day
npm run memory:restore 2025-11-04-090000  # Monday morning
npm run memory:restore 2025-11-05-090000  # Tuesday morning
npm run memory:restore 2025-11-06-090000  # Wednesday morning
```

---

## Example 8: Pre-Deployment Checkpoint

**Scenario:** About to deploy to production. Save current state.

```bash
# Create labeled snapshot
npm run memory:snapshot

# Note the ID: 2025-11-04-160000

# Deploy
npm run build
pm2 restart sports-bar-tv

# If deployment has issues, restore pre-deploy context
npm run memory:restore 2025-11-04-160000

# See exact state before deployment
```

---

## Example 9: Reviewing Team Changes

**Scenario:** After a team member's PR is merged, see what changed.

```bash
# Before merge - create snapshot
npm run memory:snapshot

# After merge
git pull

# Compare
npm run memory:list
npm run memory:restore [pre-merge-id]
```

**See changes:**
```markdown
## Modified Files (Unstaged)
[Before merge snapshot shows old state]

# Current state
git status
```

---

## Example 10: Automated Integration

**Scenario:** Automatically create snapshots on PM2 restart.

**Add to `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'sports-bar-tv',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',

    // Create snapshot after restart
    post_update: 'npm run memory:snapshot',

    // Create snapshot before restart
    pre_update: 'npm run memory:snapshot',
  }]
};
```

**Result:** Automatic snapshots on every deployment.

---

## Example 11: API Integration

**Scenario:** Use Memory Bank from another tool or script.

```bash
# Get latest snapshot via API
curl http://localhost:3001/api/memory-bank/current

# Create snapshot via API
curl -X POST http://localhost:3001/api/memory-bank/snapshot

# List snapshots
curl http://localhost:3001/api/memory-bank/history
```

**In a Node.js script:**
```javascript
import { getMemoryBank } from '@/lib/memory-bank';

const memoryBank = getMemoryBank();

// Create snapshot
const snapshot = await memoryBank.createSnapshot();
console.log('Snapshot created:', snapshot.id);

// Get latest
const latest = await memoryBank.getLatestSnapshot();
console.log('Latest context:', latest);
```

---

## Example 12: CI/CD Integration

**Scenario:** Track deployment history via snapshots.

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Create pre-deploy snapshot
        run: npm run memory:snapshot

      - name: Deploy
        run: ./deploy.sh

      - name: Create post-deploy snapshot
        run: npm run memory:snapshot
```

---

## Tips and Tricks

### Tip 1: Alias Common Commands
Add to your `.bashrc` or `.zshrc`:
```bash
alias mem='npm run memory:restore'
alias mems='npm run memory:snapshot'
alias meml='npm run memory:list'
```

### Tip 2: Quick Status Check
```bash
# Morning routine
npm run memory:restore && pm2 status && git status
```

### Tip 3: Watch During Active Development
```bash
# Start watcher in background
npm run memory:watch &

# Continue working in same terminal
# Or use tmux/screen for separate pane
```

### Tip 4: Snapshot Before Experiments
```bash
# Before trying something risky
npm run memory:snapshot
# Note ID: 2025-11-04-150000

# Experiment...

# If it fails, you know exactly where to reset
git reset --hard [commit-from-snapshot]
```

### Tip 5: Review Yesterday's Work
```bash
# Start of day
npm run memory:list | grep "11/3/2025"
npm run memory:restore [yesterday-id]
```

---

## Command Cheat Sheet

| Command | Description |
|---------|-------------|
| `npm run memory:snapshot` | Create snapshot now |
| `npm run memory:restore` | View latest snapshot |
| `npm run memory:restore <id>` | View specific snapshot |
| `npm run memory:list` | List all snapshots |
| `npm run memory:stats` | Show storage statistics |
| `npm run memory:watch` | Start file watcher |
| `npm run memory:stop` | Stop file watcher |

---

## When to Use

### ✅ DO Use Memory Bank When:
- Starting/ending your work day
- Before major refactoring
- Before/after deployments
- When debugging issues
- Context switching between tasks
- Onboarding new team members
- Before risky experiments

### ❌ DON'T Use Memory Bank When:
- Making trivial changes (let watcher handle it)
- In CI/CD pipelines (adds no value)
- Every few minutes (wasteful)
- For backup purposes (use git instead)

---

*Memory Bank - Smart context tracking for productive development*
