# Architecture Overview & Documentation Index

**Sports-Bar-TV-Controller Complete Architecture Documentation**

Last Updated: November 6, 2025

---

## Executive Summary

The Sports-Bar-TV-Controller is a Next.js 15 application designed to manage TV and audio systems in sports bar environments. This document serves as the master index for all architecture documentation.

### Quick Facts

- **Framework**: Next.js 15.5.6 (App Router)
- **Language**: TypeScript 5.x (100% error-free)
- **Database**: SQLite 3.x with Drizzle ORM
- **Process Manager**: PM2 (fork mode, single instance)
- **Production Port**: 3001
- **Total Tables**: 40+ database tables
- **API Endpoints**: 200+ endpoints
- **Hardware Integrations**: Fire TV, IR blasters, HDMI matrix, Audio DSP

### Architecture Characteristics

| Characteristic | Value | Notes |
|----------------|-------|-------|
| Deployment Model | Single-server | No horizontal scaling (SQLite) |
| Performance | 50-200ms API response | Optimized with singleton pattern |
| Availability | 99.9% | PM2 auto-restart, daily maintenance window |
| Scalability | 16 TVs, 20 concurrent users | Sufficient for sports bar |
| Security | PIN auth + rate limiting | Local network only |
| Type Safety | 100% | Zero TypeScript errors |
| Database Load | 300 queries/min | 70% reduction from optimizations |

---

## Core Architecture Documents

### 1. SYSTEM_ARCHITECTURE.md
**Purpose**: Overall system design and high-level architecture

**Contents**:
- Technology stack (frontend, backend, infrastructure)
- High-level architecture diagram
- Directory structure
- Data flow diagrams
- Module dependencies
- Component layers
- Integration points
- Scalability & performance
- Architecture decision records summary

**When to Read**: Starting point for understanding the entire system

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/SYSTEM_ARCHITECTURE.md`

---

### 2. SERVICE_ARCHITECTURE.md
**Purpose**: Detailed service layer documentation

**Contents**:
- Device control services (ADB, IR, CEC, DirecTV, Matrix)
- Audio processing services (Atlas HTTP/TCP, metering, AI gain)
- Content & integration services (TV guide, streaming, sports APIs)
- Utility & infrastructure services (logger, cache, validation, rate limiting)
- Common service patterns
- Service dependency graph
- Error handling strategies

**When to Read**: Implementing or debugging service layer components

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/SERVICE_ARCHITECTURE.md`

---

### 3. CODE_PATTERNS.md ⭐ NEW
**Purpose**: Design patterns and best practices used in the codebase

**Contents**:
- Structural patterns (Singleton, Factory, Repository, Service Layer)
- Behavioral patterns (Command Queue, Observer, Strategy, Circuit Breaker, Retry)
- Concurrency patterns (Promise.allSettled, Debouncing, Throttling)
- API design patterns (Standard route structure, Request validation, Response format)
- Database patterns (Transactions, Batch updates, Soft delete, Optimistic locking)
- Error handling patterns
- Anti-patterns to avoid (with examples)

**When to Read**: Before implementing new features or refactoring code

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/CODE_PATTERNS.md`

---

### 4. ARCHITECTURE_DECISION_RECORDS.md ⭐ NEW
**Purpose**: Comprehensive record of all major architectural decisions

**Contents**:
- **ADR-001**: Next.js App Router over Pages Router
- **ADR-002**: Drizzle ORM over Prisma (73% performance improvement)
- **ADR-003**: SQLite over PostgreSQL
- **ADR-004**: IR Control over CEC for Cable Boxes (Spectrum firmware limitation)
- **ADR-005**: In-Memory Rate Limiting over Redis
- **ADR-006**: PM2 Fork Mode over Cluster Mode
- **ADR-007**: PIN Authentication over OAuth
- **ADR-008**: Singleton Health Monitor with Global Object (performance fix)
- **ADR-009**: Config File Health Checks over Database Queries (100x faster)
- **ADR-010**: TypeScript 100% Error-Free Codebase (1,264 → 0 errors)
- **ADR-011**: Local Ollama LLM over Cloud AI Services
- **ADR-012**: Database-Backed Logging for Analytics

Each ADR includes: Context, Decision, Rationale, Consequences, Alternatives Considered

**When to Read**: Understanding why technical choices were made

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/ARCHITECTURE_DECISION_RECORDS.md`

