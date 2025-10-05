
# GitHub Update Script - Local Configuration Support

## Overview

The `update_from_github.sh` script now fully supports the local configuration system, automatically preserving your settings during updates.

## What the Script Does

### 1. **Automatic Backup** 💾

Before pulling from GitHub, the script backs up:
- All local configuration files (`config/*.local.json`)
- Environment variables (`.env`)
- Database (`prisma/dev.db`)

**Backup location:** `~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz`

**Retention:** Keeps last 7 backups automatically

### 2. **Safe GitHub Pull** ⬇️

```bash
git pull origin main
```

Your local files are automatically protected by `.gitignore`:
- `config/*.local.json` - Preserved ✅
- `.env` - Preserved ✅
- `prisma/dev.db` - Reset (intentional, data in gitignore) ✅
- `uploads/` - Cleaned (temp files) ✅

### 3. **Configuration Check** 🔧

After pulling, the script:

**If local config doesn't exist:**
- Runs `./scripts/init-local-config.sh`
- Creates config files from templates
- Prompts you to edit them

**If local config exists:**
- Confirms files are preserved ✅
- Checks for new template options
- Merges any new configuration fields

### 4. **Dependencies & Build** 📦

- Installs npm packages
- Checks/installs libCEC
- Sets up Ollama + AI models
- Updates database schema
- Builds the application

### 5. **Restart Application** 🚀

Restarts the server and verifies it's running.

## Usage

### Standard Update

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
```

That's it! Your local configuration is automatically:
- ✅ Backed up before update
- ✅ Preserved during git pull
- ✅ Validated after update
- ✅ Initialized if missing

## What Gets Updated

| Component | Updated | Preserved |
|-----------|---------|-----------|
| Application code | ✅ | - |
| Dependencies | ✅ | - |
| Templates (`*.template.json`) | ✅ | - |
| Documentation | ✅ | - |
| Local config (`*.local.json`) | - | ✅ |
| Environment (`.env`) | - | ✅ |
| Uploads directory | - | ✅ |

## First Time Running the Script

On first run, if you don't have local config files:

```
🔧 Checking local configuration...
📝 Local configuration not found. Initializing from templates...

✅ Created: config/local.local.json
✅ Created: config/devices.local.json
✅ Created: config/sports-teams.local.json

⚠️  IMPORTANT: Edit your local configuration files:
   nano config/local.local.json      # System settings
   nano config/devices.local.json    # Device inventory
   nano config/sports-teams.local.json   # Sports preferences

Press Enter to continue after you've reviewed the config files...
```

**Action required:** Edit the config files with your actual settings before continuing.

## Subsequent Runs

On subsequent runs with existing local config:

```
🔧 Checking local configuration...
✅ Local configuration files found and preserved
   Checking for new configuration options...
   ✅ Configuration is up to date
```

If new template options were added in the GitHub update:

```
✅ Local configuration files found and preserved
   Checking for new configuration options...
   ℹ️  New configuration options may have been added
```

The script will automatically merge new fields while preserving your existing values.

## Backup Management

### Automatic Backups

Every time you run `update_from_github.sh`, a backup is created:

```
💾 Backing up local configuration...
✅ Configuration backed up to: /home/ubuntu/sports-bar-backups/config-backup-20251001-143000.tar.gz
```

### Backup Location

```bash
~/sports-bar-backups/
├── config-backup-20251001-143000.tar.gz  (latest)
├── config-backup-20251001-120000.tar.gz
├── config-backup-20250930-180000.tar.gz
└── ... (up to 7 most recent)
```

### Restore from Backup

If you need to restore a backup:

```bash
# List available backups
ls -lh ~/sports-bar-backups/

# Restore a specific backup
cd /home/ubuntu/Sports-Bar-TV-Controller
tar -xzf ~/sports-bar-backups/config-backup-20251001-143000.tar.gz

# The backup contains:
# - config/*.local.json
# - .env
# - prisma/dev.db
```

### Manual Backup

Create a manual backup anytime:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
tar -czf ~/my-backup-$(date +%Y%m%d).tar.gz \
    config/*.local.json \
    .env \
    prisma/dev.db
```

## Configuration Files

### What's in Each Config

**`config/local.local.json`** - System settings
```json
{
  "system": { "name": "Your Bar", "timezone": "America/New_York" },
  "network": { "apiPort": 3000, "devPort": 3001 },
  "wolfpack": { "ip": "192.168.1.100", "port": 4999 },
  "features": { "aiAnalysis": true, "autoScheduling": true }
}
```

