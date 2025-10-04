
# Diagnostics System Scripts

This directory contains the AI diagnostics and self-healing system for the Sports Bar TV Controller.

## Scripts

### light-check.js
Quick health checks that run every 5 minutes.

**Usage:**
```bash
node scripts/diagnostics/light-check.js
```

**Checks:**
- PM2 process status
- API health endpoint
- Database connectivity
- Disk space
- Memory usage
- System load

### deep-diagnostics.js
Comprehensive diagnostics that run every Sunday at 5:00 AM.

**Usage:**
```bash
node scripts/diagnostics/deep-diagnostics.js
```

**Checks:**
- Full dependency audit
- Security vulnerabilities
- Performance analysis
- Log analysis
- Database integrity
- External integrations
- Configuration validation
- Optimization recommendations

### self-healing.js
Automatically fixes detected issues.

**Usage:**
```bash
node scripts/diagnostics/self-healing.js
```

**Capabilities:**
- Restart crashed services
- Clean disk space
- Handle high memory
- Reinstall dependencies
- Repair database
- Proactive maintenance

### scheduler.js
Manages scheduled execution of diagnostics.

**Usage:**
```bash
# Run directly
node scripts/diagnostics/scheduler.js

# Run with PM2 (recommended)
pm2 start scripts/diagnostics/scheduler.js --name diagnostics-scheduler
pm2 save
```

**Schedule:**
- Light checks: Every 5 minutes
- Deep diagnostics: Sunday 5:00 AM EST

### test-diagnostics.js
Tests all diagnostic components.

**Usage:**
```bash
node scripts/diagnostics/test-diagnostics.js
```

## Installation

1. Install dependencies:
```bash
npm install axios node-cron
```

2. Update database schema:
```bash
npx prisma generate
npx prisma db push
```

3. Start the scheduler:
```bash
pm2 start scripts/diagnostics/scheduler.js --name diagnostics-scheduler
pm2 save
```

## API Endpoints

- `POST /api/diagnostics/light-check` - Run light check manually
- `POST /api/diagnostics/deep` - Run deep diagnostics manually
- `POST /api/diagnostics/self-heal` - Trigger self-healing manually
- `GET /api/diagnostics/status` - Get current diagnostics status

## Documentation

See `/docs/diagnostics-system.md` for complete documentation.
