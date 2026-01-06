# System Cleanup Report
**Generated:** October 29, 2025
**Purpose:** Identify obsolete files after Prisma→Drizzle migration and system consolidation

## Summary

**Total reclaimable space: ~625MB**

### Priority Cleanup Items

## 1. PM2 Log Files - **605MB** ⚠️ CRITICAL

Old PM2 process logs consuming massive disk space:

```
181M - sports-bar-out.log (old process name)
116M - sports-bar-tv-controller-out-0.log (rotated log)
116M - sports-bar-error.log (old process name)
74M  - sports-bar-tv-controller-error-0.log (rotated log)
59M  - sports-bar-tv-controller-out.log (current but bloated)
40M  - sports-bar-tv-out.log (old process name)
13M  - sports-bar-tv-error.log (old process name)
1.6M - sports-bar-tv-controller-error.log (current)
928K - db-file-monitor-out.log (defunct process)
272K - sportsbar-assistant-error.log (old process)
```

**Recommendation:**
- ✅ SAFE TO DELETE: All "sports-bar" and "sports-bar-tv" logs (old process names)
- ✅ SAFE TO DELETE: All "*-0.log" rotated logs
- ✅ SAFE TO DELETE: db-file-monitor logs (process no longer exists)
- ⚠️ TRUNCATE: sports-bar-tv-controller-out.log (keep last 10K lines)

**Action:**
```bash
# Delete old process logs
rm /home/ubuntu/.pm2/logs/sports-bar-*.log
rm /home/ubuntu/.pm2/logs/sports-bar-tv-*.log
rm /home/ubuntu/.pm2/logs/db-file-monitor-*.log
rm /home/ubuntu/.pm2/logs/sportsbar-assistant-*.log

# Delete rotated logs
rm /home/ubuntu/.pm2/logs/*-0.log

# Truncate current logs (keep last 1000 lines)
tail -n 1000 /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log > /tmp/out.tmp && mv /tmp/out.tmp /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log
tail -n 1000 /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log > /tmp/err.tmp && mv /tmp/err.tmp /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

# Or use PM2's built-in flush
pm2 flush sports-bar-tv-controller
pm2 flush qa-worker
pm2 flush n8n
```

---

## 2. Prisma Files - **~10MB** ✅ SAFE TO DELETE

After Drizzle migration, these Prisma files are obsolete:

### Old Database Files (9.3MB)
```
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db.backup-20251015-044652 (9.2M)
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db-shm (32K)
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db-wal (empty)
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db (4K - tiny, but obsolete)
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db.empty-backup (12K)
```

### Prisma Schema Files
```
/home/ubuntu/Sports-Bar-TV-Controller/prisma/schema_updated.prisma
/home/ubuntu/Sports-Bar-TV-Controller/prisma/schema_backup.prisma
/home/ubuntu/Sports-Bar-TV-Controller/prisma/schema_qa_addition.prisma
```

### Prisma Migrations Directory
```
/home/ubuntu/Sports-Bar-TV-Controller/prisma/migrations/ (entire directory)
```

**Action:**
```bash
# CAUTION: Verify you're using Drizzle before running!
rm -rf /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/
rm -f /home/ubuntu/Sports-Bar-TV-Controller/prisma/schema_*.prisma
rm -rf /home/ubuntu/Sports-Bar-TV-Controller/prisma/migrations/
```

---

## 3. Database Files Status - **20MB** ✅ KEEP AS BACKUPS

Current database locations:

### Active Production Database
```
/home/ubuntu/sports-bar-data/production.db (2.2M) ✅ ACTIVE - DO NOT DELETE
```

### Backup Databases (11MB)
```
/home/ubuntu/Sports-Bar-TV-Controller/database_backups/
├── sportsbar_empty_20251029.db
├── sports_bar_prisma_20251029.db
├── sports-bar-tv-controller_empty_20251029.db
└── sports_bar_old_20251029.db
```

**Recommendation:** Keep backups for 30 days, then delete if no issues occur.

---

## 4. Documentation Files - **1.5MB (154 files)** ℹ️ OPTIONAL

