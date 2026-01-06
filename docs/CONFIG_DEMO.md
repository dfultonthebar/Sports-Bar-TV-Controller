# Local Configuration System - Visual Guide

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    GITHUB REPOSITORY                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ✅ Code (app/, components/, etc.)                   │   │
│  │  ✅ Templates (config/*.template.json)               │   │
│  │  ✅ Documentation                                     │   │
│  │  ✅ Scripts                                          │   │
│  │  ❌ Local configs (*.local.json) - GITIGNORED       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ git clone / git pull
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   YOUR LOCAL SYSTEM                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Sports-Bar-TV-Controller/                            │   │
│  │  ├── app/ (from GitHub)                              │   │
│  │  ├── components/ (from GitHub)                       │   │
│  │  ├── config/                                         │   │
│  │  │   ├── local.template.json (from GitHub)          │   │
│  │  │   ├── devices.template.json (from GitHub)        │   │
│  │  │   ├── local.local.json (YOUR DATA - preserved)   │   │
│  │  │   └── devices.local.json (YOUR DATA - preserved) │   │
│  │  └── scripts/                                        │   │
│  │      └── init-local-config.sh (from GitHub)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## File Flow

### Initial Setup

```
1. Clone Repository
   ├─> Downloads: Code + Templates
   └─> Does NOT download: *.local.json (don't exist yet)

2. Run: ./scripts/init-local-config.sh
   ├─> Reads: *.template.json
   └─> Creates: *.local.json (YOUR copy)

3. Edit your local files
   ├─> nano config/local.local.json
   ├─> Configure Wolfpack IP, ports, etc.
   └─> Settings saved locally
```

### During Git Pull

```
GitHub Update Available
       │
       │ git pull origin main
       ▼
┌─────────────────────────────┐
│ Downloads from GitHub:      │
├─────────────────────────────┤
│ ✅ Code updates             │
│ ✅ New features             │
│ ✅ Bug fixes                │
│ ✅ Template updates         │
│ ✅ Documentation            │
└─────────────────────────────┘
       │
       │ .gitignore prevents overwriting
       ▼
┌─────────────────────────────┐
│ YOUR Files Preserved:       │
├─────────────────────────────┤
│ ✅ config/*.local.json      │
│ ✅ .env                     │
│ ✅ prisma/*.db              │
│ ✅ uploads/                 │
└─────────────────────────────┘
```

## Example: Wolfpack Configuration

### Template (in GitHub)

```json
// config/local.template.json
{
  "wolfpack": {
    "ip": "192.168.1.100",     ← Default example
    "port": 4999,
    "protocol": "tcp",
    "enabled": true
  }
}
```

### Your Local Config (NOT in GitHub)

```json
// config/local.local.json
{
  "wolfpack": {
    "ip": "192.168.50.230",    ← YOUR actual Wolfpack IP
    "port": 4999,
    "protocol": "tcp",
    "enabled": true
  }
}
```

### What Happens During Git Pull

```
Before pull:
  config/local.local.json → { "ip": "192.168.50.230" } ← YOUR IP

GitHub has:
  config/local.template.json → { "ip": "192.168.1.100" } ← Example

After pull:
  config/local.template.json → { "ip": "192.168.1.100" } ← Updated from GitHub
  config/local.local.json → { "ip": "192.168.50.230" }    ← UNCHANGED! (gitignored)
```

## Multiple Locations

### Bar 1 (Downtown)

```json
// config/local.local.json
{
  "system": { "name": "Downtown Sports Bar" },
  "wolfpack": { "ip": "192.168.1.100" }
}
```

### Bar 2 (Westside)

```json
// config/local.local.json
{
  "system": { "name": "Westside Sports Bar" },
  "wolfpack": { "ip": "192.168.2.100" }
}
```

### Both Use Same Codebase

```
GitHub (shared) ──┬──> Bar 1 (local config #1)
                  │
                  └──> Bar 2 (local config #2)
```

## Testing the System

### Step 1: Verify Local Files Exist

```bash
$ ls -la config/*.local.json
-rw-r--r-- 1 ubuntu ubuntu 1288 Oct  1 05:27 config/local.local.json
-rw-r--r-- 1 ubuntu ubuntu  255 Oct  1 05:27 config/devices.local.json
-rw-r--r-- 1 ubuntu ubuntu  164 Oct  1 05:27 config/sports-teams.local.json
```

### Step 2: Verify NOT Tracked by Git

```bash
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

✅ Good! Local files exist but Git doesn't see them.

### Step 3: Make a Test Change

```bash
$ echo '// TEST CHANGE' >> config/local.local.json
$ cat config/local.local.json | tail -1
// TEST CHANGE
```

### Step 4: Pull from GitHub

```bash
$ git pull origin main
Already up to date.
```

### Step 5: Verify Change Still There

```bash
$ cat config/local.local.json | tail -1
// TEST CHANGE
```

✅ Success! Your local changes survived the git pull.

## Directory Structure

```
Sports-Bar-TV-Controller/
│
├── config/
│   │
│   ├── 📘 README.md (guide)
│   │
│   ├── TEMPLATES (tracked in Git)
│   │   ├── local.template.json
│   │   ├── devices.template.json
│   │   └── sports-teams.template.json
│   │
│   ├── LOCAL (gitignored, YOUR data)
│   │   ├── local.local.json
│   │   ├── devices.local.json
│   │   └── sports-teams.local.json
│   │
│   └── SHARED (tracked in Git)
│       └── auto-sync.json
│
├── scripts/
│   └── init-local-config.sh (setup script)
│
└── 📘 LOCAL_CONFIG_SYSTEM.md (full guide)
```

## Configuration Loading

```
Application Startup
       │
       ├─> 1. Load config/local.template.json (defaults)
       │
       ├─> 2. Load config/local.local.json (YOUR overrides)
       │      ├─> Merges with defaults
       │      └─> Your values take priority
       │
       ├─> 3. Load .env (secrets, API keys)
       │      └─> Overrides config files
       │
       └─> 4. Load database (runtime settings)
           └─> Overrides everything
```

## Quick Reference

### Commands

```bash
# Initialize local config (one time)
./scripts/init-local-config.sh

# Edit your settings
nano config/local.local.json

# Update from GitHub (safe!)
git pull origin main

# Verify local files
ls -la config/*.local.json

# Check git status (should be clean)
git status

# Backup your config
tar -czf ~/config-backup.tar.gz config/*.local.json .env
```

### File Types

| Extension | Tracked | Purpose | Edit? |
|-----------|---------|---------|-------|
| `.template.json` | ✅ Yes | Defaults | Rarely |
| `.local.json` | ❌ No | Your data | Yes |
| `.json` | ✅ Yes | Shared | Sometimes |

## Benefits

| Before | After |
|--------|-------|
| ⚠️ Manual backup before update | ✅ Automatic preservation |
| ⚠️ Risk of losing settings | ✅ Settings always safe |
| ⚠️ Reconfigure after update | ✅ No reconfiguration needed |
| ⚠️ Hard to manage multiple bars | ✅ Easy multi-location support |
| ⚠️ No clear config structure | ✅ Organized, documented system |

---

**Your configuration is now protected! 🛡️**

Update fearlessly with `git pull` - your settings are safe!
