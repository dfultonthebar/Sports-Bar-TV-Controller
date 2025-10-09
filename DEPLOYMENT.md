# Deployment Checklist

## Pre-Deployment

### 1. Database Backup
**CRITICAL: Always backup the database before deployment**

```bash
# Run the backup script
./scripts/backup-database.sh

# Verify backup was created
ls -lh backups/
```

### 2. Code Review
- [ ] All changes reviewed and approved
- [ ] Tests passing locally
- [ ] No console errors or warnings
- [ ] Database migrations tested (if applicable)

### 3. Environment Check
- [ ] Environment variables configured
- [ ] API keys and secrets verified
- [ ] Port configurations correct
- [ ] SSL certificates valid (if applicable)

## Deployment Steps

### 1. Stop Services
```bash
# Stop the application
pm2 stop sports-bar-tv-controller
# or
sudo systemctl stop sports-bar-tv-controller
```

### 2. Backup Current State
```bash
# Backup database
./scripts/backup-database.sh

# Backup current code (optional)
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=backups \
    .
```

### 3. Pull Latest Code
```bash
git fetch origin
git checkout main
git pull origin main
```

### 4. Install Dependencies
```bash
npm install
# or
npm ci  # for production (uses package-lock.json exactly)
```

### 5. Build Application
```bash
npm run build
```

### 6. Database Migrations (if needed)
```bash
# Run any pending migrations
npm run migrate
# or apply migrations manually
```

### 7. Start Services
```bash
# Start the application
pm2 start sports-bar-tv-controller
pm2 save

# or
sudo systemctl start sports-bar-tv-controller
```

### 8. Verify Deployment
```bash
# Check application status
pm2 status
# or
sudo systemctl status sports-bar-tv-controller

# Check logs
pm2 logs sports-bar-tv-controller --lines 50
# or
sudo journalctl -u sports-bar-tv-controller -n 50 -f

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3001/api/system-admin/health
```

## Post-Deployment

### 1. Smoke Tests
- [ ] Application loads successfully
- [ ] User authentication works
- [ ] TV control functions work
- [ ] Wolf Pack switching works
- [ ] System Admin Hub accessible

### 2. Monitor
- [ ] Check error logs for 15-30 minutes
- [ ] Monitor system resources (CPU, memory, disk)
- [ ] Verify no database errors

### 3. Rollback Plan (if needed)
```bash
# Stop services
pm2 stop sports-bar-tv-controller

# Restore previous code
git checkout <previous-commit-hash>
npm install
npm run build

# Restore database backup (ONLY if necessary)
cp backups/sports-bar_YYYYMMDD_HHMMSS.db data/sports-bar.db

# Restart services
pm2 start sports-bar-tv-controller
```

## Emergency Contacts
- Developer: [Your contact info]
- System Admin: [Admin contact info]
- Hosting Provider: [Provider support]

## Notes
- Always test in a staging environment first if available
- Keep at least 10 database backups
- Document any manual changes made during deployment
- Update this checklist as deployment process evolves