---

### 5. DATA_FLOW_ARCHITECTURE.md ⭐ NEW
**Purpose**: Detailed data flow and request processing documentation

**Contents**:
- Standard API request flow (step-by-step with timing)
- Device control flows (Fire TV app launch, channel tuning)
- Authentication flow (PIN validation, session creation)
- Health monitoring flow (optimized with singleton pattern)
- IR learning flow (complete hardware interaction)
- Audio control flow
- Matrix routing flow
- Database operation flows
- Background job flows
- Error propagation

**When to Read**: Understanding how data moves through the system

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/DATA_FLOW_ARCHITECTURE.md`

---

### 6. SECURITY_ARCHITECTURE.md
**Purpose**: Security model and implementation

**Contents**:
- Authentication system (PIN-based, API keys)
- Authorization model (RBAC: STAFF vs ADMIN)
- Input validation (Zod schemas)
- Rate limiting (in-memory sliding window)
- Data protection (bcrypt hashing, sensitive data handling)
- Attack mitigation (XSS, CSRF, brute force, session hijacking)
- Audit & compliance (logging, retention policies)

**When to Read**: Implementing security features or conducting security review

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/SECURITY_ARCHITECTURE.md`

---

### 7. DEPLOYMENT_ARCHITECTURE.md
**Purpose**: Production deployment and operations

**Contents**:
- Production environment specs
- PM2 process management (configuration, commands, monitoring)
- Database management (location, operations, backups)
- Logging & monitoring (application logs, PM2 logs, health checks)
- Health monitoring setup
- Backup & recovery procedures
- Deployment process (initial, updates, rollbacks)
- Troubleshooting guide

**When to Read**: Deploying or managing production environment

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/DEPLOYMENT_ARCHITECTURE.md`

---

### 8. DATABASE_SCHEMA.md
**Purpose**: Complete database schema documentation

**Contents**:
- Schema overview (40+ tables)
- Device management tables (FireTV, DirecTV, CEC, IR)
- HDMI matrix & routing tables
- Audio processing tables (Atlas, Soundtrack)
- Content & scheduling tables (channel presets, sports events)
- Authentication & security tables (users, sessions, API keys)
- AI & training tables (QA entries, documents)
- Logging & analytics tables
- Entity relationship diagrams
- Indexes & performance
- Migration strategy

**When to Read**: Working with database schema or adding new tables

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/DATABASE_SCHEMA.md`

---

### 9. MEMORY_BANK_ARCHITECTURE.md
**Purpose**: Memory Bank system for context snapshots

**Contents**:
- System overview (component architecture)
- File watcher (change detection, debouncing)
- Context generator (git status, system state)
- Storage layer (snapshot management, auto-cleanup)
- API architecture
- CLI interface
- Data flow diagrams
- Performance optimization
- Security model

