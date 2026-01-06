# PM2 Maintenance & Monitoring Guide

**Quick Reference for Sports Bar TV Controller System Administration**

---

## At a Glance

**Current Status:** STABLE ✓
**Last Health Check:** November 2, 2025
**Restart Counter:** 0 (reset from 51)
**System Stability:** 5/5 ⭐

---

## Essential Commands

### Quick Health Check
```bash
# Simple status
pm2 status

# Detailed health check
/home/ubuntu/Sports-Bar-TV-Controller/scripts/pm2-simple-health.sh

# View live logs
pm2 logs sports-bar-tv-controller

# View last 100 lines
pm2 logs sports-bar-tv-controller --lines 100
```

### Common Operations
```bash
# Restart application
pm2 restart sports-bar-tv-controller

# Reset restart counter
pm2 reset sports-bar-tv-controller

# Save current configuration
pm2 save

# Clear logs (use carefully!)
pm2 flush sports-bar-tv-controller
```

---

## Files Created During This Maintenance

### Documentation
1. **PM2_MONITORING_REPORT.md** - Comprehensive technical analysis
2. **PM2_STABILITY_SUMMARY.md** - Executive summary (this is the best starting point)
3. **PM2_LOG_ROTATION_SETUP.md** - Step-by-step log rotation guide
4. **PM2_MAINTENANCE_README.md** - This file (quick reference)

### Scripts
1. **scripts/pm2-health-check.sh** - Advanced health check (requires jq)
2. **scripts/pm2-simple-health.sh** - Simple health check (working now)

### Locations
All files are in `/home/ubuntu/Sports-Bar-TV-Controller/docs/` and `/scripts/`

---

## Key Findings from Analysis

### The Good News
- **Zero crashes detected** - All 51 restarts were manual (development)
- **Excellent resource usage** - 56MB memory (5% of limit)
- **Stable performance** - Event loop <1ms, no memory leaks
- **Proper configuration** - PM2 auto-restart and startup configured

### Areas for Improvement
1. **No log rotation** - Logs growing indefinitely (8.7MB currently)
2. **No external monitoring** - Would benefit from uptime monitoring
3. **No health endpoint** - Consider adding `/api/health`
4. **Next.js config optimization** - Should use standalone mode

---

## Immediate Next Steps (Recommended)

### 1. Install Log Rotation (5 minutes)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
pm2 save
```

See full guide: `docs/PM2_LOG_ROTATION_SETUP.md`

### 2. Setup External Monitoring (15 minutes)
- Sign up for UptimeRobot (free)
- Add monitor for: http://[your-server]:3001
- Configure email/SMS alerts

### 3. Create Health Endpoint (10 minutes)
Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}
```

---

## Understanding Restart Counts

### Normal vs Concerning

