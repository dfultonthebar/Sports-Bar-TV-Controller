# Memory Bank System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Memory Bank System                       │
│                    Project Context Tracking                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   User Interface │  │  API Endpoints   │  │  Core Services   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CLI Interface   │  │  REST API        │  │  Memory Bank     │
│                  │  │                  │  │  (Main Service)  │
│  - snapshot      │  │  GET /current    │  │                  │
│  - restore       │  │  GET /history    │  │  - createSnapshot│
│  - list          │  │  GET /restore/:id│  │  - startWatching │
│  - stats         │  │  POST /snapshot  │  │  - stopWatching  │
│  - watch         │  │  POST /start     │  │  - getSnapshot   │
│  - stop          │  │  POST /stop      │  │  - listSnapshots │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┴──────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
         ▼                                           ▼
┌──────────────────┐                        ┌──────────────────┐
│  File Watcher    │                        │ Context Generator│
│                  │                        │                  │
│  - Monitor files │                        │  - Git status    │
│  - Debounce 500ms│                        │  - System state  │
│  - Include/Exclude│                       │  - File tree     │
│  - Emit changes  │                        │  - Markdown gen  │
└────────┬─────────┘                        └────────┬─────────┘
         │                                           │
         └─────────────────────┬─────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Storage Layer   │
                    │                  │
                    │  - Save snapshots│
                    │  - Index mgmt    │
                    │  - Auto-cleanup  │
                    │  - Retrieval     │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Filesystem      │
                    │                  │
                    │  memory-bank/    │
                    │  ├─ INDEX.md     │
                    │  └─ context-*.md │
                    └──────────────────┘
```

## Component Architecture

### 1. File Watcher (`file-watcher.ts`)

```typescript
┌─────────────────────────────────────────────┐
│         FileWatcher Class                    │
├─────────────────────────────────────────────┤
│  Properties:                                 │
│  - watcher: chokidar.FSWatcher              │
│  - debounceTimer: NodeJS.Timeout            │
│  - pendingChanges: FileChangeEvent[]        │
│  - isWatching: boolean                      │
├─────────────────────────────────────────────┤
│  Methods:                                    │
│  - start(): Promise<void>                   │
│  - stop(): Promise<void>                    │
│  - isActive(): boolean                      │
│  - handleFileChange(type, path): void       │
│  - shouldIncludeFile(path): boolean         │
│  - flushChanges(): void                     │
├─────────────────────────────────────────────┤
│  Events:                                     │
│  - 'changes': (FileChangeEvent[])           │
│  - 'error': (Error)                         │
│  - 'ready': ()                              │
│  - 'stopped': ()                            │
└─────────────────────────────────────────────┘
```

**Watched Files:**
- `src/**/*.{ts,tsx,js,jsx}`
- `docs/**/*.md`
- `package.json`, config files
- `scripts/**/*.{ts,js}`

**Excluded:**
- `node_modules/`, `.next/`, `build/`
- `memory-bank/` (prevent loops)
- `*.log`, `*.pdf`, temp files

### 2. Context Generator (`context-generator.ts`)

```typescript
┌─────────────────────────────────────────────┐
│      ContextGenerator Class                  │
├─────────────────────────────────────────────┤
│  Methods:                                    │
│  - generateContext(): ProjectContext        │
│  - contextToMarkdown(): string              │
│  - getCurrentBranch(): string               │
│  - getLastCommit(): CommitInfo              │
│  - getGitStatus(): StatusInfo               │
│  - getSystemState(): SystemState            │
│  - generateFileTree(): string               │
│  - generateQuickResume(): string[]          │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│          ProjectContext                      │
├─────────────────────────────────────────────┤
│  - timestamp: Date                          │
│  - branch: string                           │
│  - lastCommit: CommitInfo                   │
│  - modifiedFiles: string[]                  │
│  - untrackedFiles: string[]                 │
│  - stagedFiles: string[]                    │
│  - recentChanges: FileChangeEvent[]         │
│  - systemState: SystemState                 │
│  - fileTree: string                         │
│  - quickResume: string[]                    │
└─────────────────────────────────────────────┘
```

**Data Sources:**
- Git commands: `git status`, `git log`, `git rev-parse`
- System: `pm2 jlist`, process.version
- Filesystem: Directory scanning

### 3. Storage Layer (`storage.ts`)

```typescript
┌─────────────────────────────────────────────┐
│      MemoryBankStorage Class                 │
├─────────────────────────────────────────────┤
│  Properties:                                 │
│  - storageDir: string                       │
│  - indexPath: string                        │
│  - maxSnapshots: number (30)                │
├─────────────────────────────────────────────┤
│  Methods:                                    │
│  - saveSnapshot(): ContextSnapshot          │
│  - getSnapshot(id): string                  │
│  - getLatestSnapshot(): string              │
│  - listSnapshots(): ContextSnapshot[]       │
│  - deleteSnapshot(id): boolean              │
│  - getIndex(): MemoryBankIndex              │
│  - rebuildIndex(): MemoryBankIndex          │
│  - updateIndex(snapshot): void              │
│  - cleanupOldSnapshots(): void              │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│         Storage Structure                    │
├─────────────────────────────────────────────┤
│  memory-bank/                               │
│  ├── INDEX.md           (catalog)           │
│  ├── README.md          (guide)             │
│  └── context-*.md       (snapshots)         │
│                                             │
│  Filename Format:                           │
│  context-YYYY-MM-DD-HHmmss.md               │
│  Example: context-2025-11-04-172402.md      │
└─────────────────────────────────────────────┘
```

**Auto-Cleanup:**
- Keeps last 30 snapshots
- Deletes oldest on overflow
- Rebuilds index automatically

### 4. Main Service (`index.ts`)

```typescript
┌─────────────────────────────────────────────┐
│          MemoryBank Class                    │
├─────────────────────────────────────────────┤
│  Components:                                 │
│  - fileWatcher: FileWatcher                 │
│  - contextGenerator: ContextGenerator       │
│  - storage: MemoryBankStorage               │
├─────────────────────────────────────────────┤
│  Public API:                                 │
│  - createSnapshot(): ContextSnapshot        │
│  - startWatching(): void                    │
│  - stopWatching(): void                     │
│  - getLatestSnapshot(): string              │
│  - getSnapshot(id): string                  │
│  - listSnapshots(): ContextSnapshot[]       │
│  - getStats(): StatsInfo                    │
│  - deleteSnapshot(id): boolean              │
├─────────────────────────────────────────────┤
│  Private:                                    │
│  - handleFileChanges(): void                │
│  - autoSnapshotEnabled: boolean             │
│  - snapshotThreshold: number (10)           │
└─────────────────────────────────────────────┘
```

**Flow:**
1. User triggers operation
2. Main service coordinates components
3. Context generated
4. Storage persists
5. Index updated

## Data Flow

### Snapshot Creation Flow

```
User Command/API Call
         │
         ▼
   Memory Bank
         │
         ▼
