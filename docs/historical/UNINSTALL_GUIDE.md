# Uninstall and Reinstall Guide

This guide covers how to uninstall and reinstall the Sports Bar TV Controller application.

## Table of Contents

- [Uninstall Options](#uninstall-options)
- [Quick Uninstall](#quick-uninstall)
- [Interactive Uninstall](#interactive-uninstall)
- [Selective Uninstall](#selective-uninstall)
- [Backup Before Uninstall](#backup-before-uninstall)
- [Reinstall](#reinstall)
- [Troubleshooting](#troubleshooting)

## Uninstall Options

The uninstall script provides several options for removing the application:

### Command Line Flags

- `--yes, -y` - Non-interactive mode (auto-confirm all prompts)
- `--keep-nodejs` - Keep Node.js and npm installed
- `--keep-ollama` - Keep Ollama and all models installed
- `--backup, -b` - Backup database and configuration before removal
- `--dry-run` - Show what would be removed without actually removing
- `--help, -h` - Show help message

## Quick Uninstall

### Remove Everything (Interactive)

```bash
cd ~/Sports-Bar-TV-Controller
./uninstall.sh
```

This will:
1. Ask for confirmation before each major step
2. Stop all services (PM2, systemd, Ollama)
3. Remove the application directory
4. Remove database files
5. Remove logs and temporary files
6. Ask if you want to remove Node.js
7. Ask if you want to remove Ollama and models
8. Clean up system files

### Remove Everything (Non-Interactive)

```bash
cd ~/Sports-Bar-TV-Controller
./uninstall.sh --yes
```

This will remove everything without prompting for confirmation.

### One-Line Uninstall from GitHub

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/uninstall.sh | bash
```

## Interactive Uninstall

The interactive mode asks for confirmation at each step:

```bash
./uninstall.sh
```

Example interaction:
```
========================================
Sports Bar TV Controller - Uninstall
========================================

Installation directory: /home/user/Sports-Bar-TV-Controller
Service user: user
Log file: /tmp/sportsbar-uninstall-20241007-123456.log

⚠ This will remove the Sports Bar TV Controller application.
Do you want to continue? [y/N]: y

========================================
Stopping Services
========================================

ℹ Stopping PM2 processes...
✓ PM2 processes stopped

========================================
Removing Application
========================================

⚠ This will remove the application directory: /home/user/Sports-Bar-TV-Controller
Are you sure you want to continue? [y/N]: y

ℹ Removing application directory...
✓ Application directory removed

========================================
Removing Node.js
========================================

Remove Node.js and npm? [y/N]: n
ℹ Keeping Node.js

========================================
Removing Ollama
========================================

Remove Ollama and all models? [y/N]: n
ℹ Keeping Ollama
```

## Selective Uninstall

### Keep Dependencies

Remove only the application but keep Node.js and Ollama:

```bash
./uninstall.sh --yes --keep-nodejs --keep-ollama
```

### Keep Node.js Only

Remove application and Ollama but keep Node.js:

```bash
./uninstall.sh --yes --keep-nodejs
```

### Keep Ollama Only

Remove application and Node.js but keep Ollama:

```bash
./uninstall.sh --yes --keep-ollama
```

## Backup Before Uninstall

### Create Backup

```bash
./uninstall.sh --backup --yes
```

This will:
1. Create a backup directory: `~/sportsbar-backup-YYYYMMDD-HHMMSS/`
2. Backup the database: `sports_bar.db`
3. Backup the `.env` file
4. Backup the knowledge base directory
5. Backup logs
6. Then proceed with uninstall

### Backup Location

Backups are saved to: `~/sportsbar-backup-YYYYMMDD-HHMMSS/`

Example:
```
~/sportsbar-backup-20241007-123456/
├── sports_bar.db
├── .env
├── knowledge-base/
└── logs/
```

### Restore from Backup

To restore from a backup after reinstalling:

```bash
# Reinstall the application
./install.sh

# Stop the application
pm2 stop sportsbar-assistant

# Restore database
cp ~/sportsbar-backup-20241007-123456/sports_bar.db ~/Sports-Bar-TV-Controller/prisma/data/

# Restore .env (if needed)
cp ~/sportsbar-backup-20241007-123456/.env ~/Sports-Bar-TV-Controller/

# Restore knowledge base (if needed)
cp -r ~/sportsbar-backup-20241007-123456/knowledge-base ~/Sports-Bar-TV-Controller/

# Restart the application
pm2 restart sportsbar-assistant
```

## Reinstall

### Quick Reinstall

The easiest way to reinstall is using the `--reinstall` flag:

```bash
# One-line reinstall from GitHub
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force

# Or if you have the script locally
./install.sh --reinstall --force
```

This will:
1. Download and run the uninstall script
2. Keep Node.js and Ollama (faster reinstall)
3. Remove the application and data
4. Install fresh copy of the application

### Reinstall with Backup

```bash
# Backup first, then reinstall
./uninstall.sh --backup --yes --keep-nodejs --keep-ollama
./install.sh

# Or use the reinstall flag (doesn't backup)
./install.sh --reinstall --force
```

### Complete Clean Reinstall

Remove everything including dependencies:

```bash
# Uninstall everything
./uninstall.sh --yes

# Reinstall from scratch
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

## Dry Run Mode

Test what would be removed without actually removing anything:

```bash
./uninstall.sh --dry-run
```

Example output:
```
========================================
Sports Bar TV Controller - Uninstall
========================================

⚠ DRY RUN MODE - No changes will be made

========================================
Stopping Services
========================================

ℹ [DRY RUN] Would execute: Stop PM2 processes
ℹ [DRY RUN] Would execute: Delete PM2 processes
ℹ [DRY RUN] Would execute: Stop systemd service

========================================
Removing Application
========================================

ℹ [DRY RUN] Would execute: Remove application directory

...
```

## What Gets Removed

### Application Files
- Installation directory (default: `~/Sports-Bar-TV-Controller`)
- Database files (`sports_bar.db`)
- Knowledge base directory
- Logs and temporary files

### System Files
- Systemd service file (`/etc/systemd/system/sportsbar-assistant.service`)
- PM2 configuration (`~/.pm2/`)
- PM2 logs

### Dependencies (Optional)
- Node.js and npm (if `--keep-nodejs` not specified)
- Ollama and all models (if `--keep-ollama` not specified)
- Service user (for system-wide installations)

### What's NOT Removed
- System packages (curl, wget, git, etc.)
- Other Node.js applications
- Other Ollama models (if you have multiple installations)

## Troubleshooting

### Uninstall Script Not Found

If the uninstall script is not in your installation directory:

```bash
# Download it directly
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/uninstall.sh -o uninstall.sh
chmod +x uninstall.sh
./uninstall.sh
```

### Permission Denied

If you get permission errors:

```bash
# Make script executable
chmod +x uninstall.sh

# Run with sudo if needed (for system-wide installations)
sudo ./uninstall.sh
```

### PM2 Processes Won't Stop

```bash
# Force stop all PM2 processes
pm2 kill

# Then run uninstall
./uninstall.sh
```

### Ollama Service Won't Stop

```bash
# Force stop Ollama
sudo systemctl stop ollama
sudo systemctl disable ollama

# Then run uninstall
./uninstall.sh
```

### Database File Locked

```bash
# Stop all processes first
pm2 stop all
sudo systemctl stop sportsbar-assistant

# Then run uninstall
./uninstall.sh
```

### Partial Uninstall

If uninstall was interrupted, you can:

1. Run the uninstall script again
2. Manually remove remaining files:

```bash
# Remove application directory
rm -rf ~/Sports-Bar-TV-Controller

# Remove PM2 configuration
rm -rf ~/.pm2

# Remove systemd service
sudo rm -f /etc/systemd/system/sportsbar-assistant.service
sudo systemctl daemon-reload

# Remove logs
rm -f /tmp/sportsbar-*
```

### Reinstall Fails

If reinstall fails:

1. Check the log file: `/tmp/sportsbar-install-YYYYMMDD-HHMMSS.log`
2. Ensure all services are stopped:
   ```bash
   pm2 stop all
   pm2 delete all
   ```
3. Remove the installation directory manually:
   ```bash
   rm -rf ~/Sports-Bar-TV-Controller
   ```
4. Try installing again:
   ```bash
   ./install.sh
   ```

## Environment Variables

You can customize the uninstall behavior with environment variables:

```bash
# Custom installation directory
INSTALL_DIR=/opt/sportsbar ./uninstall.sh

# Custom service user (for system-wide installations)
SERVICE_USER=myuser ./uninstall.sh
```

## Log Files

Uninstall logs are saved to: `/tmp/sportsbar-uninstall-YYYYMMDD-HHMMSS.log`

View the log:
```bash
cat /tmp/sportsbar-uninstall-*.log
```

## Support

If you encounter issues:

1. Check the log file for detailed error messages
2. Run with `--dry-run` to see what would be removed
3. Try interactive mode to control each step
4. Create a backup before uninstalling
5. Report issues on GitHub: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues

## Examples

### Example 1: Quick Reinstall (Keep Dependencies)
```bash
./install.sh --reinstall --force
```

### Example 2: Complete Clean Reinstall
```bash
./uninstall.sh --yes
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

### Example 3: Backup and Reinstall
```bash
./uninstall.sh --backup --yes --keep-nodejs --keep-ollama
./install.sh
# Restore backup if needed
cp ~/sportsbar-backup-*/sports_bar.db ~/Sports-Bar-TV-Controller/prisma/data/
pm2 restart sportsbar-assistant
```

### Example 4: Test Uninstall (Dry Run)
```bash
./uninstall.sh --dry-run
```

### Example 5: Remove Only Application
```bash
./uninstall.sh --yes --keep-nodejs --keep-ollama
```