Root directory has 154 markdown summary files. Most are small but create clutter:

**Example duplicates:**
- ATLAS_FIXES_SUMMARY.md
- ATLAS_FIX_SUMMARY_20251019.md
- ATLAS_FIX_SUMMARY.md
- ATLAS_ENHANCEMENTS_SUMMARY.md
- ATLAS_ENHANCEMENTS_FINAL_SUMMARY.md

**Recommendation:** Consider consolidating these into a `docs/historical/` directory.

**Action (optional):**
```bash
mkdir -p /home/ubuntu/Sports-Bar-TV-Controller/docs/historical
mv /home/ubuntu/Sports-Bar-TV-Controller/*_SUMMARY*.md /home/ubuntu/Sports-Bar-TV-Controller/docs/historical/
mv /home/ubuntu/Sports-Bar-TV-Controller/*_COMPLETE*.md /home/ubuntu/Sports-Bar-TV-Controller/docs/historical/
mv /home/ubuntu/Sports-Bar-TV-Controller/*_FIX*.md /home/ubuntu/Sports-Bar-TV-Controller/docs/historical/
```

---

## 5. Application Logs - **1.3MB** ✅ HEALTHY

```
/home/ubuntu/Sports-Bar-TV-Controller/logs/ (1.3M)
```

These are active operational logs. Size is reasonable. **No action needed.**

---

## 6. Build Artifacts - **467MB** ✅ KEEP

```
/home/ubuntu/Sports-Bar-TV-Controller/.next/ (467M)
```

This is the Next.js production build. **Required for application to run. Do not delete.**

---

## Recommended Cleanup Commands

### Safe and Recommended (saves ~615MB):
```bash
cd /home/ubuntu

# 1. Clean PM2 logs (~605MB saved)
rm .pm2/logs/sports-bar-*.log
rm .pm2/logs/sports-bar-tv-*.log
rm .pm2/logs/db-file-monitor-*.log
rm .pm2/logs/sportsbar-assistant-*.log
rm .pm2/logs/*-0.log
pm2 flush

# 2. Remove Prisma files (~10MB saved)
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf prisma/data/
rm -f prisma/schema_*.prisma
rm -rf prisma/migrations/

# 3. Optionally organize docs
mkdir -p docs/historical
mv *_SUMMARY*.md docs/historical/ 2>/dev/null
mv *_COMPLETE*.md docs/historical/ 2>/dev/null
mv *_FIX*.md docs/historical/ 2>/dev/null
```

### Verification After Cleanup:
```bash
# Check saved space
du -sh /home/ubuntu/.pm2/logs
du -sh /home/ubuntu/Sports-Bar-TV-Controller/prisma

# Verify application still runs
pm2 status
curl http://localhost:3001/api/health
```

---

## Files to NEVER Delete

❌ **DO NOT DELETE:**
- `/home/ubuntu/sports-bar-data/production.db` - Active production database
- `/home/ubuntu/Sports-Bar-TV-Controller/.next/` - Production build
- `/home/ubuntu/Sports-Bar-TV-Controller/node_modules/` - Dependencies
- Current PM2 logs (after truncation)
- `/home/ubuntu/Sports-Bar-TV-Controller/src/` - Source code
- `/home/ubuntu/Sports-Bar-TV-Controller/package.json` - Project configuration

---

## Post-Cleanup Recommendations

1. **Set up PM2 log rotation:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

2. **Add cleanup cron job:**
```bash
# Add to crontab: Clean logs older than 7 days
0 2 * * 0 find /home/ubuntu/.pm2/logs -name "*.log" -mtime +7 -delete
```

3. **Monitor disk usage:**
```bash
df -h /home/ubuntu
du -sh /home/ubuntu/Sports-Bar-TV-Controller
```

---

## Summary

Total reclaimable space: **~625MB**
- PM2 logs: 605MB ⚠️ High priority
- Prisma files: 10MB ✅ Safe to remove
- Database backups: 11MB ℹ️ Keep for now
- Documentation: 1.5MB ℹ️ Optional reorganization

**Recommended action:** Run the safe cleanup commands above to reclaim ~615MB.