┌────────────────────┐
│ Context Generator  │
│  1. Get git status │
│  2. Get system info│
│  3. Build context  │
│  4. Format markdown│
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Storage Layer     │
│  1. Save to disk   │
│  2. Update index   │
│  3. Cleanup old    │
└────────┬───────────┘
         │
         ▼
    Filesystem
    memory-bank/
```

### File Watching Flow

```
File System Change
         │
         ▼
┌────────────────────┐
│   Chokidar         │
│   (fs watcher)     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   File Watcher     │
│   1. Filter file   │
│   2. Add to queue  │
│   3. Debounce 500ms│
└────────┬───────────┘
         │
         ▼
   Changes >= 10?
         │
    Yes  │
         ▼
┌────────────────────┐
│  Auto-Snapshot     │
│  1. Generate       │
│  2. Save           │
│  3. Log event      │
└────────────────────┘
```

### Restoration Flow

```
User Command: restore [id]
         │
         ▼
   Memory Bank
         │
    id provided?
    │         │
    No        Yes
    │         │
    ▼         ▼
 Latest   Specific
 from Index  from ID
    │         │
    └────┬────┘
         ▼
┌────────────────────┐
│  Storage Layer     │
│  1. Read file      │
│  2. Parse markdown │
│  3. Return content │
└────────┬───────────┘
         │
         ▼
    Display to User
```

## API Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js API Routes                     │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ GET Endpoints   │ │ POST Endpoints  │ │ Response Format │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ /current        │ │ /snapshot       │ │ { success,      │
│ /history        │ │ /start-watching │ │   data,         │
│ /restore/:id    │ │ /stop-watching  │ │   error? }      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                 │                      │
         └─────────────────┴──────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Memory Bank    │
                  │  Main Service   │
                  └─────────────────┘
```

**Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/memory-bank/current` | Latest snapshot |
| GET | `/api/memory-bank/history` | All snapshots + stats |
| GET | `/api/memory-bank/restore/:id` | Specific snapshot |
| POST | `/api/memory-bank/snapshot` | Create snapshot |
| POST | `/api/memory-bank/start-watching` | Start watcher |
| POST | `/api/memory-bank/stop-watching` | Stop watcher |

## CLI Architecture

```
┌─────────────────────────────────────────────┐
│           CLI Interface                      │
│        (scripts/memory-bank.ts)              │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│        Command Parser                        │
│  process.argv[2] → command                   │
│  process.argv[3] → argument                  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│       Command Router                         │
│  - snapshot  → createSnapshot()              │
│  - restore   → restoreContext()              │
│  - watch     → startWatching()               │
│  - stop      → stopWatching()                │
│  - list      → listSnapshots()               │
│  - stats     → showStats()                   │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│      Memory Bank Service                     │
│  (imports from src/lib/memory-bank)          │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│      Formatted Output                        │
│  - Console colors                            │
│  - Table formatting                          │
│  - Progress indicators                       │
│  - Success/Error messages                    │
└─────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────┐
│           Singleton Pattern                  │
└─────────────────────────────────────────────┘

