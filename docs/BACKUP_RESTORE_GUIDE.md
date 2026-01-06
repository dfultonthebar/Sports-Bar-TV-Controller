# Sports Bar TV Controller - Backup & Restore Guide

## Overview

The update script automatically backs up all your configurations and data before each update. This ensures your settings are safe and can be restored if needed.

## What Gets Backed Up

### Database (prisma/dev.db)
All configuration data is stored in a SQLite database, including:

**Matrix/Video Configuration:**
- MatrixConfiguration - Wolfpack matrix IP, port, and connection settings
- MatrixInput - Input channel labels and configurations (Cable Box 1, DirecTV, etc.)
- MatrixOutput - TV/output labels and settings (Main Bar TV, Patio TV, etc.)
- MatrixRoute - Current routing configurations
- MatrixScene - Saved routing scenes
- WolfpackMatrixRouting - Wolfpack-to-Atlas routing mappings
- WolfpackMatrixState - Current routing state

**Audio Configuration:**
- AudioProcessor - AZMP8 audio processor settings (IP, zones, etc.)
- AudioZone - Audio zone configurations and current settings
- AudioScene - Saved audio scenes
- AudioMessage - Audio message configurations
- AudioInputMeter - Input meter settings and thresholds
- AIGainConfiguration - AI-powered gain control settings

**TV & Device Configuration:**
- CECConfiguration - HDMI-CEC settings for TV control
- TVProvider - Cable/Satellite provider information
- ProviderInput - Provider-to-input channel mappings

**Sports & Entertainment:**
- HomeTeam - Your favorite sports teams
- SportsGuideConfiguration - Sports guide settings (zip code, timezone)
- NFHSSchool - High school sports data
- NFHSGame - Game schedules
- SelectedLeague - Active sports leagues

**Music & Audio:**
- SoundtrackConfig - Soundtrack Your Brand API credentials
- SoundtrackPlayer - Soundtrack player configurations

**Automation:**
- Schedule - Automated schedules (morning setup, game day, etc.)
- ScheduleLog - Schedule execution history

**System:**
- User - User accounts and permissions
- ApiKey - AI API keys (Grok, Claude, ChatGPT, Local AI)
- Equipment - Equipment inventory
- Document - Uploaded documents and manuals

### Configuration Files
- `config/*.local.json` - System, device, and sports team settings
- `.env` - API keys and environment variables
- `data/*.json` - Subscriptions, credentials, device configurations
- `data/scene-logs/` - Scene execution logs
- `data/atlas-configs/` - Atlas matrix configuration files

## Backup Location

All backups are stored in: `~/sports-bar-backups/`

### Backup Files
- **Configuration Backups:** `config-backup-YYYYMMDD-HHMMSS.tar.gz`
  - Contains all config files, .env, database, and data files
  - Compressed for efficient storage
  
- **SQL Dumps:** `database-backups/dev-db-YYYYMMDD-HHMMSS.sql.gz`
  - SQL dump of the database for maximum portability
  - Can be restored to any SQLite database
  
- **Manifests:** `backup-manifest-YYYYMMDD-HHMMSS.txt`
  - Detailed list of what was backed up
  - Includes file sizes and restore instructions

### Retention Policy
- **Configuration backups:** Last 7 backups kept
- **SQL dumps:** Last 10 dumps kept
- Older backups are automatically deleted to save space

## Backup Schedule

Backups are created automatically:
1. **Before every update** - When you run `./update_from_github.sh`
2. **Before database migrations** - When schema changes are applied

## How to Restore

### Method 1: Full Restore from Tar Backup (Recommended)

This restores everything: database, config files, and data files.

```bash
# 1. Stop the application
pm2 stop sports-bar-tv-controller

# 2. Navigate to project directory
cd /home/ubuntu/Sports-Bar-TV-Controller

# 3. List available backups
ls -lh ~/sports-bar-backups/config-backup-*.tar.gz

# 4. Extract the backup (replace TIMESTAMP with your backup date/time)
tar -xzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz

# 5. Restart the application
pm2 restart sports-bar-tv-controller

# 6. Verify everything is working
pm2 logs sports-bar-tv-controller
```

### Method 2: Database-Only Restore from SQL Dump

This restores only the database from a SQL dump.

