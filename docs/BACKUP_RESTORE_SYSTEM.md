
# Backup & Restore System

## Overview

The Sports Bar AI Assistant now includes a comprehensive backup and restore system with automatic and manual backup capabilities. The system also automatically names configuration files based on your matrix configuration name for easier identification.

## Features

### 1. Automatic Backups

**Backup on System Update**
- Every time you run `./update_from_github.sh`, a backup is automatically created
- Backup is created BEFORE pulling any changes from GitHub
- Ensures your configuration is safe even if something goes wrong

**What Gets Backed Up:**
- Configuration files (`config/*.local.json`)
- Environment variables (`.env`)
- Database with all your data (`prisma/dev.db`)
  - Matrix configurations
  - Device settings (DirecTV, FireTV, Cable boxes)
  - Input/output mappings and scenes
  - Audio zones and settings
  - Sports guide configuration
  - AI API keys
  - Soundtrack credentials
- Data files (`data/*.json`)
  - Streaming service credentials
  - Device subscriptions
  - Scene logs
  - Atlas audio configs
- User uploads

**Backup Retention:**
- Keeps the last 10 backups automatically
- Older backups are automatically deleted
- Backups are stored in `~/sports-bar-backups/`

### 2. Manual Backup & Restore Interface

**Access:** Navigate to the **Backup & Restore** page from the main menu

**Features:**
- **Create Backup:** One-click backup of current configuration
- **View Recent Backups:** See the last 6 backups with:
  - Timestamp
  - File size
  - Filename
- **Restore Backup:** Restore any previous backup
  - Safety backup created automatically before restore
  - Preserves current state before applying old backup
- **Delete Backup:** Remove old backups you no longer need

### 3. Matrix Configuration-Based Naming

**Automatic Config File Naming:**
- Configuration files are now automatically named based on your matrix configuration name
- Example: If your matrix is named "Wolfpack Controller", the config file becomes `wolfpack-controller.local.json`
- Makes it easy to identify which system a backup belongs to
- Automatic renaming happens during system updates

**Benefits:**
- Easy identification in multi-system setups
- Prevents confusion when managing multiple locations
- Backup files clearly show which system they belong to

## How to Use

### Access Backup & Restore Page

1. Open the Sports Bar AI Assistant (http://localhost:3000)
2. Click on **💾 Backup & Restore** in the Configuration section
3. You'll see:
   - Option to create a new backup
   - List of recent backups
   - Restore and delete options for each backup

### Create a Manual Backup

1. Go to Backup & Restore page
2. Click **Create Backup**
3. Wait for confirmation
4. New backup appears in the list

### Restore from a Backup

1. Go to Backup & Restore page
2. Find the backup you want to restore
3. Click **Restore** button
4. Confirm the restoration
5. A safety backup is created automatically
6. Your system is restored to that backup state
7. **Restart the application** for changes to take effect:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   pm2 restart sports-bar
   ```

### Delete a Backup

1. Go to Backup & Restore page
2. Find the backup you want to delete
3. Click **Delete** button
4. Confirm deletion
5. Backup is permanently removed

## Technical Details

### Backup Location
```
~/sports-bar-backups/
├── config-backup-20250101-120000.tar.gz
├── config-backup-20250101-180000.tar.gz
├── pre-restore-1234567890.tar.gz  (safety backups)
└── ...
```

### Backup Filename Format
```
config-backup-YYYYMMDD-HHMMSS.tar.gz

Example: config-backup-20250101-120000.tar.gz
         └─ January 1, 2025 at 12:00:00
```

### Configuration File Naming
```
<matrix-name>.local.json

Examples:
- Wolfpack Controller → wolfpack-controller.local.json
- Main Bar System → main-bar-system.local.json
- Default → local.local.json (if no matrix config exists)
```

### API Endpoints

**GET /api/backup**
- Lists all available backups
- Returns backup metadata (filename, size, timestamp)

**POST /api/backup**
- Creates a new backup
- Restores from a backup
- Deletes a backup

**GET /api/matrix-config**
- Returns current matrix configuration name
- Provides the expected config filename

### Scripts

**`scripts/rename-config-file.js`**
- Renames config file based on matrix configuration
- Runs automatically during system updates
- Updates .gitignore if needed

**`scripts/get-config-filename.js`**
- Returns the current config filename
- Used by backup scripts to know which file to backup

## Automatic Backup During Updates

When you run `./update_from_github.sh`:

1. ✅ Backup is created automatically
2. ✅ Configuration file is checked/renamed based on matrix name
3. ✅ Code is pulled from GitHub
4. ✅ Dependencies are installed
5. ✅ Database is updated (your data is preserved)
6. ✅ Application is built and restarted

**Your data is ALWAYS safe during updates!**

## Safety Features

1. **Pre-Update Backup:** Automatic backup before GitHub pull
2. **Pre-Restore Safety Backup:** Automatic backup before restoring
3. **Backup Verification:** System verifies backup files exist before operations
4. **Atomic Operations:** Restore operations are atomic (all-or-nothing)
5. **Backup Retention:** Automatic cleanup of old backups (keeps last 10)
6. **Error Handling:** Graceful error handling with clear messages

## Troubleshooting

### Backup Failed to Create
- Check disk space: `df -h`
- Check permissions: `ls -la ~/sports-bar-backups/`
- Check error message in the UI

### Restore Failed
- Verify backup file exists
- Check error message in the UI
- Safety backup was created - you can restore from it

### Config File Not Renamed
- Check if matrix configuration exists in database
- Run manually: `cd /home/ubuntu/Sports-Bar-TV-Controller && node scripts/rename-config-file.js`
- System will use `local.local.json` as fallback

### Cannot Access Backup Page
- Make sure application is running
- Check server logs: `pm2 logs sports-bar`
- Verify you're accessing the correct URL

## Best Practices

1. **Regular Backups:** Create manual backups before major changes
2. **Test Restores:** Occasionally test restoring from a backup
3. **Monitor Disk Space:** Backups consume disk space
4. **Document Changes:** Note what changed in each backup period
5. **Keep Important Backups:** Download critical backups to another location

## Manual Backup & Restore (Command Line)

### Create Manual Backup
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
tar -czf ~/sports-bar-backups/manual-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  config/*.local.json \
  .env \
  prisma/dev.db \
  data/*.json \
  data/scene-logs/ \
  data/atlas-configs/
```

### Restore Manual Backup
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
tar -xzf ~/sports-bar-backups/backup-filename.tar.gz
pm2 restart sports-bar
```

### List All Backups
```bash
ls -lh ~/sports-bar-backups/
```

## Recovery from Catastrophic Failure

If the entire system fails:

1. **Reinstall the application** using the install script
2. **Restore from backup:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   tar -xzf ~/sports-bar-backups/latest-backup.tar.gz
   npm install
   npx prisma generate
   pm2 restart sports-bar
   ```
3. **Verify restoration:**
   - Check that all devices are configured
   - Verify API keys are present
   - Test matrix control
   - Test audio zones

## Support

If you encounter any issues with the backup system:

1. Check the error message in the UI
2. Check server logs: `pm2 logs sports-bar`
3. Check backup directory: `ls -la ~/sports-bar-backups/`
4. Verify disk space: `df -h`
5. Contact support with:
   - Error message
   - Server logs
   - Steps to reproduce the issue

---

**Remember:** Your configuration is automatically backed up during every system update. The backup system runs independently of the update process, ensuring your data is always safe!