**When to Read**: Understanding or extending Memory Bank features

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/MEMORY_BANK_ARCHITECTURE.md`

---

### 10. MULTI_LOCATION_ARCHITECTURE.md
**Purpose**: Future multi-location scaling architecture

**Contents**:
- Current single-location architecture
- Multi-location requirements
- Proposed architecture (PostgreSQL, Redis, API gateway)
- Database design (multi-tenancy)
- Authentication strategy
- Data synchronization
- Migration path

**When to Read**: Planning multi-location deployment

**Path**: `/home/ubuntu/Sports-Bar-TV-Controller/docs/MULTI_LOCATION_ARCHITECTURE.md`

---

## Specialized Documentation

### Hardware Integration

| Document | Purpose | Path |
|----------|---------|------|
| HARDWARE_CONFIGURATION.md | Hardware setup guide | `/docs/` |
| CEC_DEPRECATION_NOTICE.md | Why CEC is deprecated for cable boxes | `/docs/` |
| CEC_TO_IR_MIGRATION_GUIDE.md | Migration from CEC to IR control | `/docs/` |
| IR_LEARNING_DEMO_SCRIPT.md | IR learning system implementation | `/docs/` |
| IR_EMITTER_PLACEMENT_GUIDE.md | Physical IR emitter installation | `/docs/` |
| ATLASIED_INTEGRATION_GUIDE.md | Atlas audio processor integration | `/docs/` |

### Feature Documentation

| Document | Purpose | Path |
|----------|---------|------|
| AUTHENTICATION_GUIDE.md | Authentication system setup | `/docs/` |
| BARTENDER_QUICK_START.md | Bartender UI guide | `/docs/` |
| CHANNEL_PRESET_QUICK_ACCESS.md | Channel presets feature | `/docs/` |
| FIRETV_QUICK_REFERENCE.md | Fire TV control reference | `/docs/` |
| SOUNDTRACK_INTEGRATION_GUIDE.md | Soundtrack Your Brand integration | `/docs/` |
| AI_HUB_QUICK_START.md | AI features guide | `/docs/` |

### Operations Documentation

| Document | Purpose | Path |
|----------|---------|------|
| SYSTEM_ADMIN_GUIDE.md | System administration | `/docs/` |
| TROUBLESHOOTING_GUIDE.md | Common issues and solutions | `/docs/` |
| BACKUP_RESTORE_GUIDE.md | Backup and recovery procedures | `/docs/` |
| PM2_MONITORING_REPORT.md | PM2 monitoring setup | `/docs/` |
| LOGGING_IMPLEMENTATION.md | Logging system details | `/docs/` |

### Developer Documentation

| Document | Purpose | Path |
|----------|---------|------|
| CLAUDE.md | Developer quick reference (project root) | `/` |
| API_REFERENCE.md | Complete API documentation | `/docs/` |
| API_QUICK_REFERENCE.md | Quick API reference | `/docs/` |
| TESTING_CHECKLIST.md | Testing procedures | `/docs/` |
| VALIDATION_IMPLEMENTATION_REPORT.md | Input validation system | `/docs/` |

---

## Quick Navigation by Task

### "I need to..."

**Understand the overall system**
→ Start with [SYSTEM_ARCHITECTURE.md](#1-system_architecturemd)
→ Then read [DATA_FLOW_ARCHITECTURE.md](#5-data_flow_architecturemd)

**Implement a new feature**
→ Read [CODE_PATTERNS.md](#3-code_patternsmd)
→ Check [SERVICE_ARCHITECTURE.md](#2-service_architecturemd) for similar services
→ Review [SECURITY_ARCHITECTURE.md](#6-security_architecturemd) for security requirements

**Add a new API endpoint**
→ Follow patterns in [CODE_PATTERNS.md](#3-code_patternsmd) (Standard API Route Structure)
→ Add validation schema (Zod)
→ Implement rate limiting
→ Add audit logging

**Work with the database**
→ Check [DATABASE_SCHEMA.md](#8-database_schemamd) for schema
→ Use patterns from [CODE_PATTERNS.md](#3-code_patternsmd) (Database Patterns)
→ Use `db-helpers.ts` for CRUD operations

**Debug a production issue**
→ Check [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
→ Review [DEPLOYMENT_ARCHITECTURE.md](#7-deployment_architecturemd) for PM2 commands
→ Check logs: `pm2 logs sports-bar-tv-controller`

**Understand a past decision**
→ Read [ARCHITECTURE_DECISION_RECORDS.md](#4-architecture_decision_recordsmd)
→ Find the relevant ADR
→ See context, rationale, and alternatives considered

**Deploy to production**
→ Follow [DEPLOYMENT_ARCHITECTURE.md](#7-deployment_architecturemd)
→ Run tests: `npm test`
→ Build: `npm run build`
→ Restart PM2: `pm2 restart sports-bar-tv-controller`

**Integrate new hardware**
→ Check [HARDWARE_CONFIGURATION.md](./HARDWARE_CONFIGURATION.md)
→ Review [SERVICE_ARCHITECTURE.md](#2-service_architecturemd) for similar integrations
→ Implement command queue pattern (see [CODE_PATTERNS.md](#3-code_patternsmd))

---

## Architecture Principles

### 1. Simplicity Over Complexity
Choose simpler solutions when they are sufficient. Don't over-engineer for hypothetical future requirements.

**Example**: In-memory rate limiting instead of Redis (sufficient for single-server deployment)

### 2. Performance Matters
Optimize hot paths (health checks, database queries). Measure first, optimize second.

**Example**: Config file reads (0.5ms) vs database queries (50ms) for health monitoring

### 3. Type Safety
Catch bugs at compile time, not runtime. Maintain 100% TypeScript error-free codebase.

**Example**: Zero TypeScript errors (down from 1,264)

### 4. Single-Server First
Design for single-server deployment. Plan for multi-location but don't implement prematurely.

**Example**: SQLite for simplicity, with documented PostgreSQL migration path

### 5. Bar Environment
Fast, simple, reliable for staff use. Speed matters during game rush.

**Example**: 4-digit PIN authentication (2 seconds) vs OAuth (30+ seconds)

### 6. Privacy & Cost
Keep data local when possible. Minimize ongoing operational costs.

**Example**: Local Ollama LLM instead of cloud AI services

### 7. Fail Safely
Graceful degradation, fallback to cached data, circuit breakers for external services.

**Example**: Use cached device status if real-time check fails

---

## Recent Major Changes

### November 2025

1. **Performance Optimization** (Nov 5-6)
   - Singleton health monitor with global object (ADR-008)
   - Config file reads instead of database queries (ADR-009)
   - Result: 70% reduction in database load, zero PM2 restarts

2. **TypeScript Perfection** (Nov 4)
   - Fixed all 1,264 TypeScript errors (ADR-010)
   - Enabled strict mode
   - 100% type-safe codebase

3. **Architecture Documentation** (Nov 6)
   - Created CODE_PATTERNS.md (design patterns)
   - Created ARCHITECTURE_DECISION_RECORDS.md (12 ADRs)
   - Created DATA_FLOW_ARCHITECTURE.md (data flows)
   - Created ARCHITECTURE_OVERVIEW.md (this document)

### October 2025

1. **Drizzle Migration** (Oct 15)
   - Migrated from Prisma to Drizzle ORM (ADR-002)
   - 73% performance improvement
   - Better SQLite support

2. **IR Control Migration** (Oct-Nov)
   - Deprecated CEC for cable boxes (ADR-004)
   - Implemented IR learning system
   - Universal compatibility with all cable boxes

3. **Memory Bank System** (Oct 20)
   - Automatic project context snapshots
   - File watching with auto-snapshot
   - CLI and API interfaces

---

## Technology Decisions Summary

### Framework & Language
- **Next.js 15 App Router**: Future-proof, better TypeScript support
- **TypeScript 5.x**: 100% error-free, strict mode enabled
- **React 19**: Server components, improved performance

### Database & ORM
- **SQLite**: Simple deployment, sufficient performance
- **Drizzle ORM**: 73% faster than Prisma, better SQLite support
- **db-helpers**: Repository pattern for consistent CRUD

### Infrastructure
- **PM2 Fork Mode**: Single process for SQLite compatibility
- **Port 3001**: Production port (3000 for development)
- **Ubuntu Linux**: Production OS

### Hardware Control
- **IR Control**: Universal compatibility (iTach IP2IR)
- **ADB**: Fire TV control (Android Debug Bridge)
- **CEC**: TV power only (not cable boxes)
- **TCP/UDP**: Atlas audio, HDMI matrix

### Authentication & Security
- **PIN Authentication**: Fast for bar environment
- **In-Memory Rate Limiting**: Simple, sufficient for single-server
- **Zod Validation**: Type-safe input validation
- **bcrypt**: Password/PIN hashing (12 rounds)

### AI & LLM
- **Ollama**: Local LLM (llama3.1:8b)
- **nomic-embed-text**: Local embeddings
- **RAG System**: Document search and Q&A

---

## Performance Characteristics

### API Response Times
```
Fire TV Control: 125-175ms
Channel Tuning (IR): 2000ms (sequential IR commands)
Authentication: 300-400ms (bcrypt)
Database Query: <10ms (indexed)
Health Check: 1000-2000ms (per device)
```

### Database Performance
```
Queries/minute: 300 (optimized from 1000)
Insert: ~5ms
Select (indexed): <1ms
Select (full scan): ~100ms (avoid!)
Transaction: ~10ms
```

### Health Monitoring
```
Frequency: Every 5 minutes
Duration: 5-10 seconds (16 devices in parallel)
Database writes: 1 transaction (batch update)
Memory impact: Minimal (singleton pattern)
```

---

## Common Gotchas

### 1. Request Body Consumption
```typescript
// ❌ WRONG
const validation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed!

