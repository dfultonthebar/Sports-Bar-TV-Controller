
# 📦 Complete Backup Summary

## What's Backed Up Every Update

When you run `./update_from_github.sh`, this backup is automatically created:

```
~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz
```

## Complete Contents

### 🗄️ Database (prisma/dev.db)

**All your configurations and data:**

#### Atlas/Wolfpack Matrix
- ✅ Input configurations (cable boxes, DirecTV, FireTV, HDMI sources)
- ✅ Output configurations (TV assignments, names, locations)
- ✅ Route mappings (Input 1 → TV 3, TV 5, etc.)
- ✅ Scene presets ("Sunday NFL", "Monday Night", game day setups)
- ✅ Matrix connection settings (IP, ports, protocol)

#### Devices
- ✅ DirecTV receivers (IPs, names, channels, favorites)
- ✅ Fire TV devices (IPs, ports, installed apps)
- ✅ Cable boxes (configurations, channel maps)
- ✅ Global Cache devices (IR command databases)
- ✅ CEC-enabled TVs (addresses, capabilities, models)
- ✅ Custom devices you've added

#### Audio
- ✅ Audio processor settings (Atmosphere AZM4/AZM8)
- ✅ Zone configurations (names, volumes, sources, EQ)
- ✅ Audio scenes (saved presets for different events)
- ✅ Input level monitoring settings
- ✅ Audio routing configurations

#### AI & Services
- ✅ **AI API Keys** (encrypted)
  - Claude (Anthropic)
  - ChatGPT (OpenAI)
  - Grok (X.AI)
  - Local AI (Ollama)
- ✅ **Soundtrack Your Brand API**
  - API key/token
  - Account ID
  - Business name
  - Connection status

#### Sports & Content
- ✅ Sports guide configuration
- ✅ Favorite teams and leagues
- ✅ Auto-monitoring settings
- ✅ Channel favorites
- ✅ TV provider subscriptions
- ✅ Regional sports network access

#### System Data
- ✅ User accounts and permissions
- ✅ Equipment inventory
- ✅ Uploaded documents (layout PDFs, manuals)
- ✅ Chat session history
- ✅ System logs and events

### 📁 Data Files (data/*.json)

**All your credentials and device configurations:**

#### Streaming Credentials (data/streaming-credentials.json)
- ✅ NFHS Network login (username + encrypted password)
- ✅ ESPN+ credentials
- ✅ Other streaming service logins
- ✅ Authentication tokens
- ✅ Last sync timestamps

#### Device Subscriptions (data/device-subscriptions.json)
- ✅ DirecTV packages and add-ons
  - DIRECTV CHOICE™
  - Sports Pack
  - NFL Sunday Ticket
  - NBA League Pass
  - NHL Center Ice
  - MLB Extra Innings
- ✅ Cable/Spectrum subscriptions
  - Basic packages
  - Sports tiers
  - Premium channels
  - Regional sports networks
- ✅ Streaming subscriptions
  - ESPN+
  - Paramount+
  - Peacock Premium
  - YouTube TV
  - FuboTV
  - DAZN
- ✅ Cost tracking
- ✅ Status monitoring

#### Device Configurations
- ✅ **DirecTV devices** (data/directv-devices.json)
  - Device IDs and names
  - IP addresses
  - Channel lineups
  - Favorites
- ✅ **FireTV devices** (data/firetv-devices.json)
  - Device IDs and names
  - IP addresses and ports
  - Installed apps
  - ADB settings
- ✅ **IR devices** (data/ir-devices.json)
  - Device types and models
  - IR code databases
  - Command mappings
  - Custom codes
- ✅ **TV layout** (data/tv-layout.json)
  - Physical layout configuration
  - TV positions and zones
  - Viewing angles
  - Bar floor plan mappings

#### Logs & Presets
- ✅ **Scene logs** (data/scene-logs/)
  - Scene activation history
  - Performance logs
  - Error tracking
- ✅ **Atlas configs** (data/atlas-configs/)
  - Saved matrix configurations
  - Custom routing presets
  - Backup configurations

### 🔧 Configuration Files (config/*.local.json)

**All your system settings:**

#### local.local.json
- ✅ Bar name and location
- ✅ Timezone
- ✅ Network configuration (ports, hosts)
- ✅ Wolfpack IP and port
- ✅ Feature toggles
- ✅ Logging preferences
- ✅ Backup schedule
- ✅ Audio settings
- ✅ CEC settings
- ✅ Device settings

