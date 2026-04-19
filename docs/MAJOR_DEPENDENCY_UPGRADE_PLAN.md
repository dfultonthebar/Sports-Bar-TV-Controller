# Major Dependency Upgrade Plan

## Overview
This document outlines the testing strategy for upgrading major dependencies safely.

## Packages to Upgrade

| Package | Current | Target | Risk | Impact Area |
|---------|---------|--------|------|-------------|
| `next` | 15.5.9 | 16.1.1 | HIGH | 342 files, entire app |
| `@anthropic-ai/sdk` | 0.52.0 | 0.71.2 | MEDIUM | AI/QA processor |
| `chokidar` | 4.0.3 | 5.0.0 | LOW | Memory bank, RAG indexer |
| `node-cron` | 3.0.3 | 4.2.1 | MEDIUM | Fire TV keep-awake |
| `opossum` | 8.5.0 | 9.0.0 | MEDIUM | Circuit breakers, Sports APIs |
| `pdf-parse` | 1.1.3 | 2.4.5 | LOW | Doc processing, RAG |

---

## Pre-Upgrade Checklist

### 1. Backup & Rollback Preparation
- [ ] Create git branch for upgrades: `git checkout -b upgrade/major-deps`
- [ ] Note current working commit: `git rev-parse HEAD`
- [ ] Backup production database (if applicable)

### 2. Baseline Tests (Run BEFORE any upgrades)
- [ ] All pages load without errors
- [ ] Bartender Remote: Source selection works
- [ ] Bartender Remote: Channel change works (Cable Box)
- [ ] Bartender Remote: Fire TV navigation works
- [ ] Sports Guide: Data loads correctly
- [ ] Matrix Control: Routing displays correctly
- [ ] Device Config: All tabs accessible
- [ ] System Health: Status shows correctly
- [ ] API endpoints respond (spot check)

---

## Upgrade Order (Safest First)

### Phase 1: Low-Risk Packages
1. **pdf-parse** (1.1.3 → 2.4.5)
   - Used by: RAG server, TV docs, text extractor
   - Test: Upload/process a PDF document
   - Rollback: Simple, isolated package

2. **chokidar** (4.0.3 → 5.0.0)
   - Used by: Memory bank file watcher, RAG auto-indexer
   - Test: Memory bank snapshot creation
   - Test: RAG document indexing
   - Breaking changes: API may differ

### Phase 2: Medium-Risk Packages
3. **node-cron** (3.0.3 → 4.2.1)
   - Used by: Fire TV keep-awake scheduler
   - Test: Fire TV devices stay connected
   - Test: Scheduled tasks run correctly

4. **opossum** (8.5.0 → 9.0.0)
   - Used by: Circuit breakers, ESPN/Sports APIs
   - Test: Sports guide loads data
   - Test: ESPN API calls work
   - Test: Circuit breaker fallbacks work

5. **@anthropic-ai/sdk** (0.52.0 → 0.71.2)
   - Used by: QA generator processor
   - Test: AI features still function
   - Review: API changes in changelog

### Phase 3: High-Risk Package
6. **next** (15.5.9 → 16.1.1)
   - MAJOR VERSION CHANGE
   - Test: EVERYTHING
   - Review: Next.js 16 migration guide
   - Known breaking changes to check:
     - [ ] App Router changes
     - [ ] Server Actions changes
     - [ ] Middleware changes
     - [ ] API route changes
     - [ ] Image component changes
     - [ ] Font loading changes

---

## Playwright Test Scenarios

### Test 1: Page Load Verification
```
Pages to test:
- /remote (Bartender Remote)
- /sports-guide (Sports Guide)
- /matrix-control (Matrix Control)
- /device-config (Device Config)
- /system-health (System Health)
- /audio-control (Audio Control)
```

### Test 2: Bartender Remote Flow
```
1. Navigate to /remote
2. Click "Remote" tab
3. Verify sources load (Cable Box 1-4, DirecTV 1-8, Amazon 1-4)
4. Select Cable Box 1
5. Enter channel "27"
6. Press ENTER
7. Immediately select Cable Box 2 (no blocking)
8. Verify remote switches successfully
```

### Test 3: Sports Guide
```
1. Navigate to /sports-guide
2. Verify games/channels load
3. Click on a channel preset
4. Verify no errors in console
```

### Test 4: API Health Checks
```
Endpoints to verify:
- GET /api/health
- GET /api/matrix/status
- GET /api/firetv/devices
- GET /api/ir-devices
- GET /api/sports-guide/channels
```

---

## Post-Upgrade Verification

### After Each Package Update:
1. [ ] `npm run build` succeeds
2. [ ] `pm2 restart` succeeds
3. [ ] No console errors on page load
4. [ ] Run relevant Playwright tests
5. [ ] Check PM2 logs for errors

### Final Verification:
1. [ ] All Playwright tests pass
2. [ ] Manual smoke test of key features
3. [ ] PM2 logs clean for 5+ minutes
4. [ ] No 500 errors in browser console

---

## Rollback Procedure

If any upgrade fails:
```bash
# Revert to previous commit
git checkout <previous-commit-hash>

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build

# Restart
pm2 restart sports-bar-tv-controller
```

---

## Upgrade Commands

### Phase 1
```bash
npm install pdf-parse@latest
npm install chokidar@latest
```

### Phase 2
```bash
npm install node-cron@latest
npm install opossum@latest
npm install @anthropic-ai/sdk@latest
```

### Phase 3 (Next.js - do separately!)
```bash
# Read migration guide first!
npm install next@latest eslint-config-next@latest
```

---

## Notes

- Run each upgrade individually, test, then proceed
- Commit after each successful upgrade
- Keep this checklist updated as tests are run
- If Next.js 16 has too many breaking changes, consider staying on 15.x LTS