┌────────────────────┐  ┌────────────────────┐
│ memoryBankInstance │  │ watcherInstance    │
│ (Main Service)     │  │ (File Watcher)     │
└────────────────────┘  └────────────────────┘

┌────────────────────┐  ┌────────────────────┐
│ contextGenerator   │  │ storageInstance    │
│ (Context Gen)      │  │ (Storage Layer)    │
└────────────────────┘  └────────────────────┘

Benefits:
- Single watcher per project
- Shared state across calls
- Consistent configuration
- Memory efficient
```

## Error Handling

```
┌─────────────────────────────────────────────┐
│            Error Hierarchy                   │
└─────────────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Git Errors  File Errors
    │         │
    ├─ Not a repo
    ├─ Git not found
    │
    ▼
    Fallback to defaults
    Log warning
    Continue operation

    │
    ├─ Permission denied
    ├─ Disk full
    │
    ▼
    Log error
    Return error response
    Graceful failure
```

**Error Strategy:**
1. Try operation
2. Catch specific errors
3. Log with structured logger
4. Return user-friendly message
5. Fallback to safe defaults
6. Never crash the app

## Performance Optimization

### 1. Debouncing
```
File Changes → Queue → Debounce 500ms → Process
             (many)    (collapse)      (once)

Benefits:
- Prevents excessive snapshots
- Reduces disk I/O
- Improves responsiveness
```

### 2. Lazy Loading
```
API Call → Check cache → Load if needed
                  ↓
            Return cached
```

### 3. Async Operations
```
User Request
     │
     ▼
Non-blocking operations
  ├─ Git commands (async)
  ├─ File I/O (async)
  └─ Index update (async)
     │
     ▼
Response (fast)
```

### 4. Index Caching
```
First Request → Build index → Cache
                    │
Subsequent → Use cache (no disk scan)
                    │
On change → Invalidate → Rebuild
```

## Security Model

```
┌─────────────────────────────────────────────┐
│         Security Boundaries                  │
└─────────────────────────────────────────────┘

Input Validation
     │
     ▼
┌─────────────────┐
│ Sanitize paths  │  - No traversal
│ Validate IDs    │  - Format check
│ Check existence │  - File exists?
└─────────────────┘
     │
     ▼
Safe Operations
     │
     ▼
┌─────────────────┐
│ Read-only git   │  - No mutations
│ Local filesystem│  - No network
│ No code exec    │  - No eval
└─────────────────┘
```

**Security Features:**
- ✅ Read-only git commands
- ✅ Path sanitization
- ✅ No code execution
- ✅ Local storage only
- ✅ Git-ignored by default

## Integration Points

```
┌─────────────────────────────────────────────┐
│         External Systems                     │
└─────────────────────────────────────────────┘
         │
    ┌────┴────┬────────┬─────────┐
    │         │        │         │
    ▼         ▼        ▼         ▼
┌───────┐ ┌───────┐ ┌────┐ ┌─────────┐
│  Git  │ │  PM2  │ │ FS │ │ Logger  │
└───────┘ └───────┘ └────┘ └─────────┘
    │         │        │         │
    ▼         ▼        ▼         ▼
Commands  Status   Read/Write Events
```

**Integrations:**
1. **Git** - Status, commits, branches
2. **PM2** - Application status
3. **Filesystem** - Read/write snapshots
4. **Logger** - Structured logging

---

## Design Principles

### 1. Single Responsibility
Each component has one clear purpose:
- FileWatcher → Monitor changes
- ContextGenerator → Build context
- Storage → Persist data
- MemoryBank → Orchestrate

### 2. Dependency Injection
Components receive dependencies, not create them:
```typescript
new MemoryBank(projectRoot)
  → new FileWatcher(projectRoot)
  → new ContextGenerator(projectRoot)
  → new Storage(projectRoot)
```

### 3. Event-Driven
File watcher uses events for loose coupling:
```typescript
watcher.on('changes', handleChanges);
watcher.on('error', handleError);
```

### 4. Fail-Safe
Operations continue even if optional features fail:
- Git unavailable → Use defaults
- PM2 not found → Skip status
- Disk full → Log error, continue

### 5. User-Centric
- Clear error messages
- Progress indicators
- Beautiful output
- Helpful defaults

---

*Memory Bank System Architecture v1.0.0*