// ✅ CORRECT
const validation = await validateRequestBody(request, schema)
const body = validation.data
```

### 2. Hardware Command Queue
```typescript
// ❌ WRONG - Concurrent commands interfere
await adbClient.sendCommand('input keyevent 3')
await adbClient.sendCommand('input keyevent 4')

// ✅ CORRECT - Commands queued automatically
class ADBClient {
  private queueCommand(fn) { /* queue implementation */ }
}
```

### 3. PM2 Requires Rebuild
```bash
# After code changes
npm run build  # Required!
pm2 restart sports-bar-tv-controller
```

### 4. GET vs POST Validation
```typescript
// ❌ WRONG
export async function GET(request: NextRequest) {
  const validation = await validateRequestBody(request, schema) // ERROR!
}

// ✅ CORRECT
export async function GET(request: NextRequest) {
  const validation = validateQueryParams(request, schema)
}
```

---

## Future Roadmap

### Short-Term (Next 3 Months)
- [ ] IR learning frontend UI
- [ ] WebSocket real-time updates
- [ ] Mobile app (React Native)
- [ ] Advanced scheduling features

### Medium-Term (3-6 Months)
- [ ] Multi-location support (PostgreSQL migration)
- [ ] Redis for distributed caching
- [ ] API gateway for authentication
- [ ] Comprehensive testing suite

### Long-Term (6-12 Months)
- [ ] Machine learning for audio optimization
- [ ] Voice control integration
- [ ] Advanced analytics dashboard
- [ ] White-label SaaS offering

---

## Contributing

### Before Implementing Features

1. Read [CODE_PATTERNS.md](#3-code_patternsmd) for design patterns
2. Check [ARCHITECTURE_DECISION_RECORDS.md](#4-architecture_decision_recordsmd) for related decisions
3. Review [SERVICE_ARCHITECTURE.md](#2-service_architecturemd) for similar implementations
4. Ensure 100% TypeScript type safety
5. Follow standard API route structure
6. Add tests for new features

### When Making Architectural Changes

1. Document decision in ARCHITECTURE_DECISION_RECORDS.md
2. Update relevant architecture documentation
3. Notify team of breaking changes
4. Update CHANGELOG.md
5. Consider backwards compatibility

---

## Support & Documentation

### Getting Help

1. **Check Documentation**: Start with this overview, then dive into specific docs
2. **Review ADRs**: Understand why decisions were made
3. **Check Code Patterns**: Follow established patterns
4. **PM2 Logs**: `pm2 logs sports-bar-tv-controller`
5. **Troubleshooting Guide**: [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

### Reporting Issues

Include:
- Current behavior vs expected behavior
- Steps to reproduce
- Relevant logs (PM2, application)
- Environment (production vs development)
- Related files/components

### Suggesting Improvements

Consider:
- Does it align with architecture principles?
- Is there an existing pattern that could be extended?
- What are the trade-offs?
- Should it be documented as an ADR?

---

## Conclusion

This architecture documentation provides comprehensive coverage of the Sports-Bar-TV-Controller system. The codebase is well-architected, highly performant, and 100% type-safe. Recent optimizations have eliminated PM2 restarts and reduced database load by 70%.

The architecture prioritizes simplicity, performance, and reliability for the sports bar environment while maintaining flexibility for future enhancements.

---

## Document Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-06 | 1.0.0 | Initial comprehensive architecture documentation |
| - | - | - Created CODE_PATTERNS.md |
| - | - | - Created ARCHITECTURE_DECISION_RECORDS.md (12 ADRs) |
| - | - | - Created DATA_FLOW_ARCHITECTURE.md |
| - | - | - Created ARCHITECTURE_OVERVIEW.md (this document) |
| - | - | - Documented all major architectural decisions |
| - | - | - Documented all design patterns |
| - | - | - Documented all data flows |

---

*For questions or clarifications about the architecture, refer to the specific documentation files linked above or create an ADR for new architectural decisions.*