**`config/devices.local.json`** - Device inventory
```json
{
  "wolfpack": { "inputs": [...], "outputs": [...] },
  "directv": { "receivers": [...] },
  "firetv": { "devices": [...] },
  "globalCache": { "devices": [...] }
}
```

**`config/sports-teams.local.json`** - Sports preferences
```json
{
  "homeTeams": [...],
  "favoriteLeagues": ["NFL", "NBA", "MLB", "NHL"],
  "autoMonitor": true
}
```

### Editing Configuration

After any update, you can edit your local config:

```bash
# Edit system settings
nano config/local.local.json

# Edit device configuration
nano config/devices.local.json

# Edit sports teams
nano config/sports-teams.local.json

# Or use the web UI:
# Navigate to Settings pages in the app
```

## Success Message

After a successful update, you'll see:

```
✅ Update successful! Application is running on:
   🌐 http://localhost:3000
   🌐 http://192.168.1.50:3000

📋 What was updated:
   ✅ Application code from GitHub
   ✅ Dependencies installed
   ✅ libCEC support verified
   ✅ Local AI (Ollama) verified
   ✅ Database updated
   ✅ AI style analysis running in background

🔧 Configuration Status:
   ✅ Local configuration preserved (config/*.local.json)
   💾 Backup saved to: /home/ubuntu/sports-bar-backups/config-backup-20251001-143000.tar.gz
   📁 All backups in: /home/ubuntu/sports-bar-backups

🎨 Style Analysis:
   Check ai-style-reports/ for detailed component analysis
   Run './scripts/run-style-analysis.sh' for interactive tools

💡 Tip: Your local settings are safe during updates!
   Edit config: nano config/local.local.json
```

## Troubleshooting

### Configuration Not Preserved

If configuration seems to be lost:

1. **Check if backup exists:**
   ```bash
   ls -lh ~/sports-bar-backups/
   ```

2. **Restore from latest backup:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   tar -xzf ~/sports-bar-backups/config-backup-*.tar.gz
   ```

3. **Verify .gitignore:**
   ```bash
   cat .gitignore | grep "local.json"
   # Should show: config/*.local.json
   ```

### Script Fails During Update

If the script fails:

1. **Check backup was created:**
   ```bash
   ls -lh ~/sports-bar-backups/ | head -3
   ```
   Your config is safe!

2. **View the error:**
   ```bash
   # The script will show the error message
   # Check logs if needed
   tail -100 server.log
   ```

3. **Restore and retry:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   git stash  # Save any local changes
   ./update_from_github.sh  # Try again
   ```

### Configuration Validation

Verify your config files are valid:

```bash
# Check JSON syntax
cat config/local.local.json | jq .
cat config/devices.local.json | jq .
cat config/sports-teams.local.json | jq .

# If jq not installed:
sudo apt install jq
```

## Advanced Usage

### Skip Configuration Prompt

For automated deployments, set an environment variable:

```bash
export SKIP_CONFIG_PROMPT=1
./update_from_github.sh
```

### Custom Backup Location

```bash
export BACKUP_DIR="/custom/backup/path"
./update_from_github.sh
```

### Dry Run (Check Only)

To see what would be updated without making changes:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git fetch origin main
git diff HEAD origin/main --stat
```

## Multiple Locations

If you manage multiple installations:

### Location 1 (Downtown Bar)
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
# Uses: config/local.local.json (Downtown settings)
```

### Location 2 (Westside Bar)
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
# Uses: config/local.local.json (Westside settings)
```

Each location maintains its own local config, but shares the same codebase from GitHub.

## Summary

✅ **Automatic backup** before every update
✅ **Preserves local settings** during git pull
✅ **Initializes config** if missing
✅ **Merges new options** from templates
✅ **Keeps 7 recent backups** automatically
✅ **Safe to run anytime** - your settings are protected

**Update fearlessly!** Your local configuration is always safe.

---

**Related Documentation:**
- `LOCAL_CONFIG_SYSTEM.md` - Complete configuration guide
- `CONFIG_DEMO.md` - Visual walkthrough
- `config/README.md` - Configuration reference
- `RECENT_UPDATES.md` - Latest changes

**Last Updated:** October 1, 2025
