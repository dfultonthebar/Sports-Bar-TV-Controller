# Sports Bar Command Center (SBCC) — Implementation Plan

## Context

Three sports bar locations run standalone installations of the Sports Bar TV Controller. There is no cross-location visibility — device failures, scheduler stalls, and error spikes go unnoticed until a bartender complains. This plan adds a centralized monitoring hub on a home server that ingests telemetry from all locations, surfaces it in a dashboard, and eventually self-heals common failures.

The existing codebase already has the raw APIs needed — `GET /api/system/health`, `GET /api/system/metrics`, `GET /api/circuit-breaker/status`, `GET /api/scheduler/status`, `GET /api/firetv-devices/connection-status`, `POST /api/tv-discovery/status`, `GET /api/sports-guide/live-dashboard` — plus a `Location` table in the schema, an `authApiKeys` system with per-location scoping, and a proven Drizzle ORM + SQLite pattern. The hub builds on all of these.

## Architecture

```
Location NUCs (3x)                         Home Server (Proxmox VM)
+----------------------------+             +-----------------------------+
| Next.js App (:3001)        |             | SBCC Hub App (:3010)        |
| SQLite DB                  |             | SQLite (Drizzle ORM)        |
|                            |             | Ollama + GPU (Phase 3)      |
|                            |             |                             |
| hub-agent (PM2 sidecar)   |             | POST /api/ingest/*          |
|   polls local APIs:        |---HTTPS---->|   validates HMAC signature  |
|     /api/system/health     |   every 60s |   stores in time-series DB  |
|     /api/system/metrics    |             |                             |
|     /api/circuit-breaker   |             | Dashboard pages:            |
|     /api/scheduler/status  |             |   / (multi-location cards)  |
|     /api/firetv-devices/   |             |   /locations/[id]           |
|       connection-status    |             |   /scheduling               |
|     /api/sports-guide/     |             |                             |
|       live-dashboard       |             | Alert engine evaluates each |
|   batches + HMAC signs     |             | ingest, fires Pushover/     |
|   POSTs to hub             |             | in-app notifications        |
+----------------------------+             +-----------------------------+
```

---

## Phase 1: Foundation + Basic Dashboard

### New Packages/Apps

| Path | Purpose |
|------|---------|
| `packages/hub-agent/` | Lightweight PM2 sidecar on each location NUC — polls local APIs, pushes to hub |
| `apps/hub/` | Next.js monitoring dashboard on home server |

### Hub Agent (`packages/hub-agent/`)

Standalone Node.js process. Polls local API endpoints, batches results, HMAC-signs, POSTs to hub.

**Data collection:**

| Interval | Endpoints |
|----------|-----------|
| 60s | `/api/system/health`, `/api/system/metrics`, `/api/circuit-breaker/status` |
| 5min | `/api/scheduler/status`, `/api/scheduler/metrics?hours=1`, `/api/firetv-devices/connection-status`, `/api/sports-guide/live-dashboard` |

**Auth:** HMAC-SHA256 signed payloads. Each location gets `HUB_AGENT_SECRET` in `.env`.