```bash
# 1. Stop the application
pm2 stop sports-bar-tv-controller

# 2. Navigate to project directory
cd /home/ubuntu/Sports-Bar-TV-Controller

# 3. Backup current database (just in case)
cp prisma/dev.db prisma/dev.db.before-restore

# 4. Restore from SQL dump (replace TIMESTAMP)
gunzip -c ~/sports-bar-backups/database-backups/dev-db-YYYYMMDD-HHMMSS.sql.gz | sqlite3 prisma/dev.db

# 5. Restart the application
pm2 restart sports-bar-tv-controller

# 6. Verify
pm2 logs sports-bar-tv-controller
```

### Method 3: Selective Restore

Restore only specific files from a backup.

```bash
# List contents of a backup
tar -tzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz

# Extract only specific files (example: just .env)
tar -xzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz .env

# Extract only config files
tar -xzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz config/

# Extract only database
tar -xzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz prisma/dev.db
```

## Manual Backup

You can create a manual backup anytime:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
tar -czf ~/sports-bar-backups/manual-backup-$TIMESTAMP.tar.gz \
    config/*.local.json \
    .env \
    prisma/dev.db \
    data/*.json \
    data/scene-logs/ \
    data/atlas-configs/

# Create SQL dump
sqlite3 prisma/dev.db .dump | gzip > ~/sports-bar-backups/database-backups/manual-db-$TIMESTAMP.sql.gz

echo "Manual backup created: ~/sports-bar-backups/manual-backup-$TIMESTAMP.tar.gz"
```

## Backup Verification

To verify a backup is valid:

```bash
# Test tar backup integrity
tar -tzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz > /dev/null && echo "Backup is valid" || echo "Backup is corrupted"

# List contents
tar -tzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz

# Test SQL dump
gunzip -c ~/sports-bar-backups/database-backups/dev-db-YYYYMMDD-HHMMSS.sql.gz | head -20
```

## Troubleshooting

### Backup Failed During Update
If backup fails, the update script will stop and preserve your current state. Check the logs:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/update.log
```

### Restore Didn't Work
1. Check if the backup file exists and is not corrupted
2. Make sure you stopped the application before restoring
3. Check file permissions: `ls -la prisma/dev.db`
4. Try restoring from SQL dump instead of tar backup

### Database Corruption
If the database is corrupted:
1. Stop the application
2. Restore from the most recent SQL dump
3. If that fails, restore from the previous backup
4. Check PM2 logs for errors: `pm2 logs sports-bar-tv-controller`

### Missing Configuration After Restore
If some settings are missing after restore:
1. Check the backup manifest to see what was included
2. Verify you extracted all files from the tar backup
3. Check if .env file was restored: `ls -la .env`
4. Verify config files: `ls -la config/*.local.json`

## Best Practices

1. **Before Major Changes:** Create a manual backup before making significant configuration changes
2. **Test Restores:** Periodically test restoring from backups to ensure they work
3. **Keep External Backups:** Copy important backups to another location (USB drive, cloud storage)
4. **Document Custom Settings:** Keep notes about your specific configuration
5. **Check Backup Size:** Monitor backup sizes to ensure they're capturing all data

## What's NOT Backed Up

The following are intentionally excluded from backups:
- `node_modules/` - Dependencies (reinstalled during updates)
- `.next/` - Build artifacts (regenerated during updates)
- `uploads/` - User uploaded files (add to manual backup if needed)
- Log files - Temporary logs (not needed for restore)

## Emergency Recovery

If you need to completely rebuild from scratch:

1. **Save your backups:**
   ```bash
   cp -r ~/sports-bar-backups ~/sports-bar-backups-SAFE
   ```

2. **Fresh install:**
   ```bash
   cd /home/ubuntu
   git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
   cd Sports-Bar-TV-Controller
   ```

3. **Restore from backup:**
   ```bash
   tar -xzf ~/sports-bar-backups-SAFE/config-backup-LATEST.tar.gz
   ```

4. **Run update script:**
   ```bash
   ./update_from_github.sh
   ```

## Support

If you need help with backups or restores:
1. Check the update log: `cat /home/ubuntu/Sports-Bar-TV-Controller/update.log`
2. Check PM2 logs: `pm2 logs sports-bar-tv-controller`
3. Review the backup manifest for details about what was backed up
4. Contact support with the backup manifest and error logs

---

**Remember:** Your configurations are valuable! The automatic backup system protects them, but it's always good to keep an extra copy of critical backups in a safe location.