#### devices.local.json
- ✅ Device inventory
- ✅ Custom device definitions
- ✅ Device groupings
- ✅ CEC configurations
- ✅ DirecTV settings
- ✅ FireTV settings
- ✅ Global Cache settings
- ✅ Wolfpack settings

#### sports-teams.local.json
- ✅ Home teams
- ✅ Favorite teams
- ✅ Notification preferences
- ✅ Auto-monitoring settings
- ✅ Favorite leagues

### 🌐 Environment Variables (.env)

**All your API keys and secrets:**

- ✅ Wolfpack connection (WOLFPACK_HOST, WOLFPACK_PORT)
- ✅ Database URL (DATABASE_URL)
- ✅ Encryption key (ENCRYPTION_KEY)
- ✅ NextAuth configuration (NEXTAUTH_URL, secrets)
- ✅ API base URL (API_BASE_URL)
- ✅ External service credentials
- ✅ Custom environment variables

### 📤 User Uploads (uploads/)

**All your uploaded files:**

- ✅ Bar layout PDFs
- ✅ Equipment manuals
- ✅ Custom images
- ✅ Log exports
- ✅ Backup files
- ✅ Documentation

## Backup Process

### Automatic (Every Update)

```bash
./update_from_github.sh
```

**Creates:**
```
~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz
```

**Retention:** Last 7 backups kept automatically

