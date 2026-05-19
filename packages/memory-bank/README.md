# @sports-bar/memory-bank

**Purpose:** Project-state snapshot system for operator session recovery — captures git status, modified files, system state so an operator can resume after an SSH session drops. Powered by `chokidar` file-watching.

**Key exports** (`src/index.ts`):
- `MemoryBank` class — main service with `createSnapshot()`, auto-snapshot on N file changes
- `FileWatcher`, `getFileWatcher`, `stopFileWatcher` — chokidar-backed watcher with debounced change events (`src/file-watcher.ts`)
- `ContextGenerator`, `getContextGenerator` — collects git + filesystem + system context (`src/context-generator.ts`)
- `MemoryBankStorage`, `getStorage` — on-disk snapshot index (`src/storage.ts`)
- Types: `FileChangeEvent`, `WatcherOptions`, `ProjectContext`, `ContextSnapshot`, `MemoryBankIndex`

**Protocol / port:** N/A — local filesystem + git.

**Used by:** `apps/web` `/api/memory-bank/*` routes; CLI commands `npm run memory:snapshot`, `memory:restore`, `memory:list`.

**Gotchas:**
- Auto-snapshot threshold defaults to 10 file changes (`snapshotThreshold` in the `MemoryBank` constructor).
- Snapshots are **per-host** — they're an operator tool, not synced across machines.
- This is **one of three memory systems** in the project (the other two: Claude auto-memory and CLAUDE.md itself). See `docs/CLAUDE_MEMORY_GUIDE.md` for how the three relate.

**See also:**
- `docs/CLAUDE_MEMORY_GUIDE.md` (full memory-systems guide)
- CLAUDE.md §6 (Memory Bank System)
