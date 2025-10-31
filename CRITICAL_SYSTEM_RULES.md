# CRITICAL SYSTEM RULES - READ FIRST

## ⚠️ NEVER DELETE USER DATA

**ABSOLUTE RULES:**
1. **NEVER** run commands that modify `/home/ubuntu/Sports-Bar-TV-Controller/data/`
2. **NEVER** run `rm -rf .next` without verifying data directory safety
3. **NEVER** clear caches without checking data integrity first
4. **ALWAYS** create backups before risky operations

## Protected Data Files

These files contain USER DATA and must NEVER be deleted or corrupted:

```
/home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json
/home/ubuntu/sports-bar-data/production.db
/home/ubuntu/sports-bar-data/backups/*
```

## Data Integrity Verification

Before ANY of these operations:
- `npm run build`
- `rm -rf .next`
- `pm2 restart`
- Cache clearing

Run this verification:
```bash
# Verify Fire TV devices exist
curl -s http://localhost:3001/api/firetv-devices | grep -c "devices"

# Verify database accessible
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM matrixConfigs;"
```

## What Happened (2025-10-31)

During a troubleshooting session, Fire TV devices were deleted from the system during code changes. This should NEVER happen again.

**Root Cause:** Build/cache operations may have temporarily corrupted the data file.

**Prevention:**
1. Create backup before risky operations
2. Verify data integrity after builds
3. Use sports-bar-system-guardian agent to check system health

## Backup Process

Before ANY risky operation:
```bash
# Backup Fire TV devices
cp /home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json \
   /home/ubuntu/sports-bar-data/backups/firetv-devices-$(date +%Y%m%d-%H%M%S).json

# Backup database
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/production-$(date +%Y%m%d-%H%M%S).db
```

## Recovery Process

If user data is lost:
```bash
# Restore from latest backup
ls -lt /home/ubuntu/sports-bar-data/backups/firetv-devices-* | head -1
cp [latest-backup] /home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json
```

## Sports-Bar-System-Guardian Agent

**USE THIS AGENT:**
- After code deployments
- After cache clears
- After system modifications
- To verify system health regularly

The guardian agent will check:
- All devices are present
- Database integrity
- Hardware connections
- Documentation accuracy
