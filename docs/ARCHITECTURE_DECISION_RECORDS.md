# Architecture Decision Records (ADR)

**Sports-Bar-TV-Controller Architectural Decisions**

Last Updated: November 6, 2025

---

## Table of Contents

1. [ADR Format](#adr-format)
2. [ADR-001: Next.js App Router over Pages Router](#adr-001-nextjs-app-router-over-pages-router)
3. [ADR-002: Drizzle ORM over Prisma](#adr-002-drizzle-orm-over-prisma)
4. [ADR-003: SQLite over PostgreSQL](#adr-003-sqlite-over-postgresql)
5. [ADR-004: IR Control over CEC for Cable Boxes](#adr-004-ir-control-over-cec-for-cable-boxes)
6. [ADR-005: In-Memory Rate Limiting over Redis](#adr-005-in-memory-rate-limiting-over-redis)
7. [ADR-006: PM2 Fork Mode over Cluster Mode](#adr-006-pm2-fork-mode-over-cluster-mode)
8. [ADR-007: PIN Authentication over OAuth](#adr-007-pin-authentication-over-oauth)
9. [ADR-008: Singleton Health Monitor with Global Object](#adr-008-singleton-health-monitor-with-global-object)
10. [ADR-009: Config File Health Checks over Database Queries](#adr-009-config-file-health-checks-over-database-queries)
11. [ADR-010: TypeScript 100% Error-Free Codebase](#adr-010-typescript-100-error-free-codebase)
12. [ADR-011: Local Ollama LLM over Cloud AI Services](#adr-011-local-ollama-llm-over-cloud-ai-services)
13. [ADR-012: Database-Backed Logging for Analytics](#adr-012-database-backed-logging-for-analytics)

---

## ADR Format

Each ADR follows this structure:

- **Status**: Accepted | Rejected | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Context**: Problem being solved
- **Decision**: What was decided
- **Rationale**: Why this was chosen
- **Consequences**: Trade-offs and implications
- **Alternatives Considered**: Other options
- **References**: Related docs

---

## ADR-001: Next.js App Router over Pages Router

**Status**: Accepted
**Date**: 2024-10-01
**Deciders**: Development team

### Context

Next.js 13+ introduced the App Router as a new routing paradigm, alongside the existing Pages Router. The project needed to choose which routing system to use for the Sports-Bar-TV-Controller application.

### Decision

**We will use Next.js 15 App Router** for all new routes and pages.

### Rationale

1. **Better TypeScript Support**: App Router has improved type inference for params and search params
2. **Server Components by Default**: Reduces JavaScript sent to client
3. **Simplified Data Fetching**: No need for `getServerSideProps` or `getStaticProps`
4. **Layouts**: Nested layouts with shared state
5. **Future-Proof**: App Router is the future direction of Next.js

### Consequences

**Positive**:
- Improved performance with server components
- Better TypeScript experience
- Cleaner API route structure (`route.ts` files)
- Built-in loading/error states
- Streaming support

**Negative**:
- Smaller ecosystem (fewer examples, less Stack Overflow answers)
- Learning curve for team members familiar with Pages Router
- Some Next.js features still evolving (caching behavior)

**Neutral**:
- Migration from Pages Router requires rewrite (not incremental)
- File structure changes (`page.tsx`, `layout.tsx` conventions)

### Alternatives Considered

1. **Pages Router**
   - Pros: More mature, larger ecosystem, well-documented
   - Cons: Older paradigm, worse TypeScript support, less performant
   - Rejected: Not future-proof

2. **Remix**
   - Pros: Excellent data loading, nested routes
   - Cons: Different ecosystem, smaller community
   - Rejected: Team familiarity with Next.js

3. **Pure React SPA with Separate Backend**
   - Pros: Clear separation, technology flexibility
   - Cons: More deployment complexity, no SSR benefits
   - Rejected: Overkill for sports bar application

### Implementation Notes

- All routes in `/src/app/` directory
- API routes: `/src/app/api/**/route.ts`
- Pages: `/src/app/**/page.tsx`
- Layouts: `/src/app/**/layout.tsx`
- Use `'use client'` directive sparingly (only when needed)

### References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## ADR-002: Drizzle ORM over Prisma

**Status**: Accepted
**Date**: 2024-10-15
**Deciders**: Development team

### Context

The project initially used Prisma ORM but experienced performance issues and migration complexity. A decision was needed on whether to continue with Prisma or migrate to an alternative ORM.

### Decision

**We will migrate from Prisma to Drizzle ORM**.

### Rationale

1. **Performance**: Drizzle generates optimized SQL with zero overhead
2. **Type Safety**: End-to-end type safety without code generation
3. **SQL Control**: Write SQL-like queries with full control
4. **Lightweight**: No heavy runtime, smaller bundle size
5. **SQLite Support**: Better SQLite integration than Prisma
6. **Zero Dependencies**: Core library has no dependencies

**Performance Comparison**:
```
Prisma findMany (100 records): 45ms
Drizzle select (100 records): 12ms
Reduction: 73% faster
```

### Consequences

**Positive**:
- 73% faster query performance
- Reduced memory usage (no Prisma Client generation)
- Better SQLite support (Prisma SQLite preview was buggy)
- Cleaner query syntax (more SQL-like)
- Smaller production bundle

**Negative**:
- Migration effort required (1 week)
- Smaller ecosystem (fewer plugins, less tooling)
- Team learning curve (different query syntax)
- Less mature (but stable core)

**Neutral**:
- Schema definition in TypeScript (not Prisma schema language)
- Manual migration management (Drizzle Kit)

### Migration Process

1. **Schema Migration**: Converted Prisma schema to Drizzle schema
2. **Query Migration**: Replaced Prisma queries with Drizzle equivalents
3. **Helper Functions**: Created `db-helpers.ts` for common operations
4. **Testing**: Comprehensive testing of all database operations
5. **Cleanup**: Removed Prisma dependencies

### Alternatives Considered

1. **Continue with Prisma**
   - Pros: Mature, excellent tooling, large ecosystem
   - Cons: Performance issues, SQLite preview bugs, heavy runtime
   - Rejected: Performance was critical blocker

2. **TypeORM**
   - Pros: Mature, large ecosystem, decorator-based
   - Cons: Heavy runtime, complex setup, mixed TypeScript support
   - Rejected: Too heavyweight

3. **Kysely**
   - Pros: Type-safe SQL builder, zero runtime overhead
   - Cons: More verbose, less Rails-like, manual type generation
   - Rejected: Drizzle provides better DX

4. **Raw SQL**
   - Pros: Maximum performance, full control
   - Cons: No type safety, SQL injection risk, verbose
   - Rejected: Safety and maintainability concerns

### Implementation Notes

```typescript
// Schema definition
export const fireTVDevices = sqliteTable('FireTVDevice', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  status: text('status').default('offline'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
})

// Query usage
const devices = await db.select()
  .from(schema.fireTVDevices)
  .where(eq(schema.fireTVDevices.status, 'online'))
  .orderBy(asc(schema.fireTVDevices.name))
```

### References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)

---

## ADR-003: SQLite over PostgreSQL

**Status**: Accepted
**Date**: 2024-10-01
**Deciders**: Development team

### Context

The application needed a database solution for a single-location sports bar deployment. The choice was between SQLite (embedded) and PostgreSQL (client-server).

### Decision

**We will use SQLite as the primary database**.

### Rationale

1. **Deployment Simplicity**: Single file database, no separate server
2. **Backup Simplicity**: Copy single file, no dump/restore process
3. **Zero Configuration**: No network setup, users, permissions
4. **Sufficient Performance**: 100k reads/sec, 10k writes/sec
5. **Zero Maintenance**: No server monitoring, no connection pooling
6. **Cost**: Free, no hosting costs
7. **Data Locality**: All data on local disk, no network latency

**Performance Characteristics**:
- Read Operations: <10ms (indexed queries)
- Write Operations: <50ms (with WAL mode)
- Concurrent Reads: Unlimited
- Concurrent Writes: Sequential (one at a time)

### Consequences

**Positive**:
- Simple deployment (no separate database server)
- Fast local queries (no network overhead)
- Easy backups (copy single file)
- Zero maintenance overhead
- Perfect for single-location deployment

**Negative**:
- No horizontal scaling (single file)
- Limited concurrent writes
- Not suitable for multi-location (future requirement)
- No built-in replication
- File corruption risk (mitigated with WAL mode)

**Neutral**:
- Database located at `/home/ubuntu/sports-bar-data/production.db`
- Must use PM2 fork mode (not cluster mode)

### Performance Optimizations

1. **WAL Mode**: Enabled for better concurrent access
2. **Indexes**: 50+ indexes on frequently queried columns
3. **Batch Updates**: Transaction wrapping for bulk operations
4. **Regular VACUUM**: Monthly maintenance for performance

### Alternatives Considered

1. **PostgreSQL**
   - Pros: Better concurrent writes, replication, mature ecosystem
   - Cons: Requires separate server, complex setup, network overhead
   - Rejected: Overkill for single-location deployment

2. **MySQL/MariaDB**
   - Pros: Mature, widely used, good replication
   - Cons: Requires separate server, complex setup
   - Rejected: Similar issues to PostgreSQL

3. **MongoDB**
   - Pros: Flexible schema, good for nested data
   - Cons: Separate server, overkill for relational data
   - Rejected: Data is primarily relational

### Migration Path (Future)

If multi-location support is needed:

1. **Option 1**: Migrate to PostgreSQL with multi-tenant schema
2. **Option 2**: Keep SQLite per-location with API gateway
3. **Option 3**: Use Turso (distributed SQLite)

See: [MULTI_LOCATION_ARCHITECTURE.md](./MULTI_LOCATION_ARCHITECTURE.md)

### References

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)

---

## ADR-004: IR Control over CEC for Cable Boxes

**Status**: Accepted
**Date**: 2024-11-01
**Deciders**: Development team, Hardware testing

### Context

Initial implementation used HDMI-CEC (via Pulse-Eight adapters) for cable box control. However, testing revealed that Spectrum/Charter cable boxes have CEC disabled in firmware, making CEC control impossible.

### Decision

**We will use IR (infrared) control via Global Cache iTach IP2IR for cable box control**. CEC will be retained only for TV power control.

### Rationale

1. **Hardware Reality**: Spectrum cable boxes have CEC permanently disabled
2. **Universal Compatibility**: IR works with all cable box brands/models
3. **Proven Technology**: IR has been used for decades
4. **Learning Capability**: iTach can learn codes from physical remotes
5. **No Firmware Dependencies**: IR is hardware-level, not firmware

**CEC Investigation Results**:
```
✓ Xfinity/Comcast boxes: CEC works
✗ Spectrum/Charter boxes: CEC disabled in firmware
✗ Verizon FiOS boxes: CEC disabled
✓ Generic cable boxes: CEC sometimes works
```

### Consequences

**Positive**:
- Universal compatibility (works with all cable boxes)
- More reliable (no firmware dependencies)
- IR learning system allows custom codes
- Works with older equipment

**Negative**:
- Requires physical IR emitters (placement matters)
- One-way communication (no feedback from device)
- Initial setup requires learning IR codes
- Requires Global Cache iTach hardware

**Neutral**:
- CEC still used for TV power control (works fine)
- Migration effort from CEC to IR (completed)

### Implementation Details

**Hardware**:
- Global Cache iTach IP2IR (network IR blaster)
- IR emitters placed on front of cable boxes
- See: [IR_EMITTER_PLACEMENT_GUIDE.md](./IR_EMITTER_PLACEMENT_GUIDE.md)

**Software**:
- IR learning API: `/api/ir-devices/learn`
- IR command API: `/api/ir-devices/send-command`
- Database storage: `IRDevice.irCodes` JSON field

**Migration**:
- Deprecated `CableBox` table
- Created `IRDevice` table
- Updated `CableBoxRemote` component (smart routing)

### Alternatives Considered

1. **Continue with CEC (Xfinity only)**
   - Pros: Clean HDMI control, two-way communication
   - Cons: Doesn't work with Spectrum (most common provider)
   - Rejected: Not universal solution

2. **Use DirecTV SHEF Protocol**
   - Pros: Full control, program guide access
   - Cons: Only works with DirecTV, requires IP connection
   - Rejected: Not applicable to cable boxes

3. **HDMI Matrix with CEC Injection**
   - Pros: Centralized control
   - Cons: Expensive, complex, still limited by firmware
   - Rejected: Doesn't solve firmware limitation

### References

- [CEC_DEPRECATION_NOTICE.md](./CEC_DEPRECATION_NOTICE.md)
- [CEC_TO_IR_MIGRATION_GUIDE.md](./CEC_TO_IR_MIGRATION_GUIDE.md)
- [IR_LEARNING_DEMO_SCRIPT.md](./IR_LEARNING_DEMO_SCRIPT.md)
- [IR_EMITTER_PLACEMENT_GUIDE.md](./IR_EMITTER_PLACEMENT_GUIDE.md)

---

## ADR-005: In-Memory Rate Limiting over Redis

**Status**: Accepted
**Date**: 2024-10-01
**Deciders**: Development team

### Context

API endpoints needed rate limiting to prevent abuse and ensure fair usage. The choice was between in-memory rate limiting (single-server) or Redis-based rate limiting (distributed).

### Decision

**We will use in-memory rate limiting with sliding window algorithm**.

### Rationale

1. **Deployment Model**: Single-server deployment (no need for distributed state)
2. **Simplicity**: No external dependencies (no Redis server)
3. **Performance**: In-memory is faster than network call to Redis
4. **Cost**: Free (no Redis hosting costs)
5. **Maintenance**: Zero maintenance overhead
6. **Sufficient**: Rate limits reset on restart (acceptable trade-off)

### Consequences

**Positive**:
- Zero external dependencies
- Extremely fast (no network calls)
- Simple implementation
- No Redis hosting/maintenance costs
- Works perfectly for single-server deployment

**Negative**:
- Rate limits reset on application restart
- No shared state across multiple servers (not applicable)
- Rate limit data lost on crash (acceptable)

**Neutral**:
- In-memory Map storage (garbage collected automatically)
- Sliding window algorithm (fair and accurate)

### Implementation

```typescript
class RateLimiter {
  private requests = new Map<string, number[]>()

  async checkLimit(identifier: string, limit: number, windowMs: number) {
    const now = Date.now()
    const timestamps = this.requests.get(identifier) || []
    const validTimestamps = timestamps.filter(t => t > now - windowMs)

    if (validTimestamps.length >= limit) {
      return { allowed: false }
    }

    validTimestamps.push(now)
    this.requests.set(identifier, validTimestamps)
    return { allowed: true }
  }
}
```

**Configurations**:
- DEFAULT: 100 req/min
- STRICT: 5 req/min (auth endpoints)
- HARDWARE: 50 req/min (device control)
- GENEROUS: 1000 req/min (public reads)

### Alternatives Considered

1. **Redis-Based Rate Limiting**
   - Pros: Distributed, persistent, survives restarts
   - Cons: Requires Redis server, network overhead, complexity
   - Rejected: Unnecessary for single-server deployment

2. **Database-Based Rate Limiting**
   - Pros: Persistent, no external dependencies
   - Cons: Database overhead, slower performance
   - Rejected: Too slow for rate limiting

3. **No Rate Limiting**
   - Pros: Simplest implementation
   - Cons: Vulnerable to abuse, no protection
   - Rejected: Security requirement

### Future Considerations

If multi-location deployment is needed:
- Migrate to Redis for distributed rate limiting
- Per-location rate limits (isolation)
- See: [MULTI_LOCATION_ARCHITECTURE.md](./MULTI_LOCATION_ARCHITECTURE.md)

### References

- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)
- [CODE_PATTERNS.md](./CODE_PATTERNS.md)

---

## ADR-006: PM2 Fork Mode over Cluster Mode

**Status**: Accepted
**Date**: 2024-10-01
**Deciders**: Development team

### Context

PM2 supports two execution modes: fork mode (single process) and cluster mode (multiple processes with load balancing). A decision was needed on which mode to use.

### Decision

**We will use PM2 fork mode with a single instance**.

### Rationale

1. **SQLite Limitation**: SQLite doesn't handle concurrent writes well
2. **Database Contention**: Multiple processes would compete for database locks
3. **Singleton Services**: Health monitor needs single instance
4. **Simple Deployment**: Easier to debug and monitor
5. **Sufficient Performance**: Single process handles sports bar load easily

**Performance Analysis**:
```
Expected Load:
- 10-20 concurrent users (staff)
- 100 API requests/minute
- 16 Fire TV devices
- 16 TVs

Single Process Capacity:
- 1000+ requests/minute
- Node.js handles concurrent requests via event loop
- Conclusion: Single process is sufficient
```

### Consequences

**Positive**:
- No database lock contention
- Singleton services work correctly
- Simpler debugging (single process)
- Predictable behavior
- Lower memory usage

**Negative**:
- No automatic load balancing across CPU cores
- Single point of failure (mitigated by PM2 auto-restart)
- CPU bound operations block event loop (not an issue)

**Neutral**:
- PM2 auto-restart on crashes
- Memory limit: 1GB (sufficient for application)
- Daily restart at 4 AM (prevents memory leaks)

### Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    instances: 1,
    exec_mode: 'fork', // NOT cluster
    max_memory_restart: '1G',
    autorestart: true,
    cron_restart: '0 4 * * *' // Daily at 4 AM
  }]
}
```

### Alternatives Considered

1. **Cluster Mode (Multiple Instances)**
   - Pros: Load balancing, CPU utilization
   - Cons: SQLite lock contention, singleton issues, complexity
   - Rejected: Database architecture incompatible

2. **Multiple Servers with Load Balancer**
   - Pros: High availability, horizontal scaling
   - Cons: Requires PostgreSQL, complex deployment, overkill
   - Rejected: Unnecessary for single-location sports bar

3. **Worker Threads**
   - Pros: Shared memory, better for CPU-bound tasks
   - Cons: Complex, not needed for I/O-bound application
   - Rejected: Application is primarily I/O-bound

### References

- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)
- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md)

---

## ADR-007: PIN Authentication over OAuth

**Status**: Accepted
**Date**: 2024-10-01
**Deciders**: Development team, Bar owner input

### Context

The application needed an authentication system suitable for a sports bar environment with multiple staff members (bartenders, servers, managers) who need quick access during busy periods.

### Decision

**We will use 4-digit PIN-based authentication with role-based access control**.

### Rationale

1. **Speed**: 4-digit PIN entry is faster than username/password
2. **Simplicity**: Easy for staff to remember and enter
3. **Sports Bar Context**: Staff need quick access during game rush
4. **Shared Devices**: Multiple staff use same tablets
5. **No Personal Accounts**: Staff turnover makes individual accounts cumbersome
6. **Physical Security**: Bar is physically secure (not public internet)

**User Flow**:
```
1. Staff picks up tablet
2. Enter 4-digit PIN (numeric keypad)
3. Instant access (no username, no email)
4. Session expires after 24 hours
```

### Consequences

**Positive**:
- Very fast authentication (2 seconds)
- No forgotten passwords
- Easy PIN rotation when staff leaves
- Simple UI (numeric keypad)
- No email verification needed
- No password reset flows

**Negative**:
- Less secure than OAuth (acceptable in physical bar)
- PINs can be shared (mitigated by role separation)
- No multi-factor authentication
- Audit trail less granular (role-based, not individual)

**Neutral**:
- PINs stored with bcrypt (12 rounds)
- Rate limiting: 5 attempts/minute
- Session expiration: 24 hours
- Two roles: STAFF (bartenders) and ADMIN (managers)

### Security Measures

1. **Hashing**: bcrypt with 12 rounds
2. **Rate Limiting**: 5 attempts/minute (prevents brute force)
3. **Session Management**: Database sessions with expiration
4. **Audit Logging**: All administrative actions logged
5. **Physical Security**: Bar is not public (staff only)

**Brute Force Protection**:
```
PIN Space: 10,000 combinations (0000-9999)
Rate Limit: 5 attempts/minute
Time to Brute Force: 33 hours
Mitigation: Account lockout after 10 failures (future)
```

### Alternatives Considered

1. **OAuth (Google/Microsoft)**
   - Pros: More secure, SSO, MFA support
   - Cons: Requires email accounts, slower login, internet dependency
   - Rejected: Too complex for bar environment

2. **Username/Password**
   - Pros: More granular audit trail, familiar
   - Cons: Slower login, forgotten passwords, reset flows
   - Rejected: Too slow for busy bar environment

3. **Biometric (Fingerprint/Face)**
   - Pros: Very secure, no passwords
   - Cons: Requires hardware, shared devices don't work well
   - Rejected: Shared tablet environment

4. **API Keys Only**
   - Pros: Simple, stateless
   - Cons: No UI authentication, only for external systems
   - Rejected: Need UI authentication for staff

### Implementation Notes

**Database Schema**:
```typescript
AuthPin:
  - id: UUID
  - pinHash: string (bcrypt)
  - role: 'STAFF' | 'ADMIN'
  - description: string (e.g., "Bartender PIN")
  - isActive: boolean
  - expiresAt: timestamp
```

**PIN Rotation**:
- Admin can deactivate PINs when staff leaves
- Create new PINs for new staff
- Temporary PINs for contractors (with expiration)

### References

- [AUTHENTICATION_GUIDE.md](./authentication/AUTHENTICATION_GUIDE.md)
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)

---

## ADR-008: Singleton Health Monitor with Global Object

**Status**: Accepted
**Date**: 2024-11-05
**Deciders**: Development team (Performance optimization)

### Context

Fire TV health monitoring was causing PM2 restarts due to duplicate monitor initialization. Each API call was creating a new monitor instance, leading to memory leaks and concurrent health checks.

### Decision

**We will use a singleton health monitor with PM2-persisted global object**.

### Rationale

1. **Prevent Duplicate Initialization**: Only one monitor instance across entire app
2. **PM2 Restart Persistence**: Global object survives PM2 restarts
3. **Memory Efficiency**: Single instance uses less memory
4. **Predictable Behavior**: No concurrent health checks
5. **Performance**: Reduced database queries (70% reduction)

**Before (Problems)**:
```typescript
// ❌ New instance on every API call
export function getHealthMonitor() {
  return new FireTVHealthMonitor() // Memory leak!
}

// Result: 95 PM2 restarts in 24 hours
```

**After (Solution)**:
```typescript
// ✅ Global singleton persists across PM2 restarts
declare global {
  var firetvHealthMonitor: FireTVHealthMonitor | undefined
}

if (!global.firetvHealthMonitor) {
  global.firetvHealthMonitor = new FireTVHealthMonitor()
}

export const healthMonitor = global.firetvHealthMonitor

// Result: 0 PM2 restarts, stable memory
```

### Consequences

**Positive**:
- Zero PM2 restarts (down from 95/day)
- Stable memory usage (no leaks)
- 70% reduction in database load
- Predictable health check timing
- Singleton benefits (shared state, caching)

**Negative**:
- Global state (can be harder to test)
- Potential memory leaks if not cleaned up (mitigated)

**Neutral**:
- Must export singleton instance (not factory function)
- Testing requires global object mocking

### Performance Impact

**Before**:
```
Database Queries: 1000/minute (health checks)
Memory Usage: Growing (200MB → 800MB over 8 hours)
PM2 Restarts: 95 in 24 hours
CPU Usage: 15% average
```

**After**:
```
Database Queries: 300/minute (70% reduction)
Memory Usage: Stable (200MB constant)
PM2 Restarts: 0 in 48+ hours
CPU Usage: 5% average
```

### Implementation Details

```typescript
// /src/lib/firetv-health-monitor.ts
class FireTVHealthMonitor {
  private lastCheckTime: Date | null = null
  private healthCache = new Map<string, HealthStatus>()

  async runHealthCheck(): Promise<void> {
    // Prevent concurrent checks
    if (this.isRunning) {
      logger.warn('[HEALTH] Check already running, skipping')
      return
    }

    this.isRunning = true

    try {
      // Load from config (not database!)
      const devices = loadDevicesFromConfig()

      // Parallel health checks
      const results = await Promise.allSettled(
        devices.map(d => this.checkDevice(d))
      )

      // Batch update database
      await this.updateDatabaseBatch(results)

      this.lastCheckTime = new Date()
    } finally {
      this.isRunning = false
    }
  }
}

// Global singleton
declare global {
  var firetvHealthMonitor: FireTVHealthMonitor | undefined
}

if (!global.firetvHealthMonitor) {
  global.firetvHealthMonitor = new FireTVHealthMonitor()
}

export const healthMonitor = global.firetvHealthMonitor
```

### Alternatives Considered

1. **Factory Function (Previous Approach)**
   - Pros: Simple, no global state
   - Cons: Multiple instances, memory leaks, PM2 restarts
   - Rejected: Caused production issues

2. **Module-Level Variable**
   - Pros: Singleton per module
   - Cons: Not PM2-restart persistent
   - Rejected: Doesn't solve restart issue

3. **Database-Stored State**
   - Pros: Persistent across restarts
   - Cons: Database overhead, slow
   - Rejected: Performance concerns

4. **External State Service (Redis)**
   - Pros: Distributed state
   - Cons: External dependency, complexity
   - Rejected: Overkill for single-server

### References

- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md)
- [RESTART_ANALYSIS.md](./RESTART_ANALYSIS.md)
- [CODE_PATTERNS.md](./CODE_PATTERNS.md)

---

## ADR-009: Config File Health Checks over Database Queries

**Status**: Accepted
**Date**: 2024-11-05
**Deciders**: Development team (Performance optimization)

### Context

Health monitoring was querying the database every 5 minutes to get list of devices to check. This created unnecessary database load and slowed down health checks.

### Decision

**We will load device list from configuration file (`data/firetv-devices.json`) instead of database queries**.

### Rationale

1. **Performance**: File read is 100x faster than database query
2. **Reduced Database Load**: 70% reduction in database queries
3. **Simplified Logic**: No ORM overhead
4. **Single Source of Truth**: Config file already exists
5. **Batch Updates**: Only write to database (no reads in hot path)

**Performance Comparison**:
```
Database Query Approach:
- Read devices: 50ms (database query)
- Check health: 1000ms (parallel)
- Update database: 200ms (batch)
Total: 1250ms per check × 12/hour = high load

Config File Approach:
- Read devices: 0.5ms (file read)
- Check health: 1000ms (parallel)
- Update database: 200ms (batch)
Total: 1200ms per check × 12/hour = low load
```

### Consequences

**Positive**:
- 100x faster device list loading
- 70% reduction in total database queries
- Simplified health check logic
- Lower database contention
- Config file already maintained separately

**Negative**:
- Two sources of device data (config file + database)
- Config file must be kept in sync with database
- Manual sync required when devices added/removed

**Neutral**:
- Config file location: `data/firetv-devices.json`
- File format: Simple JSON array
- Database still used for status updates

### Implementation

```typescript
// Before (Database Query)
async function getDevicesToCheck(): Promise<Device[]> {
  return await db.select()
    .from(schema.fireTVDevices)
    .where(eq(schema.fireTVDevices.isActive, true))
  // 50ms query time
}

// After (Config File)
function getDevicesToCheck(): Device[] {
  const config = fs.readFileSync('data/firetv-devices.json', 'utf-8')
  return JSON.parse(config).devices
  // 0.5ms read time
}
```

**Config File Format**:
```json
{
  "devices": [
    {
      "id": "firetv-1",
      "name": "TV #1 Fire Cube",
      "ipAddress": "192.168.1.100"
    }
  ]
}
```

### Sync Strategy

**When to Update Config File**:
1. Device added via admin UI → Update both DB and config
2. Device removed → Mark inactive in DB, remove from config
3. IP address changed → Update both DB and config
4. Deployment → Config file checked into git

### Alternatives Considered

1. **Continue Database Queries**
   - Pros: Single source of truth, always in sync
   - Cons: Performance overhead, database load
   - Rejected: Performance was issue

2. **In-Memory Cache of Database**
   - Pros: Fast, single source of truth
   - Cons: Invalidation complexity, stale data risk
   - Rejected: Config file simpler

3. **Redis for Device List**
   - Pros: Fast, distributed
   - Cons: External dependency, complexity
   - Rejected: Overkill for single-server

### References

- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md)
- [CODE_PATTERNS.md](./CODE_PATTERNS.md)

---

## ADR-010: TypeScript 100% Error-Free Codebase

**Status**: Accepted
**Date**: 2024-11-04
**Deciders**: Development team

### Context

The codebase had accumulated 1,264 TypeScript errors over development. While the application functioned, type errors indicated potential runtime bugs and reduced code maintainability.

### Decision

**We will maintain a 100% TypeScript error-free codebase** (zero `tsc` errors).

### Rationale

1. **Type Safety**: Catch bugs at compile time, not runtime
2. **Better IDE Support**: Accurate autocomplete and refactoring
3. **Documentation**: Types serve as inline documentation
4. **Maintainability**: Easier to understand code intent
5. **Confidence**: Refactor without fear of breaking things
6. **Professional Standard**: Industry best practice

**Error Reduction**:
```
Before: 1,264 TypeScript errors
After: 0 TypeScript errors
Effort: 3 weeks of systematic fixes
Result: 100% reduction
```

### Consequences

**Positive**:
- Zero type-related runtime errors
- Excellent IDE autocomplete
- Safe refactoring (compiler catches breaks)
- Better code documentation
- Easier onboarding for new developers
- Professional codebase quality

**Negative**:
- Initial fix effort (3 weeks)
- Stricter development (can't ignore errors)
- More verbose type annotations
- Occasional TypeScript quirks to work around

**Neutral**:
- `strict: true` in tsconfig.json
- No `any` types (use `unknown` instead)
- No `ts-ignore` comments
- CI/CD checks for type errors

### Fix Strategy

1. **Phase 1**: Fix critical errors (500 errors → 200 errors)
2. **Phase 2**: Fix service layer (200 errors → 50 errors)
3. **Phase 3**: Fix components (50 errors → 0 errors)
4. **Phase 4**: Enable strict mode
5. **Phase 5**: Remove all `any` types

**Common Fixes**:
```typescript
// Before
function updateDevice(id: string, data: any) { // ❌ any type

// After
function updateDevice(id: string, data: Partial<FireTVDevice>) { // ✅ specific type

// Before
const response = await request.json() // ❌ Type unknown

// After
const bodyValidation = await validateRequestBody(request, schema)
const response = bodyValidation.data // ✅ Type-safe
```

### Enforcement

**Build-Time**:
```bash
npm run build
# Fails if any TypeScript errors
```

**CI/CD Pipeline**:
```bash
- name: Type Check
  run: npm run tsc --noEmit
  # Fails build if errors found
```

**Git Pre-Commit Hook** (optional):
```bash
#!/bin/bash
npm run tsc --noEmit || {
  echo "TypeScript errors found. Commit blocked."
  exit 1
}
```

### Alternatives Considered

1. **Allow Type Errors**
   - Pros: Faster development, less strictness
   - Cons: Runtime bugs, poor maintainability
   - Rejected: Unprofessional, risky

2. **Partial Type Safety**
   - Pros: Balance between strict and loose
   - Cons: Unclear standard, inconsistent
   - Rejected: Half-measures don't work

3. **Migrate to JavaScript**
   - Pros: No type errors possible
   - Cons: Lose all type safety benefits
   - Rejected: TypeScript is superior for large codebases

### References

- [CHANGELOG.md](./CHANGELOG.md) (TypeScript perfection entry)
- Git commit: `8ee21c0` - "feat: 🎉 ZERO ERRORS!"

---

## ADR-011: Local Ollama LLM over Cloud AI Services

**Status**: Accepted
**Date**: 2024-10-20
**Deciders**: Development team

### Context

The application needed AI capabilities for:
- Document search (RAG)
- Log analysis
- Device diagnostics
- Knowledge base Q&A

Choice was between cloud AI services (OpenAI, Anthropic) or local LLM (Ollama).

### Decision

**We will use Ollama with llama3.1:8b and nomic-embed-text models running locally**.

### Rationale

1. **Privacy**: All data stays on local server (sports bar operations are private)
2. **Cost**: Zero API costs (pay once for hardware)
3. **Latency**: Local inference faster than API calls
4. **Reliability**: No internet dependency
5. **No Rate Limits**: Unlimited queries
6. **Data Sovereignty**: Complete control over data

**Performance Characteristics**:
```
Model: llama3.1:8b
Hardware: [Server specs]
Inference Time: 2-5 seconds per query
Context Window: 128k tokens
Embedding Time: 200ms per document
```

### Consequences

**Positive**:
- Zero ongoing API costs
- Fast local inference (no network calls)
- Complete privacy (no data sent to cloud)
- No rate limits
- Works offline
- Full control over models

**Negative**:
- Requires GPU/powerful CPU (one-time hardware cost)
- Model updates require manual download
- Limited to open-source models
- Lower quality than GPT-4 (but sufficient)

**Neutral**:
- Ollama runs on port 11434
- Models stored in `~/.ollama`
- System prompt customization

### Use Cases

1. **RAG Documentation Search**
   - Embed documents with nomic-embed-text
   - Store in vector database
   - Query with llama3.1:8b

2. **Log Analysis**
   - Analyze error logs
   - Suggest fixes
   - Pattern detection

3. **Device Diagnostics**
   - AI-powered troubleshooting
   - Configuration suggestions
   - Performance optimization

4. **Knowledge Base**
   - Answer staff questions
   - Equipment documentation lookup
   - Procedure guidance

### Alternatives Considered

1. **OpenAI GPT-4**
   - Pros: Best quality, large context, function calling
   - Cons: $0.03/1k tokens, privacy concerns, internet dependency
   - Rejected: Cost and privacy concerns

2. **Anthropic Claude**
   - Pros: Long context (200k), good reasoning
   - Cons: $0.015/1k tokens, internet dependency
   - Rejected: Cost concerns

3. **Google Gemini**
   - Pros: Free tier, multimodal
   - Cons: Privacy, rate limits, unpredictable pricing
   - Rejected: Privacy concerns

4. **No AI Features**
   - Pros: Simplest, no costs
   - Cons: Miss out on powerful capabilities
   - Rejected: AI provides significant value

### Hardware Requirements

**Minimum**:
- CPU: 8 cores
- RAM: 16GB
- Storage: 50GB

**Recommended**:
- GPU: NVIDIA RTX 3060 (12GB VRAM)
- CPU: 16 cores
- RAM: 32GB
- Storage: 100GB SSD

### References

- [OLLAMA_SETUP_COMPLETE.md](./OLLAMA_SETUP_COMPLETE.md)
- [RAG_IMPLEMENTATION_REPORT.md](./RAG_IMPLEMENTATION_REPORT.md)
- [AI_MODELS_SETUP.md](./AI_MODELS_SETUP.md)

---

## ADR-012: Database-Backed Logging for Analytics

**Status**: Accepted
**Date**: 2024-10-15
**Deciders**: Development team

### Context

Application needed logging for two purposes:
1. Real-time debugging (development/troubleshooting)
2. Analytics and reporting (System Admin)

Standard console logging addresses #1 but not #2.

### Decision

**We will use dual logging**: structured console logging + database-backed enhanced logging.

### Rationale

1. **Analytics Capability**: Query logs for System Admin dashboard
2. **Audit Trail**: Track all administrative actions
3. **Performance Metrics**: Analyze API response times
4. **Device Insights**: Track device reliability over time
5. **User Behavior**: Understand usage patterns

### Consequences

**Positive**:
- Powerful analytics capabilities
- Searchable log history
- Performance trending
- Audit compliance
- User behavior insights

**Negative**:
- Database overhead (mitigated with indexes)
- Storage growth (requires cleanup policy)
- Complexity (two logging systems)

**Neutral**:
- Console logs: Development/troubleshooting
- Database logs: Analytics/reporting
- 90-day retention policy

### Implementation

```typescript
// Console Logger (/src/lib/logger.ts)
export const logger = {
  info: (message: string, context?: any) => console.log(...),
  error: (message: string, error?: Error) => console.error(...),
  debug: (message: string, context?: any) => console.log(...),
  warn: (message: string, context?: any) => console.warn(...)
}

// Enhanced Logger (/src/lib/enhanced-logger.ts)
export const enhancedLogger = {
  log: async (entry: LogEntry) => {
    await db.insert(schema.operationLog).values({
      level: entry.level,
      category: entry.category,
      action: entry.action,
      message: entry.message,
      details: JSON.stringify(entry.details),
      deviceId: entry.deviceId,
      success: entry.success,
      duration: entry.duration,
      timestamp: new Date()
    })
  }
}

// Usage
logger.info('[FIRETV] Launching app', { deviceId, packageName })

await enhancedLogger.log({
  level: 'info',
  category: 'device',
  action: 'launch_app',
  message: 'App launched successfully',
  deviceId,
  success: true,
  duration: 150
})
```

**Database Schema**:
```typescript
operationLog:
  - id: UUID
  - level: string ('info', 'error', 'warn')
  - category: string ('device', 'audio', 'auth', etc)
  - source: string (service name)
  - action: string (operation performed)
  - message: string
  - details: text (JSON)
  - deviceType: string
  - deviceId: string
  - userId: string
  - success: boolean
  - duration: integer (ms)
  - timestamp: datetime
```

### When to Use Each Logger

**Console Logger** (always):
- Development debugging
- Error stack traces
- Performance warnings
- System events

**Enhanced Logger** (selectively):
- Device operations (launch app, tune channel)
- Authentication events (login, logout)
- Configuration changes (device added, settings changed)
- Administrative actions (PIN created, API key generated)
- Error events (device offline, API failure)

**Not Logged**:
- Health checks (too frequent, low value)
- Cache hits/misses (performance impact)
- Routine background tasks

### Analytics Queries

```sql
-- Device reliability
SELECT deviceId, COUNT(*) as total, SUM(success) as successful
FROM OperationLog
WHERE category = 'device' AND action = 'launch_app'
GROUP BY deviceId

-- Performance trends
SELECT DATE(timestamp) as date, AVG(duration) as avg_response_time
FROM OperationLog
WHERE category = 'device'
GROUP BY DATE(timestamp)

-- Most used features
SELECT action, COUNT(*) as usage_count
FROM OperationLog
WHERE timestamp > DATE('now', '-30 days')
GROUP BY action
ORDER BY usage_count DESC
```

### Retention Policy

```sql
-- Cleanup logs older than 90 days
DELETE FROM OperationLog
WHERE timestamp < DATE('now', '-90 days')

-- Run monthly via cron
0 0 1 * * /path/to/cleanup-logs.sh
```

### Alternatives Considered

1. **Console Logging Only**
   - Pros: Simple, no database overhead
   - Cons: No analytics, logs lost on rotation
   - Rejected: Need analytics capability

2. **External Logging Service (Loggly, Splunk)**
   - Pros: Powerful analytics, no database overhead
   - Cons: Cost, internet dependency, privacy concerns
   - Rejected: Cost and privacy

3. **Elasticsearch**
   - Pros: Excellent search, powerful analytics
   - Cons: Heavy infrastructure, complexity, memory usage
   - Rejected: Overkill for sports bar

4. **File-Based Logging**
   - Pros: Simple, no database
   - Cons: Difficult to query, no structured search
   - Rejected: Poor analytics capability

### References

- [LOGGING_IMPLEMENTATION.md](./LOGGING_IMPLEMENTATION.md)
- [SYSTEM_ADMIN_GUIDE.md](./SYSTEM_ADMIN_GUIDE.md)

---

## Summary

### Decision Statistics

- **Total ADRs**: 12
- **Accepted**: 12
- **Rejected**: 0
- **Deprecated**: 0
- **Superseded**: 0

### Key Technology Choices

| Component | Choice | Alternative | Primary Reason |
|-----------|--------|-------------|----------------|
| Framework | Next.js App Router | Pages Router | Future-proof, better TypeScript |
| ORM | Drizzle | Prisma | 73% faster, better SQLite support |
| Database | SQLite | PostgreSQL | Single-location simplicity |
| Cable Box Control | IR | CEC | Spectrum firmware limitation |
| Rate Limiting | In-Memory | Redis | Single-server deployment |
| Process Manager | PM2 Fork | PM2 Cluster | SQLite concurrency |
| Authentication | PIN | OAuth | Bar environment speed |
| Health Monitor | Singleton | Factory | Performance/stability |
| Device List | Config File | Database | 100x faster |
| Type Safety | 100% Error-Free | Relaxed | Professional standard |
| AI/LLM | Local Ollama | Cloud (OpenAI) | Privacy, cost, offline |
| Logging | Dual (Console + DB) | Console Only | Analytics capability |

### Architecture Principles

1. **Simplicity Over Complexity**: Choose simpler solutions when sufficient
2. **Performance Matters**: Optimize hot paths (health checks, queries)
3. **Single-Server First**: Don't over-engineer for hypothetical scale
4. **Type Safety**: Catch bugs at compile time, not runtime
5. **Privacy**: Keep data local when possible
6. **Cost-Conscious**: Minimize ongoing operational costs
7. **Bar Environment**: Fast, simple, reliable for staff use

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall architecture
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Design patterns
- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) - Production setup
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security model
- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md) - Performance optimizations

---

*Architecture Decision Records v1.0.0*
