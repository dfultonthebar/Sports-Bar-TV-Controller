# Multi-Location Architecture Guide

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Database Design for Multi-Location](#database-design-for-multi-location)
4. [Communication Patterns](#communication-patterns)
5. [Location Registration Process](#location-registration-process)
6. [Central Management Dashboard](#central-management-dashboard)
7. [Network Architecture](#network-architecture)
8. [Failover and Independence](#failover-and-independence)
9. [Software Updates](#software-updates)
10. [Pricing and Licensing Considerations](#pricing-and-licensing-considerations)
11. [Security Considerations](#security-considerations)
12. [Migration Path](#migration-path)
13. [Technology Stack for Central](#technology-stack-for-central)
14. [Implementation Timeline](#implementation-timeline)
15. [Cost Analysis](#cost-analysis)
16. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Vision

Transform the Sports Bar TV Controller from a single-location solution into a scalable, multi-location management platform that enables sports bar chains and franchises to manage all their locations from a single dashboard.

**Key Capabilities:**
- **Centralized Control**: Manage all locations from one dashboard
- **Location Independence**: Each location operates autonomously
- **Real-Time Monitoring**: View status of all devices across all locations
- **Aggregated Analytics**: Cross-location reporting and insights
- **Scalable Design**: Support 2-1000+ locations
- **Franchise Ready**: White-label capabilities for multi-tenant deployment

### Current State

**What We Have Today:**
- Fully functional single-location controller
- Database schema with `location_id` field in all tables
- Environment variable support for location identification
- RESTful API architecture ready for extension
- Comprehensive logging and audit trails

**Multi-Location Readiness:**
- ✅ Data model supports multiple locations
- ✅ Location isolation built into database design
- ✅ API endpoints can filter by location_id
- ✅ Authentication system ready for multi-tenant
- ⚠️ Need central server implementation
- ⚠️ Need inter-location communication protocol
- ⚠️ Need aggregation and reporting layer

### Deployment Phases

| Phase | Timeline | Locations | Description | Effort |
|-------|----------|-----------|-------------|--------|
| **Phase 1** | Current | 1 | Single location, manual management | Complete |
| **Phase 2** | Months 1-3 | 2-3 | Independent locations, no central server | 40 hours |
| **Phase 3** | Months 3-6 | 3-10 | Central dashboard, basic monitoring | 120 hours |
| **Phase 4** | Months 6-12 | 10-50 | Full management, remote control | 200 hours |
| **Phase 5** | Year 2+ | 50+ | Franchise-ready, white-label, billing | 300 hours |

### Business Value

**For Bar Owners:**
- Manage multiple locations without traveling
- Consistent experience across all locations
- Faster troubleshooting and support
- Data-driven scheduling decisions
- Reduced operational overhead

**For Franchises:**
- Centralized brand control
- Standardized operations
- Location performance comparison
- Scalable support model
- Revenue opportunity (SaaS model)

**For Technology Providers:**
- Recurring revenue model (monthly/annual subscriptions)
- Scalable architecture (cloud-based)
- Competitive differentiator
- Expansion into enterprise market

---

## Architecture Overview

### Current Architecture (Single Location)

```
┌──────────────────────────────────────────────────────────┐
│             Sports Bar Location 1                        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │     Sports-Bar-TV-Controller (Next.js)            │  │
│  │                                                     │  │
│  │  ┌─────────────┐  ┌──────────────┐                │  │
│  │  │ Web UI      │  │ API Server   │                │  │
│  │  │ (React)     │  │ (Next.js API)│                │  │
│  │  └─────────────┘  └──────────────┘                │  │
│  │         │               │                          │  │
│  │         └───────┬───────┘                          │  │
│  │                 │                                   │  │
│  │         ┌───────▼────────┐                         │  │
│  │         │ Database Layer │                         │  │
│  │         │ (SQLite/Drizzle)│                        │  │
│  │         └───────┬────────┘                         │  │
│  │                 │                                   │  │
│  │         ┌───────▼────────┐                         │  │
│  │         │ Device Control │                         │  │
│  │         │ (CEC, ADB, IR) │                         │  │
│  │         └────────────────┘                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                        │                                   │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │            Hardware Devices                        │  │
│  │  • TVs (CEC/IP Control)                            │  │
│  │  • HDMI Matrix Switches                            │  │
│  │  • Fire TV Devices (ADB)                           │  │
│  │  • Audio System                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Network: 192.168.5.0/24                                 │
│  Server IP: 192.168.5.10                                 │
└──────────────────────────────────────────────────────────┘
```

### Phase 2: Multi-Location Without Central (2-3 Locations)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Location 1        │  │   Location 2        │  │   Location 3        │
│   Main Street Bar   │  │   Downtown Bar      │  │   Airport Bar       │
│                     │  │                     │  │                     │
│  Controller v1.0    │  │  Controller v1.0    │  │  Controller v1.0    │
│  192.168.5.10:3000  │  │  192.168.6.10:3000  │  │  192.168.7.10:3000  │
│  SQLite DB          │  │  SQLite DB          │  │  SQLite DB          │
│  location_id: L001  │  │  location_id: L002  │  │  location_id: L003  │
│                     │  │                     │  │                     │
│  Independent        │  │  Independent        │  │  Independent        │
│  Operation          │  │  Operation          │  │  Operation          │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

                    Manager Uses:
                    • SSH to each location
                    • Bookmark each web interface
                    • Manage separately
```

**Characteristics:**
- Each location is completely independent
- No inter-location communication
- Manual management of each location
- Copy configuration between locations manually
- Good for: 2-3 locations, tech-savvy owner

### Phase 3: Central Dashboard with Monitoring (3-10 Locations)

```
                    ┌──────────────────────────────────────┐
                    │      Central Management Server       │
                    │      central.example.com             │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │  Central Dashboard (Next.js)   │  │
                    │  │  • Location Overview           │  │
                    │  │  • Device Status Aggregation   │  │
                    │  │  • Audit Log Viewer            │  │
                    │  │  • Alert Management            │  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │  PostgreSQL Database           │  │
                    │  │  • Location registry           │  │
                    │  │  • Aggregated metrics          │  │
                    │  │  • Central audit log           │  │
                    │  │  • Alert configurations        │  │
                    │  └────────────────────────────────┘  │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
        ┌───────────▼──┐  ┌────────▼──────┐  ┌────▼──────────┐
        │ Location 1   │  │ Location 2    │  │ Location 3    │
        │ 192.168.5.10 │  │ 192.168.6.10  │  │ 192.168.7.10  │
        └──────────────┘  └───────────────┘  └───────────────┘
             │                   │                   │
        (Heartbeat          (Heartbeat          (Heartbeat
         every 5min)         every 5min)         every 5min)
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                    POST /api/locations/heartbeat
                    POST /api/locations/audit-log
                    POST /api/locations/alert
```

**Characteristics:**
- Central server aggregates data from locations
- Locations push metrics and logs to central
- Central provides monitoring dashboard
- Each location still operates independently
- One-way communication (location → central)
- Good for: 3-10 locations, centralized monitoring

### Phase 4: Full Central Management (10+ Locations)

```
                    ┌──────────────────────────────────────┐
                    │      Central Management Server       │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │  Advanced Dashboard            │  │
                    │  │  • Real-time monitoring        │  │
                    │  │  • Remote device control       │  │
                    │  │  • Configuration push          │  │
                    │  │  • Cross-location reporting    │  │
                    │  │  • User management             │  │
                    │  │  • Update management           │  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │  API Gateway                   │  │
                    │  │  • Authentication              │  │
                    │  │  • Rate limiting               │  │
                    │  │  • Request routing             │  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │  PostgreSQL + Redis            │  │
                    │  │  • Multi-tenant data           │  │
                    │  │  • Real-time caching           │  │
                    │  │  • Job queue                   │  │
                    │  └────────────────────────────────┘  │
                    └─────────────┬────────────────────────┘
                                  ▲
                                  │ Bi-directional
                                  │ Communication
                                  ▼
        ┌────────────────────────┴────────────────────────┐
        │                                                  │
┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐  ...  (50+ locations)
│ Location 1   │  │ Location 2   │  │ Location 3   │
│              │  │              │  │              │
│ Controller   │  │ Controller   │  │ Controller   │
│ + Agent      │  │ + Agent      │  │ + Agent      │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Characteristics:**
- Bi-directional communication
- Central can query and control locations
- Push configuration updates to locations
- Real-time device status
- Centralized user management (optional)
- Remote troubleshooting capabilities
- Good for: 10+ locations, enterprise deployment

---

## Database Design for Multi-Location

### Data Separation Strategy

**Location-Specific Data (SQLite at each location):**
- Stays at the location
- Real-time operational data
- High-frequency reads/writes
- No network dependency

**Central Data (PostgreSQL at central server):**
- Aggregated across locations
- Lower frequency updates
- Reporting and analytics
- Cross-location queries

### Location Database Schema (SQLite)

**Already implemented with `location_id` in all tables:**

```sql
-- Devices table (location-specific)
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,  -- e.g., "main-street-bar-001"
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  ip_address TEXT,
  status TEXT DEFAULT 'unknown',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Presets table
CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  configuration TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Schedules table
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  action TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Audit log table
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

**Key Points:**
- Every table has `location_id`
- Queries always filter by location_id
- Data isolation enforced at application layer
- Each location operates independently

### Central Database Schema (PostgreSQL)

**New tables for central server:**

```sql
-- Locations registry
CREATE TABLE locations (
  id TEXT PRIMARY KEY,                    -- e.g., "main-street-bar-001"
  name TEXT NOT NULL,                     -- "Main Street Sports Bar"
  slug TEXT UNIQUE NOT NULL,              -- "main-street-bar"
  organization_id TEXT,                   -- For multi-tenant (franchise)

  -- Contact info
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  contact_email TEXT,
  contact_phone TEXT,

  -- Technical info
  controller_version TEXT,                -- "1.5.3"
  api_key_hash TEXT NOT NULL,            -- Hashed API key for authentication
  last_heartbeat_at TIMESTAMP,
  last_ip_address TEXT,

  -- Status
  status TEXT DEFAULT 'pending',          -- pending, active, inactive, suspended
  health_status TEXT DEFAULT 'unknown',   -- healthy, warning, error, offline

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,

  -- Configuration
  settings JSONB DEFAULT '{}'::jsonb,     -- Location-specific settings

  INDEX idx_organization (organization_id),
  INDEX idx_status (status),
  INDEX idx_health (health_status)
);

-- Organizations (for franchises)
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,

  -- Billing
  plan_tier TEXT DEFAULT 'basic',         -- basic, pro, enterprise
  billing_email TEXT,

  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Heartbeat metrics (time-series data)
CREATE TABLE location_heartbeats (
  id SERIAL PRIMARY KEY,
  location_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),

  -- System metrics
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  disk_usage DECIMAL(5,2),
  uptime_seconds INTEGER,

  -- Application metrics
  devices_total INTEGER,
  devices_online INTEGER,
  devices_offline INTEGER,
  devices_error INTEGER,

  -- Network
  ip_address TEXT,

  -- Metadata
  controller_version TEXT,

  INDEX idx_location_time (location_id, timestamp DESC),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Aggregated audit logs (synced from locations)
CREATE TABLE central_audit_log (
  id TEXT PRIMARY KEY,                    -- Same as location audit log ID
  location_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,

  -- Audit details
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,

  -- Sync metadata
  synced_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_location_time (location_id, timestamp DESC),
  INDEX idx_action (action),
  INDEX idx_user (user_id),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Alerts and notifications
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),

  -- Alert details
  severity TEXT NOT NULL,                 -- info, warning, error, critical
  type TEXT NOT NULL,                     -- device_offline, system_error, etc.
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Status
  status TEXT DEFAULT 'open',             -- open, acknowledged, resolved, ignored
  acknowledged_at TIMESTAMP,
  acknowledged_by TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,

  INDEX idx_location_status (location_id, status),
  INDEX idx_severity (severity),
  INDEX idx_timestamp (timestamp DESC),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Alert rules (configurable per location)
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,
  location_id TEXT,                       -- NULL = applies to all locations
  organization_id TEXT,                   -- NULL = applies to all orgs

  -- Rule definition
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,                -- device_offline, high_cpu, etc.
  conditions JSONB NOT NULL,              -- JSON rule conditions

  -- Notification settings
  notification_channels JSONB,            -- ["email", "sms", "slack"]
  notification_recipients JSONB,          -- ["admin@example.com"]

  -- Status
  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Software versions (for update management)
CREATE TABLE software_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,          -- "1.5.3"
  release_date TIMESTAMP NOT NULL,

  -- Release info
  release_notes TEXT,
  breaking_changes BOOLEAN DEFAULT false,
  security_update BOOLEAN DEFAULT false,

  -- Distribution
  download_url TEXT,
  checksum TEXT,
  file_size_bytes BIGINT,

  -- Status
  status TEXT DEFAULT 'draft',            -- draft, beta, stable, deprecated

  created_at TIMESTAMP DEFAULT NOW()
);

-- Users (central authentication - optional)
CREATE TABLE central_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  -- Profile
  first_name TEXT,
  last_name TEXT,
  phone TEXT,

  -- Access
  role TEXT DEFAULT 'viewer',             -- viewer, manager, admin, superadmin
  organization_id TEXT,                   -- NULL = superadmin
  allowed_locations TEXT[],               -- NULL = all locations in org

  -- Status
  status TEXT DEFAULT 'active',           -- active, inactive, suspended
  last_login_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Sessions (central authentication)
CREATE TABLE central_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES central_users(id) ON DELETE CASCADE
);

-- Job queue (for async tasks)
CREATE TABLE job_queue (
  id SERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,                -- sync_audit_log, send_alert, etc.
  payload JSONB NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending',          -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Timing
  scheduled_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Error handling
  error_message TEXT,

  INDEX idx_status_scheduled (status, scheduled_at)
);
```

### Data Flow Patterns

**Location to Central (Push):**
```typescript
// Every 5 minutes
interface HeartbeatPayload {
  location_id: string;
  timestamp: string;
  metrics: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    uptime_seconds: number;
    devices_total: number;
    devices_online: number;
    devices_offline: number;
    devices_error: number;
  };
  controller_version: string;
  ip_address: string;
}

// Every 15 minutes (batch)
interface AuditLogSyncPayload {
  location_id: string;
  logs: Array<{
    id: string;
    timestamp: string;
    user_id: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: any;
    ip_address: string | null;
  }>;
}

// Immediate (on occurrence)
interface AlertPayload {
  location_id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  title: string;
  message: string;
  metadata?: any;
}
```

**Central to Location (Pull):**
```typescript
// On-demand status check
GET /api/system/status
Response: {
  location_id: string;
  timestamp: string;
  status: {
    system: { cpu: number; memory: number; disk: number; };
    devices: Array<{ id: string; status: string; }>;
    services: { controller: string; database: string; };
  };
}

// Configuration query
GET /api/devices
GET /api/presets
GET /api/schedules
```

---

## Communication Patterns

### Heartbeat System

**Purpose:** Continuous health monitoring and metrics collection

**Location-side Implementation:**
```typescript
// src/lib/central/heartbeat.ts
import { logger } from '@/lib/logger';

interface HeartbeatService {
  start(): void;
  stop(): void;
  sendHeartbeat(): Promise<void>;
}

class CentralHeartbeat implements HeartbeatService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly interval = 5 * 60 * 1000; // 5 minutes

  start() {
    if (this.intervalId) return;

    // Send initial heartbeat
    this.sendHeartbeat();

    // Schedule recurring heartbeats
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);

    logger.info('Heartbeat service started', {
      interval_ms: this.interval
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Heartbeat service stopped');
    }
  }

  async sendHeartbeat() {
    const centralUrl = process.env.CENTRAL_SERVER_URL;
    const apiKey = process.env.CENTRAL_API_KEY;
    const locationId = process.env.LOCATION_ID;

    if (!centralUrl || !apiKey || !locationId) {
      logger.warn('Heartbeat skipped: central server not configured');
      return;
    }

    try {
      const metrics = await this.collectMetrics();

      const response = await fetch(`${centralUrl}/api/locations/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          location_id: locationId,
          timestamp: new Date().toISOString(),
          metrics,
          controller_version: process.env.npm_package_version || 'unknown',
          ip_address: await this.getPublicIP(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.statusText}`);
      }

      logger.debug('Heartbeat sent successfully');
    } catch (error) {
      logger.error('Failed to send heartbeat', { error });
      // Don't throw - just log and continue
    }
  }

  private async collectMetrics() {
    const os = require('os');
    const { db } = await import('@/db');
    const { devices } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // System metrics
    const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    // Device metrics
    const locationId = process.env.LOCATION_ID!;
    const allDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.location_id, locationId));

    const devicesByStatus = allDevices.reduce((acc, device) => {
      acc[device.status] = (acc[device.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      cpu_usage: Math.round(cpuUsage * 100) / 100,
      memory_usage: Math.round(memoryUsage * 100) / 100,
      disk_usage: 0, // TODO: Implement disk usage check
      uptime_seconds: Math.floor(os.uptime()),
      devices_total: allDevices.length,
      devices_online: devicesByStatus['online'] || 0,
      devices_offline: devicesByStatus['offline'] || 0,
      devices_error: devicesByStatus['error'] || 0,
    };
  }

  private async getPublicIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}

export const heartbeat = new CentralHeartbeat();

// Auto-start if central server configured
if (process.env.CENTRAL_SERVER_URL && process.env.CENTRAL_API_KEY) {
  heartbeat.start();
}
```

**Central-side Implementation:**
```typescript
// Central server: app/api/locations/heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { locations, location_heartbeats } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { location_id, timestamp, metrics, controller_version, ip_address } = body;

    // Verify API key matches location
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, location_id),
    });

    if (!location || !verifyApiKey(apiKey, location.api_key_hash)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Update location status
    await db.update(locations)
      .set({
        last_heartbeat_at: new Date(timestamp),
        last_ip_address: ip_address,
        controller_version,
        health_status: determineHealthStatus(metrics),
        updated_at: new Date(),
      })
      .where(eq(locations.id, location_id));

    // Store heartbeat metrics
    await db.insert(location_heartbeats).values({
      location_id,
      timestamp: new Date(timestamp),
      cpu_usage: metrics.cpu_usage,
      memory_usage: metrics.memory_usage,
      disk_usage: metrics.disk_usage,
      uptime_seconds: metrics.uptime_seconds,
      devices_total: metrics.devices_total,
      devices_online: metrics.devices_online,
      devices_offline: metrics.devices_offline,
      devices_error: metrics.devices_error,
      ip_address,
      controller_version,
    });

    // Check alert rules
    await checkAlertRules(location_id, metrics);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function determineHealthStatus(metrics: any): string {
  if (metrics.devices_error > 0) return 'error';
  if (metrics.devices_offline > metrics.devices_total * 0.2) return 'warning';
  if (metrics.cpu_usage > 80 || metrics.memory_usage > 90) return 'warning';
  return 'healthy';
}

function verifyApiKey(provided: string, hash: string): boolean {
  const crypto = require('crypto');
  const providedHash = crypto.createHash('sha256').update(provided).digest('hex');
  return providedHash === hash;
}

async function checkAlertRules(location_id: string, metrics: any) {
  // Implementation: Check alert rules and create alerts if needed
  // Example: If devices_offline > threshold, create alert
}
```

### Audit Log Synchronization

**Purpose:** Aggregate audit logs from all locations for compliance and analysis

**Location-side Implementation:**
```typescript
// src/lib/central/audit-sync.ts
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { eq, gt } from 'drizzle-orm';

class AuditLogSync {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly interval = 15 * 60 * 1000; // 15 minutes
  private lastSyncTimestamp: number = 0;

  start() {
    if (this.intervalId) return;

    // Load last sync timestamp
    this.loadLastSyncTimestamp();

    // Schedule recurring sync
    this.intervalId = setInterval(() => {
      this.syncLogs();
    }, this.interval);

    logger.info('Audit log sync started', {
      interval_ms: this.interval
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Audit log sync stopped');
    }
  }

  private async loadLastSyncTimestamp() {
    // TODO: Store in local config file or database
    this.lastSyncTimestamp = Date.now() - (24 * 60 * 60 * 1000); // Last 24h
  }

  private async syncLogs() {
    const centralUrl = process.env.CENTRAL_SERVER_URL;
    const apiKey = process.env.CENTRAL_API_KEY;
    const locationId = process.env.LOCATION_ID;

    if (!centralUrl || !apiKey || !locationId) {
      logger.warn('Audit sync skipped: central server not configured');
      return;
    }

    try {
      // Get logs since last sync
      const logs = await db
        .select()
        .from(auditLog)
        .where(gt(auditLog.timestamp, this.lastSyncTimestamp))
        .orderBy(auditLog.timestamp);

      if (logs.length === 0) {
        logger.debug('No new audit logs to sync');
        return;
      }

      // Send to central server
      const response = await fetch(`${centralUrl}/api/locations/audit-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          location_id: locationId,
          logs: logs.map(log => ({
            id: log.id,
            timestamp: new Date(log.timestamp).toISOString(),
            user_id: log.userId,
            action: log.action,
            entity_type: log.entityType,
            entity_id: log.entityId,
            details: log.details ? JSON.parse(log.details) : null,
            ip_address: log.ipAddress,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Audit sync failed: ${response.statusText}`);
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = Math.max(...logs.map(l => l.timestamp));
      await this.saveLastSyncTimestamp();

      logger.info('Audit logs synced', {
        count: logs.length,
        last_timestamp: this.lastSyncTimestamp
      });
    } catch (error) {
      logger.error('Failed to sync audit logs', { error });
    }
  }

  private async saveLastSyncTimestamp() {
    // TODO: Store in local config file or database
  }
}

export const auditSync = new AuditLogSync();

// Auto-start if central server configured
if (process.env.CENTRAL_SERVER_URL && process.env.CENTRAL_API_KEY) {
  auditSync.start();
}
```

### Alert Notification System

**Purpose:** Immediately notify central server of critical events

**Location-side Implementation:**
```typescript
// src/lib/central/alerts.ts
import { logger } from '@/lib/logger';

interface AlertPayload {
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  title: string;
  message: string;
  metadata?: any;
}

export async function sendAlert(payload: AlertPayload) {
  const centralUrl = process.env.CENTRAL_SERVER_URL;
  const apiKey = process.env.CENTRAL_API_KEY;
  const locationId = process.env.LOCATION_ID;

  if (!centralUrl || !apiKey || !locationId) {
    // Log locally only
    logger.warn('Alert not sent to central (not configured)', payload);
    return;
  }

  try {
    const response = await fetch(`${centralUrl}/api/locations/alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        location_id: locationId,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Alert failed: ${response.statusText}`);
    }

    logger.info('Alert sent to central', { type: payload.type });
  } catch (error) {
    logger.error('Failed to send alert to central', { error, alert: payload });
    // Don't throw - alert is still logged locally
  }
}

// Usage examples
export const alertExamples = {
  deviceOffline: (deviceId: string, deviceName: string) =>
    sendAlert({
      severity: 'error',
      type: 'device_offline',
      title: 'Device Offline',
      message: `Device ${deviceName} (${deviceId}) is offline`,
      metadata: { device_id: deviceId, device_name: deviceName },
    }),

  systemError: (error: Error) =>
    sendAlert({
      severity: 'critical',
      type: 'system_error',
      title: 'System Error',
      message: error.message,
      metadata: { stack: error.stack },
    }),

  highCpuUsage: (usage: number) =>
    sendAlert({
      severity: 'warning',
      type: 'high_cpu_usage',
      title: 'High CPU Usage',
      message: `CPU usage at ${usage}%`,
      metadata: { cpu_usage: usage },
    }),
};
```

---

## Location Registration Process

### Step-by-Step Registration

**Step 1: Install Controller at New Location**

```bash
# Clone repository
git clone https://github.com/yourusername/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Install dependencies
npm install

# Build the application
npm run build
```

**Step 2: Generate Location API Key (Central Server)**

```typescript
// Central server admin panel or CLI tool
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import crypto from 'crypto';

async function registerLocation(data: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  timezone: string;
  contact_email?: string;
}) {
  // Generate unique location ID
  const locationId = `loc-${crypto.randomBytes(8).toString('hex')}`;

  // Generate API key
  const apiKey = crypto.randomBytes(32).toString('base64url');
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Create location record
  await db.insert(locations).values({
    id: locationId,
    name: data.name,
    slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    address: data.address,
    city: data.city,
    state: data.state,
    timezone: data.timezone,
    contact_email: data.contact_email,
    api_key_hash: apiKeyHash,
    status: 'pending',
  });

  return {
    location_id: locationId,
    api_key: apiKey, // ONLY shown once!
    message: 'Store this API key securely. It cannot be retrieved later.',
  };
}

// Example usage
const result = await registerLocation({
  name: 'Downtown Sports Bar',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  timezone: 'America/New_York',
  contact_email: 'manager@downtown-bar.com',
});

console.log(result);
// {
//   location_id: 'loc-a1b2c3d4e5f6g7h8',
//   api_key: 'xyzABC123...',
//   message: '...'
// }
```

**Step 3: Configure Location Controller**

```bash
# At the location server
cd Sports-Bar-TV-Controller

# Create environment file
cp .env.example .env.local
nano .env.local

# Set configuration:
LOCATION_ID=loc-a1b2c3d4e5f6g7h8
LOCATION_NAME="Downtown Sports Bar"
CENTRAL_SERVER_URL=https://central.sportsbarcontrol.com
CENTRAL_API_KEY=xyzABC123...

# Database
DATABASE_URL=file:./data/sports-bar.db

# Optional: Local timezone
TZ=America/New_York

# Save and exit
```

**Step 4: Start Services**

```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Check logs
pm2 logs sports-bar-tv-controller

# Verify heartbeat is working
# Should see: "Heartbeat sent successfully" in logs
```

**Step 5: Verify Registration (Central Dashboard)**

```
1. Login to central dashboard
2. Navigate to Locations
3. Find newly registered location
4. Status should change from "pending" to "active" after first heartbeat
5. Verify metrics are being received
```

### Automated Registration Script

**For franchises with many locations:**

```bash
#!/bin/bash
# register-location.sh

# Usage: ./register-location.sh "Bar Name" "address" "city" "state" "email"

CENTRAL_API="https://central.sportsbarcontrol.com/api/admin"
ADMIN_TOKEN="your-admin-token"

curl -X POST "$CENTRAL_API/locations/register" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$1\",
    \"address\": \"$2\",
    \"city\": \"$3\",
    \"state\": \"$4\",
    \"contact_email\": \"$5\",
    \"timezone\": \"America/New_York\"
  }" \
  | jq '.'

# Save response to file for later reference
```

---

## Central Management Dashboard

### Dashboard Pages and Features

#### 1. Overview Dashboard

**URL:** `/dashboard`

**Features:**
- Map view showing all locations with status indicators
- Summary cards: Total locations, Online/Offline, Alerts, Devices
- Recent alerts feed
- System health overview

**Wireframe (ASCII):**
```
┌────────────────────────────────────────────────────────────┐
│  Sports Bar TV Controller - Central Dashboard              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  [25 Locations]  [23 Online]  [2 Offline]  [3 Alerts]     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Location Map                          │   │
│  │   🗺️                                               │   │
│  │     📍 Location 1 (Green)                          │   │
│  │     📍 Location 2 (Green)                          │   │
│  │     📍 Location 3 (Red - Offline)                  │   │
│  │     ...                                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent Alerts:                                             │
│  ⚠️ Location 3: Controller offline (5 min ago)            │
│  ⚠️ Location 7: Device TV-5 offline (1 hour ago)          │
│  ℹ️ Location 2: Software update available (2 hours ago)   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### 2. Locations List

**URL:** `/dashboard/locations`

**Features:**
- Sortable/filterable table of all locations
- Status indicators (online/offline/warning)
- Quick actions (view details, SSH, remote support)
- Bulk operations (push config, schedule update)

**Table Columns:**
- Name
- City/State
- Status
- Devices (online/offline)
- Last Heartbeat
- Version
- Actions

#### 3. Individual Location Detail

**URL:** `/dashboard/locations/[id]`

**Features:**

**Status Tab:**
- Real-time device status
- System metrics (CPU, memory, disk)
- Network information
- Uptime

**Devices Tab:**
- List of all devices at location
- Device status and health
- Quick controls (if remote control enabled)

**Audit Log Tab:**
- Recent actions at this location
- Filterable by date, user, action type
- Export to CSV

**Metrics Tab:**
- Historical performance charts
- Device uptime trends
- Alert history

**Settings Tab:**
- Location details (edit)
- Alert configurations
- Software update settings
- Remote access controls

#### 4. Alerts Page

**URL:** `/dashboard/alerts`

**Features:**
- All alerts across all locations
- Filter by: severity, location, status, date range
- Bulk acknowledge/resolve
- Alert rule configuration

**Alert Types:**
- Device offline
- System error
- High CPU/memory usage
- Heartbeat missed
- Software update required
- Custom alerts from alert rules

#### 5. Reports Page

**URL:** `/dashboard/reports`

**Features:**
- Cross-location analytics
- Device uptime reports
- Most common issues
- Software version compliance
- Location comparison
- Export reports to PDF/CSV

**Report Examples:**
- "Which locations have the most downtime?"
- "Which devices fail most often?"
- "Software version distribution"
- "Alert frequency by location"

#### 6. Software Updates

**URL:** `/dashboard/updates`

**Features:**
- Latest version information
- Rollout status across locations
- Schedule updates for locations
- Rollback capability
- Release notes

#### 7. Users & Access (Optional)

**URL:** `/dashboard/users`

**Features:**
- User management
- Role-based access control
- Per-location permissions
- Activity audit log
- API key management

**Roles:**
- **Viewer**: Read-only access
- **Manager**: Can modify configurations at assigned locations
- **Admin**: Full access to assigned organization
- **Superadmin**: Full access to all organizations

#### 8. Settings

**URL:** `/dashboard/settings`

**Features:**
- Organization settings
- Alert notification preferences
- API configuration
- Billing information (if SaaS)
- Integrations (Slack, email, SMS)

### Implementation Example (Next.js)

**Dashboard Layout:**
```typescript
// app/dashboard/layout.tsx
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Overview Dashboard:**
```typescript
// app/dashboard/page.tsx
import { db } from '@/lib/db';
import { locations, location_heartbeats, alerts } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { LocationMap } from '@/components/dashboard/location-map';
import { AlertsFeed } from '@/components/dashboard/alerts-feed';
import { MetricsCards } from '@/components/dashboard/metrics-cards';

export default async function DashboardPage() {
  // Fetch all locations with latest heartbeat
  const allLocations = await db.query.locations.findMany({
    with: {
      latestHeartbeat: {
        orderBy: desc(location_heartbeats.timestamp),
        limit: 1,
      },
    },
  });

  // Calculate metrics
  const total = allLocations.length;
  const online = allLocations.filter(
    loc => loc.health_status === 'healthy'
  ).length;
  const offline = allLocations.filter(
    loc => loc.health_status === 'offline'
  ).length;

  // Fetch recent alerts
  const recentAlerts = await db.query.alerts.findMany({
    where: eq(alerts.status, 'open'),
    orderBy: desc(alerts.timestamp),
    limit: 10,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard Overview</h1>

      <MetricsCards
        total={total}
        online={online}
        offline={offline}
        alerts={recentAlerts.length}
      />

      <LocationMap locations={allLocations} />

      <AlertsFeed alerts={recentAlerts} />
    </div>
  );
}
```

---

## Network Architecture

### Scenario 1: VPN-Based Private Network

**Best for:** Maximum security, corporate deployments

**Architecture:**
```
                  ┌─────────────────────┐
                  │  Central Server     │
                  │  10.0.0.1           │
                  │  (VPN Hub)          │
                  └──────────┬──────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼──────┐    ┌─────▼──────┐    ┌─────▼──────┐
    │ Location 1 │    │ Location 2 │    │ Location 3 │
    │ 10.0.0.10  │    │ 10.0.0.11  │    │ 10.0.0.12  │
    │ (VPN)      │    │ (VPN)      │    │ (VPN)      │
    └────────────┘    └────────────┘    └────────────┘
    │              │              │
    192.168.5.0/24  192.168.6.0/24  192.168.7.0/24
    (Local network) (Local network) (Local network)
```

**Setup:**

**Option A: Tailscale (Easiest)**
```bash
# Central server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Each location
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# All devices now on private network (100.x.x.x)
# Central server: 100.64.0.1
# Location 1: 100.64.0.10
# Location 2: 100.64.0.11
```

**Option B: WireGuard**
```bash
# Central server acts as VPN hub
# Each location connects to central
# See SSH_ACCESS_SETUP.md for WireGuard setup
```

**Pros:**
- Maximum security (encrypted tunnel)
- Private IP addresses
- No public exposure
- NAT traversal (Tailscale)
- Works behind firewalls

**Cons:**
- Requires VPN setup at each location
- Additional complexity
- Network dependency
- May require static IPs or dynamic DNS

### Scenario 2: Public Central Server with API Authentication

**Best for:** SaaS deployment, franchises, managed services

**Architecture:**
```
                      Internet
                         │
                ┌────────▼────────┐
                │  Central Server │
                │  (Public HTTPS) │
                │  central.example.com
                └────────┬────────┘
                         │ API calls over HTTPS
                         │ (Bearer token auth)
        ┌────────────────┼────────────────┐
        │                │                │
  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
  │ Location 1 │  │ Location 2 │  │ Location 3 │
  │ (NAT)      │  │ (NAT)      │  │ (NAT)      │
  │ Outbound   │  │ Outbound   │  │ Outbound   │
  │ HTTPS only │  │ HTTPS only │  │ HTTPS only │
  └────────────┘  └────────────┘  └────────────┘
```

**Setup:**

**Central Server:**
```bash
# Deploy to cloud provider (Vercel, Railway, AWS)
# Configure domain with SSL certificate
# Expose API endpoints:
# - POST /api/locations/heartbeat
# - POST /api/locations/audit-log
# - POST /api/locations/alert
```

**Each Location:**
```bash
# Configure central server URL
CENTRAL_SERVER_URL=https://central.example.com
CENTRAL_API_KEY=<unique-api-key-per-location>

# Controller makes HTTPS requests to central
# No inbound ports needed
# Works behind NAT/firewall
```

**Pros:**
- Simple setup (no VPN)
- Works behind NAT
- No port forwarding needed
- Easy to deploy
- Standard HTTPS security

**Cons:**
- Central server must be publicly accessible
- Need proper API rate limiting
- Need robust authentication
- DDoS protection required
- Central server is single point of failure (but locations continue working)

### Scenario 3: Hybrid (Public API + SSH Tunnels)

**Best for:** Maximum flexibility, secure remote control

**Architecture:**
```
                ┌─────────────────────┐
                │  Central Server     │
                │  (Public API)       │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │ HTTPS (metrics)  │                  │
        │                  │                  │
  ┌─────▼──────┐    ┌─────▼──────┐    ┌─────▼──────┐
  │ Location 1 │    │ Location 2 │    │ Location 3 │
  └────────────┘    └────────────┘    └────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                 SSH Reverse Tunnel (optional)
                 For remote management
```

**Setup:**

**Normal operation:** Locations push metrics via HTTPS
**Remote management needed:** Establish SSH tunnel

```bash
# From location (when support needed)
ssh -R 3000:localhost:3000 support@central.example.com

# Now central server can access location's web interface:
# http://localhost:3000 (on central server)
```

**Pros:**
- Combines security of tunnels with simplicity of HTTPS
- No permanent VPN needed
- On-demand remote access
- Flexible deployment

**Cons:**
- More complex setup
- Two communication methods to maintain

### Network Configuration Checklist

**At Each Location:**
- [ ] Static IP on local network (recommended)
- [ ] Firewall allows outbound HTTPS (443)
- [ ] If VPN: Firewall allows VPN protocol
- [ ] If SSH tunnels: SSH port accessible
- [ ] Local network configured (e.g., 192.168.5.0/24)

**Central Server:**
- [ ] Public IP or domain name
- [ ] SSL certificate configured (Let's Encrypt)
- [ ] Firewall configured (allow 443, deny all else)
- [ ] DDoS protection enabled
- [ ] Rate limiting configured
- [ ] Database backups automated

---

## Failover and Independence

### Location Independence Principle

**Core Principle:** Each location must operate fully independently, even if the central server is unreachable.

**Implementation:**

```typescript
// src/lib/central/resilient-client.ts
class ResilientCentralClient {
  private queue: Array<QueuedRequest> = [];
  private isOnline: boolean = true;

  async send(endpoint: string, data: any) {
    try {
      const response = await fetch(
        `${process.env.CENTRAL_SERVER_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CENTRAL_API_KEY}`,
          },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(10000), // 10s timeout
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }

      // If we were offline, process queue
      if (!this.isOnline) {
        this.isOnline = true;
        await this.processQueue();
      }

      return await response.json();
    } catch (error) {
      // Mark as offline
      this.isOnline = false;

      // Queue request for later
      this.queue.push({
        endpoint,
        data,
        timestamp: Date.now(),
      });

      // Persist queue to disk
      await this.saveQueue();

      logger.warn('Central server unreachable, request queued', {
        endpoint,
        queue_size: this.queue.length,
      });
    }
  }

  private async processQueue() {
    logger.info('Processing queued requests', {
      count: this.queue.length
    });

    const queue = [...this.queue];
    this.queue = [];

    for (const request of queue) {
      try {
        await this.send(request.endpoint, request.data);
      } catch (error) {
        // Re-queue failed requests
        this.queue.push(request);
      }
    }

    await this.saveQueue();
  }

  private async saveQueue() {
    // Save queue to local file for persistence across restarts
    const fs = require('fs').promises;
    await fs.writeFile(
      './data/central-queue.json',
      JSON.stringify(this.queue, null, 2)
    );
  }

  async loadQueue() {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile('./data/central-queue.json', 'utf-8');
      this.queue = JSON.parse(data);
      logger.info('Loaded queued requests', { count: this.queue.length });
    } catch {
      this.queue = [];
    }
  }
}

export const centralClient = new ResilientCentralClient();
```

### Offline Behavior

**What Continues to Work:**
- All device control (TVs, matrix, Fire TV, audio)
- Web interface access
- Scheduling
- Presets
- Local authentication
- Audit logging (local)

**What Doesn't Work:**
- Central dashboard updates
- Cross-location features
- Remote monitoring
- Centralized reporting
- Remote control from central

**Recovery:**
```
1. Central server comes back online
2. Location detects connectivity restored
3. Queued requests are sent (heartbeats, audit logs, alerts)
4. Central server updates with missed data
5. Normal operation resumes
```

### Data Sync on Reconnection

```typescript
// When connection restored
async function syncAfterReconnection() {
  const offlineDuration = Date.now() - lastSuccessfulHeartbeat;

  logger.info('Reconnected to central server', {
    offline_duration_seconds: Math.floor(offlineDuration / 1000)
  });

  // Send batch sync request
  await centralClient.send('/api/locations/sync', {
    location_id: process.env.LOCATION_ID,
    offline_duration_seconds: Math.floor(offlineDuration / 1000),

    // Audit logs from offline period
    queued_audit_logs: await getAuditLogsSince(lastSuccessfulHeartbeat),

    // Metrics snapshots
    queued_metrics: await getMetricsHistory(lastSuccessfulHeartbeat),

    // Current status
    current_status: await getCurrentStatus(),
  });

  logger.info('Sync completed');
}
```

### High Availability for Central Server

**For production deployments:**

**Database:**
- Use managed PostgreSQL with automatic failover (AWS RDS, Supabase)
- Regular automated backups
- Point-in-time recovery

**Application:**
- Deploy to multiple regions (if needed)
- Load balancer
- Health checks
- Auto-restart on failure

**Monitoring:**
- Uptime monitoring (UptimeRobot, Pingdom)
- Alert on central server downtime
- Automated failover to backup region

---

## Software Updates

### Centralized Update Management

**Workflow:**

```
1. New version released
2. Central server notified of new version
3. Central tracks which locations have which versions
4. Admin schedules updates for locations
5. Locations check for updates on heartbeat
6. Locations download and install during maintenance window
7. Locations report new version to central
8. Central tracks rollout progress
```

### Version Tracking

**Central Server:**
```typescript
// app/api/admin/software-versions/route.ts
import { db } from '@/lib/db';
import { software_versions, locations } from '@/lib/db/schema';

export async function POST(req: Request) {
  const body = await req.json();
  const { version, release_notes, download_url, checksum } = body;

  // Create new version record
  await db.insert(software_versions).values({
    id: `ver-${Date.now()}`,
    version,
    release_date: new Date(),
    release_notes,
    download_url,
    checksum,
    status: 'stable',
  });

  return Response.json({ success: true });
}

export async function GET(req: Request) {
  // Get version distribution
  const locationsWithVersions = await db.query.locations.findMany({
    columns: {
      controller_version: true,
    },
  });

  const versionCounts = locationsWithVersions.reduce((acc, loc) => {
    const version = loc.controller_version || 'unknown';
    acc[version] = (acc[version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Response.json({
    versions: await db.select().from(software_versions),
    distribution: versionCounts,
  });
}
```

**Location Client:**
```typescript
// src/lib/central/update-checker.ts
import { logger } from '@/lib/logger';
import { execSync } from 'child_process';

class UpdateChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly interval = 60 * 60 * 1000; // Check hourly

  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.interval);

    logger.info('Update checker started');
  }

  private async checkForUpdates() {
    const centralUrl = process.env.CENTRAL_SERVER_URL;
    const apiKey = process.env.CENTRAL_API_KEY;

    if (!centralUrl || !apiKey) return;

    try {
      const currentVersion = process.env.npm_package_version;

      const response = await fetch(
        `${centralUrl}/api/locations/check-update`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      const data = await response.json();

      if (data.update_available) {
        logger.info('Update available', {
          current: currentVersion,
          latest: data.latest_version,
          release_notes: data.release_notes,
        });

        // Trigger alert
        await sendAlert({
          severity: 'info',
          type: 'update_available',
          title: 'Software Update Available',
          message: `Version ${data.latest_version} is available`,
          metadata: {
            current_version: currentVersion,
            latest_version: data.latest_version,
            download_url: data.download_url,
          },
        });

        // Auto-update if configured
        if (process.env.AUTO_UPDATE === 'true') {
          await this.performUpdate(data.download_url, data.checksum);
        }
      }
    } catch (error) {
      logger.error('Failed to check for updates', { error });
    }
  }

  private async performUpdate(downloadUrl: string, expectedChecksum: string) {
    logger.info('Starting automatic update', { url: downloadUrl });

    try {
      // Download update package
      const response = await fetch(downloadUrl);
      const buffer = await response.arrayBuffer();

      // Verify checksum
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(Buffer.from(buffer));
      const actualChecksum = hash.digest('hex');

      if (actualChecksum !== expectedChecksum) {
        throw new Error('Checksum mismatch - update aborted');
      }

      // Extract and install (implementation depends on packaging)
      // This is a simplified example
      const fs = require('fs');
      const tar = require('tar');

      // Backup current version
      execSync('cp -r . ../backup-$(date +%Y%m%d-%H%M%S)');

      // Extract update
      await tar.extract({
        file: './update.tar.gz',
        cwd: '.',
      });

      // Install dependencies
      execSync('npm install --production');

      // Rebuild
      execSync('npm run build');

      // Restart application
      execSync('pm2 restart sports-bar-tv-controller');

      logger.info('Update completed successfully');

      await sendAlert({
        severity: 'info',
        type: 'update_completed',
        title: 'Software Updated',
        message: 'System updated and restarted successfully',
      });
    } catch (error) {
      logger.error('Update failed', { error });

      await sendAlert({
        severity: 'error',
        type: 'update_failed',
        title: 'Software Update Failed',
        message: `Update failed: ${error.message}`,
      });

      // Attempt rollback
      // execSync('pm2 restart sports-bar-tv-controller');
    }
  }
}

export const updateChecker = new UpdateChecker();
```

### Manual Update Process

**For locations that prefer manual control:**

```bash
# SSH into location
ssh sports-bar

# Check current version
cd Sports-Bar-TV-Controller
git status
npm version

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart
pm2 restart sports-bar-tv-controller

# Verify
pm2 logs sports-bar-tv-controller
```

---

## Pricing and Licensing Considerations

### Licensing Models

**Option 1: Per-Location Licensing**
```
Basic Tier:    $49/month per location
Pro Tier:      $99/month per location
Enterprise:    Custom pricing

Features by tier:
- Basic: Up to 25 devices, basic monitoring
- Pro: Unlimited devices, advanced features, priority support
- Enterprise: White-label, custom integration, dedicated support
```

**Option 2: Tiered by Total Locations**
```
2-5 locations:    $199/month total
6-10 locations:   $399/month total
11-25 locations:  $799/month total
26-50 locations:  $1,499/month total
51+ locations:    Custom pricing
```

**Option 3: Franchise Model**
```
Franchise License: $10,000 one-time
- Unlimited locations under franchise
- White-label dashboard
- Custom branding
- Dedicated support

Plus per-location: $29/month
- Central monitoring
- Updates and maintenance
```

### License Enforcement

**Implementation:**
```typescript
// Central server
interface LicenseStatus {
  location_id: string;
  tier: 'basic' | 'pro' | 'enterprise';
  features_enabled: string[];
  expires_at: string;
  devices_allowed: number;
  status: 'active' | 'expired' | 'suspended';
}

// API endpoint
export async function GET(req: Request) {
  const locationId = req.headers.get('X-Location-ID');
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');

  // Verify authentication
  const location = await verifyLocation(locationId, apiKey);
  if (!location) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check license status
  const license = await db.query.licenses.findFirst({
    where: eq(licenses.location_id, locationId),
  });

  if (!license || new Date(license.expires_at) < new Date()) {
    return Response.json({
      status: 'expired',
      message: 'License expired. Please contact support.',
    });
  }

  return Response.json({
    location_id: locationId,
    tier: license.tier,
    features_enabled: getLicensedFeatures(license.tier),
    expires_at: license.expires_at,
    devices_allowed: license.devices_allowed,
    status: 'active',
  });
}

function getLicensedFeatures(tier: string): string[] {
  const features = {
    basic: ['device_control', 'basic_scheduling'],
    pro: ['device_control', 'advanced_scheduling', 'multi_zone_audio', 'analytics'],
    enterprise: ['device_control', 'advanced_scheduling', 'multi_zone_audio', 'analytics', 'api_access', 'custom_integration'],
  };

  return features[tier] || features.basic;
}
```

**Location Client:**
```typescript
// Check license on startup and periodically
async function checkLicense() {
  const response = await fetch(
    `${process.env.CENTRAL_SERVER_URL}/api/locations/license-status`,
    {
      headers: {
        'X-Location-ID': process.env.LOCATION_ID!,
        'Authorization': `Bearer ${process.env.CENTRAL_API_KEY}`,
      },
    }
  );

  const license = await response.json();

  if (license.status === 'expired') {
    // Disable pro features, show warning
    logger.warn('License expired', { expires_at: license.expires_at });
    // Continue basic operation
  }

  // Store licensed features
  global.licensedFeatures = license.features_enabled;

  return license;
}

// Check if feature is licensed
export function isFeatureLicensed(feature: string): boolean {
  return global.licensedFeatures?.includes(feature) ?? false;
}

// Usage
if (isFeatureLicensed('multi_zone_audio')) {
  // Enable multi-zone audio feature
}
```

### Billing Integration

**For SaaS model, integrate with Stripe:**

```typescript
// Central server: Stripe webhook
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')!;
  const payload = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  return Response.json({ received: true });
}

async function handleSubscriptionUpdate(subscription: any) {
  const locationId = subscription.metadata.location_id;

  await db.update(licenses)
    .set({
      tier: subscription.items.data[0].price.metadata.tier,
      expires_at: new Date(subscription.current_period_end * 1000),
      status: 'active',
    })
    .where(eq(licenses.location_id, locationId));
}
```

---

## Security Considerations

### Authentication

**Location-to-Central Authentication:**
```typescript
// Each location has unique API key
// API key is hashed and stored in central database
// API key is sent with every request

// Central server validates:
async function authenticateLocation(req: Request) {
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    throw new UnauthorizedError('Missing API key');
  }

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const location = await db.query.locations.findFirst({
    where: eq(locations.api_key_hash, hash),
  });

  if (!location) {
    throw new UnauthorizedError('Invalid API key');
  }

  if (location.status !== 'active') {
    throw new ForbiddenError('Location suspended');
  }

  return location;
}
```

**Dashboard Authentication:**
```typescript
// Use JWT tokens for dashboard users
// Implement proper session management
// See existing authentication system in src/lib/auth/
```

### Data Privacy

**Considerations:**
- Location data stays at location (GDPR compliance)
- Only metadata and metrics sent to central
- Audit logs may contain PII (handle carefully)
- Right to be forgotten (delete location data)

**Implementation:**
```typescript
// Only send necessary data to central
// Never send: device credentials, local user passwords, sensitive config
// Always encrypt in transit (HTTPS/TLS)
// Consider encryption at rest for sensitive data
```

### Network Security

**API Rate Limiting:**
```typescript
// Central server: Rate limit per location
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
  analytics: true,
});

export async function middleware(req: Request) {
  const locationId = req.headers.get('X-Location-ID');

  const { success } = await ratelimit.limit(locationId);

  if (!success) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Continue
}
```

**DDoS Protection:**
- Use Cloudflare or AWS Shield
- Implement request size limits
- Validate all inputs
- Use prepared statements (SQL injection prevention)

**Audit All Access:**
```typescript
// Log all API requests
logger.info('API request', {
  location_id: locationId,
  endpoint: req.url,
  method: req.method,
  ip: req.headers.get('x-forwarded-for'),
  timestamp: new Date().toISOString(),
});
```

---

## Migration Path

### Phase 1: Current State (Single Location)

**Status:** ✅ Complete

**What We Have:**
- Fully functional single-location controller
- Database schema supports multi-location
- Environment configuration for location_id

**What Works:**
- All device control
- Web interface
- Scheduling and presets
- Local authentication
- Audit logging

### Phase 2: Manual Multi-Location (2-3 Locations)

**Timeline:** Months 1-3
**Effort:** ~40 hours

**Tasks:**
1. ✅ Document location_id setup (2 hours)
2. ✅ Create deployment guide (4 hours)
3. Test multi-location with different location_ids (8 hours)
4. Create location registration docs (4 hours)
5. Setup guide for network isolation (4 hours)
6. Create management scripts (8 hours)
7. Documentation and training (8 hours)
8. Contingency (2 hours)

**Deliverables:**
- Deployment checklist
- Location configuration template
- Network setup guide
- Admin training materials

**Cost Estimate:**
- Development: $4,000 (40 hours × $100/hr)
- Testing: Included
- Documentation: Included

### Phase 3: Central Dashboard with Monitoring (3-10 Locations)

**Timeline:** Months 3-6
**Effort:** ~120 hours

**Tasks:**
1. Design central database schema (8 hours)
2. Implement central server API (24 hours)
   - Location registration endpoint
   - Heartbeat endpoint
   - Audit log sync endpoint
   - Alert endpoint
3. Build dashboard frontend (32 hours)
   - Overview page
   - Location list
   - Location detail pages
   - Alerts page
4. Implement location client (16 hours)
   - Heartbeat service
   - Audit log sync
   - Alert sender
   - Resilient client with queue
5. Deploy central server (8 hours)
   - Setup hosting
   - Configure database
   - Setup monitoring
6. Testing (16 hours)
   - Integration testing
   - Load testing
   - Failover testing
7. Documentation (12 hours)
8. Contingency (4 hours)

**Deliverables:**
- Central server deployed
- Dashboard accessible
- Real-time monitoring
- Alert system
- Migration guide

**Cost Estimate:**
- Development: $12,000 (120 hours × $100/hr)
- Infrastructure: $100/month (hosting + database)
- Testing: Included

### Phase 4: Full Central Management (10-50 Locations)

**Timeline:** Months 6-12
**Effort:** ~200 hours

**Tasks:**
1. Implement bi-directional communication (24 hours)
2. Remote configuration push (24 hours)
3. Software update management (24 hours)
4. Advanced reporting and analytics (32 hours)
5. User management and RBAC (24 hours)
6. API for third-party integrations (16 hours)
7. Performance optimization (16 hours)
8. Advanced alerting rules (16 hours)
9. Testing and QA (16 hours)
10. Documentation (8 hours)

**Deliverables:**
- Remote control capabilities
- Centralized user management
- Update management system
- Cross-location reporting
- API documentation

**Cost Estimate:**
- Development: $20,000 (200 hours × $100/hr)
- Infrastructure: $200/month (scaled hosting)

### Phase 5: Franchise Ready (50+ Locations)

**Timeline:** Year 2+
**Effort:** ~300 hours

**Tasks:**
1. Multi-tenant architecture (40 hours)
2. White-label dashboard (32 hours)
3. Billing integration (24 hours)
4. Advanced analytics and ML (40 hours)
5. Mobile app (80 hours)
6. Support portal (24 hours)
7. Marketplace/integrations (32 hours)
8. Enterprise features (16 hours)
9. Testing and QA (8 hours)
10. Documentation (4 hours)

**Deliverables:**
- Multi-tenant system
- White-label capabilities
- Billing integration
- Mobile app
- Support portal
- Marketplace

**Cost Estimate:**
- Development: $30,000 (300 hours × $100/hr)
- Infrastructure: $500/month (enterprise hosting)
- Third-party services: $200/month (Stripe, Twilio, etc.)

---

## Technology Stack for Central

### Recommended Stack

**Frontend:**
```
Framework: Next.js 14+ (App Router)
UI Library: React 18+
Styling: Tailwind CSS
Components: shadcn/ui
Charts: Recharts or Chart.js
Maps: Mapbox GL JS or Google Maps API
State Management: React Query (TanStack Query)
Forms: React Hook Form + Zod
```

**Backend:**
```
Framework: Next.js API Routes
Database: PostgreSQL 15+ (managed service)
ORM: Drizzle ORM
Caching: Redis (Upstash)
Job Queue: BullMQ or Inngest
Authentication: NextAuth.js or Clerk
```

**Infrastructure:**
```
Hosting: Vercel or Railway
Database: Supabase, Neon, or AWS RDS
Redis: Upstash Redis
File Storage: S3 or Cloudflare R2
CDN: Cloudflare or Vercel Edge
Monitoring: Datadog, Logtail, or Better Stack
Alerts: Twilio (SMS), SendGrid (Email), Slack
```

**DevOps:**
```
CI/CD: GitHub Actions
Version Control: Git + GitHub
Error Tracking: Sentry
Logging: Logtail or Datadog
Uptime Monitoring: UptimeRobot or Pingdom
```

### Database Choice

**PostgreSQL Managed Services Comparison:**

| Service | Cost (10GB) | Backups | Scaling | Notes |
|---------|-------------|---------|---------|-------|
| Supabase | $25/mo | Auto | Easy | Includes auth, storage |
| Neon | $20/mo | Auto | Instant | Serverless, pay-per-use |
| AWS RDS | $50/mo | Manual | Medium | Enterprise-grade |
| Railway | $20/mo | Auto | Easy | All-in-one platform |

**Recommendation:** Supabase or Neon for Phase 3-4, AWS RDS for Phase 5

### Hosting Choice

**Comparison:**

| Platform | Cost (Small) | Ease | Features | Best For |
|----------|--------------|------|----------|----------|
| Vercel | $20/mo | Easiest | Edge, CDN, Analytics | Next.js apps (optimal) |
| Railway | $20/mo | Easy | Database + App | All-in-one solution |
| AWS | $50/mo | Hard | Everything | Enterprise, full control |
| DigitalOcean | $25/mo | Medium | VPS, databases | Cost-conscious |

**Recommendation:** Vercel for simplicity, Railway for all-in-one, AWS for enterprise

---

## Implementation Timeline

### Detailed Timeline

**Phase 2: Manual Multi-Location (Weeks 1-12)**

| Week | Task | Hours | Status |
|------|------|-------|--------|
| 1-2 | Documentation and guides | 16 | Not started |
| 3-4 | Testing with multiple location_ids | 8 | Not started |
| 5-6 | Network configuration and security | 8 | Not started |
| 7-8 | Management scripts and automation | 8 | Not started |

**Phase 3: Central Dashboard (Weeks 13-36)**

| Week | Task | Hours | Status |
|------|------|-------|--------|
| 13-14 | Central database schema design | 8 | Not started |
| 15-18 | Central API implementation | 24 | Not started |
| 19-26 | Dashboard frontend development | 32 | Not started |
| 27-30 | Location client implementation | 16 | Not started |
| 31-32 | Central server deployment | 8 | Not started |
| 33-35 | Integration testing | 16 | Not started |
| 36 | Documentation | 12 | Not started |

**Phase 4: Full Management (Weeks 37-88)**

| Month | Focus | Hours |
|-------|-------|-------|
| 7-8 | Bi-directional communication | 48 |
| 9-10 | Remote management features | 48 |
| 11-12 | Advanced features and polish | 48 |

---

## Cost Analysis

### Development Costs Summary

| Phase | Timeline | Dev Hours | Dev Cost | Infrastructure | Total |
|-------|----------|-----------|----------|----------------|-------|
| Phase 2 | Months 1-3 | 40 | $4,000 | $0 | $4,000 |
| Phase 3 | Months 3-6 | 120 | $12,000 | $300 | $12,300 |
| Phase 4 | Months 6-12 | 200 | $20,000 | $1,200 | $21,200 |
| Phase 5 | Year 2+ | 300 | $30,000 | $8,400 | $38,400 |
| **Total** | **2 years** | **660** | **$66,000** | **$9,900** | **$75,900** |

### Ongoing Operational Costs

**Phase 3 (3-10 locations):**
- Hosting: $20/month (Vercel)
- Database: $25/month (Supabase)
- Redis: $10/month (Upstash)
- Monitoring: $20/month (Logtail)
- **Total: $75/month**

**Phase 4 (10-50 locations):**
- Hosting: $50/month (scaled)
- Database: $50/month (larger tier)
- Redis: $20/month
- Monitoring: $50/month
- Alerts: $30/month (Twilio credits)
- **Total: $200/month**

**Phase 5 (50+ locations):**
- Hosting: $200/month
- Database: $200/month
- Redis: $50/month
- Monitoring: $100/month
- Alerts: $100/month
- Support: $150/month
- **Total: $800/month**

### Revenue Potential

**Scenario 1: 10 Locations @ $99/month**
- Revenue: $990/month ($11,880/year)
- Costs: $200/month ($2,400/year)
- Profit: $790/month ($9,480/year)
- Break-even: Month 8 (after Phase 3 investment)

**Scenario 2: 50 Locations @ $99/month**
- Revenue: $4,950/month ($59,400/year)
- Costs: $800/month ($9,600/year)
- Profit: $4,150/month ($49,800/year)
- Break-even: Month 18 (after Phase 4 investment)

**Scenario 3: 100 Locations @ $79/month** (volume discount)
- Revenue: $7,900/month ($94,800/year)
- Costs: $1,200/month ($14,400/year)
- Profit: $6,700/month ($80,400/year)

---

## Future Enhancements

### Phase 6+ Features

**1. Mobile App (Native or React Native)**
- View all locations
- Quick device control
- Alert notifications
- Emergency controls
- Timeline: 6 months, $40,000

**2. Machine Learning Optimizations**
- Predictive scheduling (learn viewing patterns)
- Optimal volume levels (crowd size detection)
- Content recommendations
- Timeline: 3 months, $15,000

**3. Predictive Maintenance**
- Detect failing devices before they fail
- Maintenance scheduling
- Parts ordering integration
- Timeline: 3 months, $15,000

**4. Customer-Facing Features**
- Song requests (jukebox style)
- Game voting (which game to show)
- Sports notifications
- Table-specific controls (QR code)
- Timeline: 4 months, $20,000

**5. Integration Marketplace**
- Third-party integrations
- Zapier/Make.com connectors
- Custom webhooks
- API documentation portal
- Timeline: 2 months, $10,000

**6. Advanced Analytics**
- Device usage patterns
- Cost optimization reports
- Energy consumption tracking
- ROI calculations
- Timeline: 2 months, $10,000

**7. Multi-Language Support**
- Dashboard in multiple languages
- International expansion
- Localization
- Timeline: 2 months, $10,000

**8. Franchise Management**
- Franchise onboarding portal
- Training materials
- Brand compliance monitoring
- Location comparison tools
- Timeline: 4 months, $20,000

---

## Conclusion

### Key Takeaways

**Architecture is Ready:**
- Current system supports multi-location
- Database schema includes location_id
- Clean separation of concerns

**Phased Approach:**
- Start simple (manual multi-location)
- Add monitoring (central dashboard)
- Evolve to full management
- Scale to franchise level

**Investment Required:**
- Phase 2-3: $16,300 (basic multi-location)
- Phase 4: $21,200 (full management)
- Phase 5: $38,400 (franchise ready)
- Total: $75,900 over 2 years

**Revenue Potential:**
- 10 locations: $9,480/year profit
- 50 locations: $49,800/year profit
- 100 locations: $80,400/year profit

**Next Steps:**
1. Validate market demand (talk to multi-location owners)
2. Implement Phase 2 (manual multi-location)
3. Deploy to 2-3 pilot locations
4. Gather feedback
5. Build Phase 3 (central dashboard)
6. Scale based on demand

---

## Support and Resources

### Documentation References
- Single Location Setup: `/docs/README.md`
- SSH Access: `/docs/SSH_ACCESS_SETUP.md`
- API Documentation: `/docs/API.md`
- Database Schema: `/src/db/schema.ts`

### External Resources
- Next.js Documentation: https://nextjs.org/docs
- Drizzle ORM: https://orm.drizzle.team/
- PostgreSQL Best Practices: https://wiki.postgresql.org/wiki/Don%27t_Do_This
- Vercel Deployment: https://vercel.com/docs

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-04 | Initial architecture documentation |

---

**Document Owner**: System Architect
**Last Reviewed**: 2025-11-04
**Next Review**: 2026-02-04