**NORMAL (Don't worry):**
- Manual restarts: `pm2 restart` or `pm2 reload`
- Development restarts: Code changes, testing
- Exit code 0 with SIGINT signal
- Clustered restarts (several in short time during dev)

**CONCERNING (Investigate):**
- Unstable restarts >0 (crashes within 15s of start)
- Exit codes other than 0
- SIGKILL or SIGTERM signals (unless intentional)
- Frequent restarts with no manual intervention

### Current Baseline
After this maintenance (Nov 2, 2025):
- Manual restarts: Expected during development
- Unstable restarts: Should stay at 0
- If you see >10 restarts/day without explanation, investigate

---

## Monitoring Thresholds

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Memory | <200MB | 200-500MB | >500MB |
| Restart Count (daily) | <10 | 10-20 | >20 |
| Unstable Restarts | 0 | 1 | >1 |
| CPU Usage | <10% | 10-50% | >50% |
| Event Loop Latency | <2ms | 2-10ms | >10ms |

---

## Troubleshooting Guide

### Application Won't Start
```bash
# Check PM2 status
pm2 status

# Check error logs
pm2 logs sports-bar-tv-controller --err --lines 50

# Try manual start
cd /home/ubuntu/Sports-Bar-TV-Controller
npm start

# If that works, restart PM2
pm2 restart sports-bar-tv-controller
```

### High Memory Usage
```bash
# Check current usage
pm2 describe sports-bar-tv-controller

# Check for memory leak
pm2 monit  # Watch memory over time

# If growing continuously, restart
pm2 restart sports-bar-tv-controller
```

### Application Not Responding
```bash
# Test endpoint
curl http://localhost:3001

# Check if process is frozen
pm2 describe sports-bar-tv-controller

# Reload application (zero-downtime)
pm2 reload sports-bar-tv-controller

# Or force restart
pm2 restart sports-bar-tv-controller
```

### Logs Too Large
```bash
# Check log sizes
ls -lh /home/ubuntu/.pm2/logs/sports-bar*.log

# Clear old logs (careful!)
pm2 flush sports-bar-tv-controller

# Install log rotation (better solution)
# See docs/PM2_LOG_ROTATION_SETUP.md
```

---

## Monthly Maintenance Checklist

```
[ ] Run health check script
[ ] Review restart count (should be low)
[ ] Check log file sizes
[ ] Verify memory usage is stable
[ ] Check disk space (df -h)
[ ] Review error logs for patterns
[ ] Test application endpoints
[ ] Verify PM2 startup service is active
[ ] Check system resource usage
[ ] Update this checklist with any issues found
```

**Save checklist to:** `/home/ubuntu/maintenance-log-[YYYY-MM].txt`

---

## Emergency Contacts & Resources

### Documentation
- Main README: `/home/ubuntu/Sports-Bar-TV-Controller/README.md`
- This folder: `/home/ubuntu/Sports-Bar-TV-Controller/docs/`

### Quick Links
- PM2 Documentation: https://pm2.keymetrics.io/
- Next.js Production: https://nextjs.org/docs/deployment
- Node.js Docs: https://nodejs.org/docs/

### Common Log Locations
- Application logs: `/home/ubuntu/.pm2/logs/sports-bar-tv-controller-*.log`
- PM2 master log: `/home/ubuntu/.pm2/pm2.log`
- System logs: `journalctl -u pm2-ubuntu`

---

## Monitoring Dashboard (Future)

Consider setting up:
- **Grafana** - Visual dashboards
- **Prometheus** - Metrics collection
- **PM2 Plus** - Official PM2 monitoring (paid)
- **New Relic** - APM solution (paid)

For now, use:
- `pm2 monit` - Built-in monitoring
- Health check scripts in `/scripts/`
- External uptime monitoring (UptimeRobot)

---

## Change Log

### 2025-11-02 - Initial Maintenance
- Analyzed 51 restarts (all manual, no crashes)
- Reset restart counter to 0
- Created monitoring documentation
- Created health check scripts
- Established performance baselines
- Saved PM2 configuration

**Next Review:** 2025-12-02

---

## Quick Diagnosis Decision Tree

```
Is the application responding?
├─ NO
│  ├─ Check: pm2 status
│  ├─ If offline: pm2 restart sports-bar-tv-controller
│  └─ If online: Check logs for errors
│
└─ YES
   ├─ Is memory usage high (>500MB)?
   │  ├─ YES: Consider restart, investigate memory leak
   │  └─ NO: Continue monitoring
   │
   └─ Are there frequent restarts?
      ├─ YES: Check logs for crash pattern
      └─ NO: System is healthy ✓
```

---

## Summary

This system is **stable and healthy**. The maintenance performed on November 2, 2025 confirmed zero crashes and proper operation. Follow the recommended next steps (log rotation, external monitoring) to improve operational visibility.

**For detailed analysis, read:** `docs/PM2_STABILITY_SUMMARY.md`

**For daily operations, use:** This file + health check scripts

---

**Last Updated:** November 2, 2025
**System Guardian:** Claude Code
**Status:** PRODUCTION STABLE