### Manual Backup

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Create backup now
tar -czf ~/manual-backup-$(date +%Y%m%d).tar.gz \
    config/*.local.json \
    .env \
    prisma/dev.db \
    data/*.json \
    data/scene-logs/ \
    data/atlas-configs/ \
    uploads/

# Full system backup (includes node_modules, logs, etc.)
tar -czf ~/full-system-backup-$(date +%Y%m%d).tar.gz \
    /home/ubuntu/Sports-Bar-TV-Controller/
```

## Protected by .gitignore

All your data is protected from Git:

```bash
# Never tracked by Git:
.env
.env*.local
config/*.local.json
config/*.local.js
prisma/*.db
prisma/*.db-journal
data/*.json                    ← NEW!
data/scene-logs/              ← NEW!
data/atlas-configs/*.json     ← NEW!
/uploads/*
```

**What this means:**
- ✅ Never committed to GitHub
- ✅ Never overwritten by `git pull`
- ✅ Never shared publicly
- ✅ Always preserved on your local machine

## What's NOT Backed Up

Only these are excluded (can be regenerated):

- ❌ `node_modules/` - Dependencies (regenerated by `npm install`)
- ❌ `.next/` - Build cache (regenerated by `npm run build`)
- ❌ `logs/` - Rotating logs (continuously generated)
- ❌ Template files - Stored in Git (data/*.template.json)

Everything else is backed up!

## Restore Process

### Full Restore

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Stop server
pkill -f "npm.*start"

# Restore from backup
tar -xzf ~/sports-bar-backups/config-backup-YYYYMMDD-HHMMSS.tar.gz

# Restart server
npm start
```

### Selective Restore

```bash
# Restore only database
tar -xzf ~/sports-bar-backups/config-backup-LATEST.tar.gz prisma/dev.db

# Restore only data files
tar -xzf ~/sports-bar-backups/config-backup-LATEST.tar.gz data/

# Restore only config
tar -xzf ~/sports-bar-backups/config-backup-LATEST.tar.gz config/

# Restore only .env
tar -xzf ~/sports-bar-backups/config-backup-LATEST.tar.gz .env
```

## Verification

### Test Preservation

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./test-preservation.sh
```

**Shows:**
- Database record counts (inputs, outputs, routes, scenes, devices, etc.)
- Configuration files status
- Data files status
- Upload directory status
- Streaming credentials count

### List Backup Contents

```bash
tar -tzf ~/sports-bar-backups/config-backup-LATEST.tar.gz
```

**Shows all files in backup**

### View Specific Backup File

```bash
# View streaming credentials from backup (without extracting)
tar -xzOf ~/sports-bar-backups/config-backup-LATEST.tar.gz data/streaming-credentials.json | jq .

# View database tables from backup (extract to temp location)
tar -xzf ~/sports-bar-backups/config-backup-LATEST.tar.gz -C /tmp/
sqlite3 /tmp/prisma/dev.db "SELECT * FROM ApiKey;"
```

## Backup Locations

### Primary Backups

```
~/sports-bar-backups/
├── config-backup-20251001-120000.tar.gz  ← Most recent
├── config-backup-20251001-100000.tar.gz
├── config-backup-20250930-180000.tar.gz
├── config-backup-20250930-160000.tar.gz
├── config-backup-20250930-140000.tar.gz
├── config-backup-20250929-220000.tar.gz
└── config-backup-20250929-200000.tar.gz  ← Oldest kept
```

### Live Data

Your actual data files (not backups):
```
/home/ubuntu/Sports-Bar-TV-Controller/
├── config/
│   ├── local.local.json
│   ├── devices.local.json
│   └── sports-teams.local.json
├── data/
│   ├── streaming-credentials.json
│   ├── device-subscriptions.json
│   ├── directv-devices.json
│   ├── firetv-devices.json
│   ├── ir-devices.json
│   ├── tv-layout.json
│   ├── scene-logs/
│   └── atlas-configs/
├── prisma/
│   └── dev.db
├── uploads/
└── .env
```

## Security

### Backup Permissions

```bash
# Ensure backups are private
chmod 600 ~/sports-bar-backups/*.tar.gz
chmod 700 ~/sports-bar-backups/
```

### External Backup

**Recommended:** Copy backups to external storage

```bash
# USB drive
cp ~/sports-bar-backups/config-backup-*.tar.gz /media/backup-drive/

# Network drive
cp ~/sports-bar-backups/config-backup-*.tar.gz /mnt/nas/sports-bar/

# Cloud storage (using rclone)
rclone copy ~/sports-bar-backups/ remote:sports-bar-backups/
```

### Encrypted Backup

For extra security:

```bash
# Create encrypted backup
tar -czf - \
    config/*.local.json \
    .env \
    prisma/dev.db \
    data/*.json | \
gpg --symmetric --cipher-algo AES256 \
    > ~/encrypted-backup-$(date +%Y%m%d).tar.gz.gpg

# Restore encrypted backup
gpg --decrypt ~/encrypted-backup-YYYYMMDD.tar.gz.gpg | tar -xzf -
```

## Summary

### Everything Backed Up

| Category | Items | Location | Count |
|----------|-------|----------|-------|
| **Database** | All configs & data | `prisma/dev.db` | ~20 tables |
| **API Keys** | AI providers | Database | 4+ keys |
| **Streaming** | Service credentials | `data/streaming-credentials.json` | Variable |
| **Subscriptions** | Device packages | `data/device-subscriptions.json` | Variable |
| **Devices** | Device configs | `data/*.json` | 4+ files |
| **Config** | System settings | `config/*.local.json` | 3 files |
| **Environment** | API keys & secrets | `.env` | 8+ vars |
| **Uploads** | User files | `uploads/` | Variable |
| **Logs** | Scene history | `data/scene-logs/` | Variable |
| **Presets** | Atlas configs | `data/atlas-configs/` | Variable |

**Total:** Everything you configure is backed up! ✅

### Backup Size

Typical backup sizes:
- **Minimal** (fresh install): ~100 KB
- **Configured** (with data): ~500 KB - 2 MB
- **Heavy use** (with uploads): 2 MB - 50 MB

### Update Safety

When you run `./update_from_github.sh`:

1. ✅ **Backup created** - All data saved before any changes
2. ✅ **Code updated** - Latest features from GitHub
3. ✅ **Data preserved** - All your settings intact
4. ✅ **Dependencies updated** - npm packages installed
5. ✅ **Database migrated** - Schema updated, data kept
6. ✅ **Verification** - Success message shows what's preserved
7. ✅ **Server restarted** - App running with your data

**Result:** Zero configuration loss! 🎉

---

**Related Documentation:**
- `API_KEYS_BACKUP_GUIDE.md` - API keys & credentials details
- `USER_DATA_PRESERVATION.md` - All preserved data
- `UPDATE_SCRIPT_GUIDE.md` - Update process details
- `LOCAL_CONFIG_SYSTEM.md` - Configuration system
- `test-preservation.sh` - Verification script

**Last Updated:** October 1, 2025