**PM2 config** (each location's `ecosystem.config.js`):
```js
{
  name: 'hub-agent',
  script: 'packages/hub-agent/dist/index.js',
  env: {
    HUB_URL: 'https://hub.yourdomain.com',
    LOCATION_ID: 'stoneyard-greenville',
    HUB_AGENT_SECRET: '<per-location-shared-secret>',
    LOCAL_API_URL: 'http://localhost:3001',
  }
}
```

### Hub App (`apps/hub/`)

Next.js app with own SQLite database via Drizzle ORM.

**Database schema:**

| Table | Key Fields |
|-------|------------|
| `hubLocations` | id, name, branch, timezone, hmacSecret, lastSeenAt, isActive, metadata |
| `healthSnapshots` | locationId, timestamp, healthScore (0-100), overallStatus, devicesOnline/Total, rawPayload |
| `metricsSnapshots` | locationId, timestamp, cpuUsage, memoryUsage, diskUsage, uptime, rawPayload |
| `schedulerSnapshots` | locationId, timestamp, isRunning, successRate, totalOps, errorCount, rawPayload |
| `sportsScheduleCache` | locationId, timestamp, liveGames, upcomingGames, rawPayload |

**Retention:** 30-day snapshots, daily cleanup cron.

**Ingest API routes:**

| Route | Source |
|-------|--------|
| `POST /api/ingest/health` | Agent 60s poll |
| `POST /api/ingest/metrics` | Agent 60s poll |
| `POST /api/ingest/scheduler` | Agent 5min poll |
| `POST /api/ingest/sports` | Agent 5min poll |

**Location management API:**

| Route | Purpose |
|-------|---------|
| `GET/POST /api/locations` | List/register locations |
| `GET/PUT/DELETE /api/locations/[id]` | Location CRUD |
| `GET /api/locations/[id]/history` | Historical snapshots for charts |

**Dashboard pages:**

- `/` — Multi-location overview cards (health, devices, alerts, games, CPU/RAM/disk)
- `/locations/[id]` — Tabbed detail (Health, Metrics, Scheduler, Sports, Config)

### Implementation Order

1. `packages/hub-agent/src/types.ts` — shared interfaces
2. `apps/hub/` scaffold — Next.js app
3. Hub DB schema + Drizzle config
4. HMAC verification middleware
5. Ingest API routes
6. Location management API
7. Dashboard pages (overview + detail)
8. Hub agent collector + sender
9. PM2 config + deploy docs
10. End-to-end test + version bump to 2.3.0

### Key Patterns to Reuse

| What | Source |
|------|--------|
| Drizzle ORM + SQLite | `packages/database/src/db.ts` |
| Rate limiting | `packages/rate-limiting/` |
| Validation middleware | `packages/validation/` |
| Logger | `packages/logger/` |
| Dark theme styling | `apps/web/src/components/SchedulerLogsDashboard.tsx` |
| `SystemHealthReport` | `apps/web/src/app/api/system/health/route.ts` |

---

## Phase 2: Alerting + Sports Visibility (Future)

- Rule-based alert engine with configurable thresholds
- Pushover phone notifications for critical issues
- Email daily digests (Nodemailer + SMTP)
- Cross-location scheduling view (side-by-side game coverage)
- Default rules: Location Offline, Health Degraded, Device Offline, CPU High, Disk Low, Game Not Tuned
- 15-minute cooldown per rule per location

## Phase 3: Auto-Remediation + AI Insights (Future)

- Reverse WebSocket command channel (agent maintains persistent WS to hub)
- Safe auto-remediation: Fire TV reconnect, PM2 restart, scheduler restart
- Ollama AI on hub server (GPU-accelerated) for cross-location daily analysis
- AI insights dashboard panel with confidence scores
- All remediation actions logged for audit

## Phase 4: Advanced Intelligence (Future)

- Cross-location pattern sharing (scheduling templates, volume profiles)
- Predictive alerts ("CPU spikes every game night at 7 PM")
- Historical trend dashboards (Recharts time-series)
- PostgreSQL migration if data volume requires it
- Supervised remediation (server reboot with dashboard confirmation)

---

## Hub Server Requirements

### Minimum (Phase 1-2)
- Proxmox VM: 2 vCPUs, 4 GB RAM, 20 GB disk
- Ubuntu Server 24.04 LTS
- Node.js 22, PM2, Caddy

### Recommended (Phase 3-4 with AI)
- Proxmox VM: 4 vCPUs, 16 GB RAM, 128 GB SSD
- GPU passthrough (Tesla P40 24GB ~$150 used, or RTX 3060 12GB ~$200)
- Ollama with GPU support

### Networking
- Port 443 forwarded to Caddy (or Tailscale for zero-config)
- DDNS service (DuckDNS) for stable hostname
- Caddy handles automatic Let's Encrypt TLS

## Security

- **Agent -> Hub**: HMAC-SHA256 signed payloads over HTTPS
- **Hub -> Agent**: Commands over authenticated WebSocket (Phase 3)
- **Dashboard**: PIN-based auth, home network only
- **No sensitive data transmitted**: API response JSON only, no credentials

---

**Plan Status:** Approved April 2026
**Implementation:** Pending hub server setup
