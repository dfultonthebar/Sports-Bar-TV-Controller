
# Configuration Directory

This directory contains configuration files for the Sports Bar Control System.

## File Types

### Template Files (`*.template.json`)
- **Tracked in Git**: YES ✅
- **Purpose**: Provide default configuration structure
- **When to edit**: When adding new configuration options for all installations
- **Safe to modify**: Only commit changes that apply to all systems

### Local Files (`*.local.json`)
- **Tracked in Git**: NO ❌ (gitignored)
- **Purpose**: Store system-specific configuration
- **When to edit**: To customize settings for your specific installation
- **Safe from updates**: Won't be overwritten by `git pull`

### Shared Files (`*.json` without .local or .template)
- **Tracked in Git**: YES ✅
- **Purpose**: Configuration that's common across systems
- **When to edit**: For settings that should be synchronized across all installations

## Configuration Files

### `local.local.json`
System-specific settings for your installation:
- Network configuration (ports, IPs)
- Device connections
- Feature toggles
- Logging preferences
- Backup settings

**Initialize from template:**
```bash
./scripts/init-local-config.sh
```

### `devices.local.json`
Your specific device inventory:
- Wolfpack matrix I/O configuration
- Global Cache IR devices
- DirecTV receivers
- Fire TV devices
- CEC-enabled TVs
- Custom devices

### `sports-teams.local.json`
Your bar's preferred teams and sports:
- Home teams to monitor
- Favorite leagues
- Auto-monitoring preferences
- Notification settings

### `auto-sync.json` (shared)
GitHub auto-sync configuration:
- Repository URL
- Sync schedule
- Files to exclude from sync
- Pre/post sync hooks

## Setup Instructions

### First-Time Setup

1. **Initialize local configuration:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   ./scripts/init-local-config.sh
   ```

2. **Edit your local config files:**
   ```bash
   nano config/local.local.json     # System settings
   nano config/devices.local.json   # Device inventory
   nano config/sports-teams.local.json  # Sports preferences
   ```

3. **Configure devices through the web UI:**
   - Navigate to Settings → Matrix Control
   - Add/edit your Wolfpack I/O configuration
   - Settings are saved to `devices.local.json`

### After GitHub Updates

Your local configuration is **automatically preserved** during git updates:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull origin main
```

Local files (`.local.json`) are gitignored, so they won't be overwritten.

If new configuration options are added:
1. Check if new `*.template.json` files exist
2. Run `./scripts/init-local-config.sh` to merge new options
3. Review and update your `.local.json` files

## Configuration Priority

The application loads configuration in this order:

1. **Template defaults** (`*.template.json`)
2. **Local overrides** (`*.local.json`)
3. **Environment variables** (`.env`)
4. **Database settings** (runtime configurations)

Later sources override earlier ones.

## Best Practices

### ✅ DO:
- Edit `.local.json` files for system-specific settings
- Keep `.template.json` files as reference
- Commit changes to `.template.json` that benefit all installations
- Run `init-local-config.sh` after pulling updates
- Document custom configuration in this README

### ❌ DON'T:
- Commit `.local.json` files to git
- Store sensitive credentials in config files (use `.env` instead)
- Modify `.template.json` with system-specific values
- Delete template files

## Environment Variables

Sensitive configuration should be in `.env` (also gitignored):

```bash
# .env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-secret-here"

# API Keys (if needed)
CLAUDE_API_KEY="sk-..."
OPENAI_API_KEY="sk-..."
GROK_API_KEY="xai-..."

# External Services
SPECTRUM_API_KEY="your-spectrum-key"
GRACENOTE_API_KEY="your-gracenote-key"
```

## Backup Your Configuration

Local configuration is precious! Back it up regularly:

```bash
# Manual backup
tar -czf ~/config-backup-$(date +%Y%m%d).tar.gz config/*.local.json .env

# Automated backup (runs nightly if enabled in local.local.json)
# Backups stored in: /home/ubuntu/Sports-Bar-TV-Controller/backups/
```

## Troubleshooting

### Lost Configuration After Update?

If you accidentally committed `.local.json` files:

```bash
# Remove from git tracking (keeps local files)
git rm --cached config/*.local.json
git commit -m "Remove local config from tracking"
git push
```

### Missing Configuration Options?

If new features require configuration:

```bash
# Re-run initialization to merge new options
./scripts/init-local-config.sh

# Compare with template
diff config/local.template.json config/local.local.json
```

### Configuration Not Loading?

Check the application logs:

```bash
# View config loading
pm2 logs sports-bar-app --lines 100 | grep -i config

# Validate JSON syntax
cat config/local.local.json | jq .
```

## Support

For configuration help:
- Check the main README: `/home/ubuntu/Sports-Bar-TV-Controller/README.md`
- View documentation: PDFs in the project root
- Open an issue on GitHub

---

**Last Updated:** October 1, 2025
**Version:** 1.0.0
