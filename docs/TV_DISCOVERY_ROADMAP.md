# TV Discovery Implementation Roadmap

**Project**: Network TV Discovery & Pairing System
**Timeline**: 4 weeks (1 developer)
**Status**: Design Complete - Ready for Implementation
**Last Updated**: 2025-11-21

---

## Quick Links

- [Design Summary](./TV_DISCOVERY_DESIGN_SUMMARY.md) - Overview & architecture
- [UX Specification](./TV_DISCOVERY_UX_SPECIFICATION.md) - Complete user flows
- [Quick Reference](./TV_DISCOVERY_QUICK_REFERENCE.md) - Developer lookup
- [Implementation Notes](./TV_DISCOVERY_IMPLEMENTATION_NOTES.md) - Code patterns

---

## Week 1: Core Discovery & Brand Detection

### Day 1-2: Database & Foundation
**Goal**: Set up database schema and core service structure

- [ ] **Database Migration**
  - Create `NetworkTVDevice` table (18 columns)
  - Add `networkTVDeviceId` to `MatrixOutput` table
  - Add indexes for performance
  - Test migration on development database
  - Files: `drizzle/migrations/XXXX_add_network_tv_device.sql`

- [ ] **Service Foundation**
  - Create `/src/lib/tv-discovery/` directory structure
  - Implement `types.ts` with TypeScript interfaces
  - Set up base logger tags `[TV_DISCOVERY]` and `[TV_PAIRING]`
  - Files: `types.ts` (100 lines)

- [ ] **Validation Schemas**
  - Add TV Discovery schemas to `/src/lib/validation/schemas.ts`
  - IP address validation
  - CIDR notation validation
  - PIN format validation
  - Files: Update `schemas.ts` (+50 lines)

**Deliverable**: Database ready, foundation files created

---

### Day 3-4: Network Scanning
**Goal**: Implement IP range scanning with port probing

- [ ] **TVDiscoveryService (Part 1)**
  - IP range generation (`ipToNumber`, `numberToIP`)
  - TCP port checking (`checkPortOpen`)
  - Progress tracking (in-memory Map)
  - Concurrent scanning (5 IPs at once)
  - Files: `discovery-service.ts` (400 lines)

- [ ] **API Endpoints (Scan)**
  - `POST /api/tv-discovery/scan` - Start scan
  - `GET /api/tv-discovery/scan/:scanId/status` - Poll progress
  - Rate limiting (10 scans/hour)
  - Input validation (Zod schemas)
  - Files: `scan/route.ts`, `scan/[scanId]/status/route.ts` (200 lines)

- [ ] **Unit Tests**
  - IP range generation tests
  - IP/number conversion tests
  - Port checking tests (mocked)
  - Files: `__tests__/discovery-service.test.ts` (150 lines)

**Deliverable**: Working network scanner, tested

---

### Day 5: Brand Detection
**Goal**: Detect Samsung, LG, Sony, Vizio, TCL

- [ ] **TVDiscoveryService (Part 2)**
  - `querySamsungDevice` (WebSocket probe)
  - `queryLGDevice` (WebSocket probe)
  - `querySonyDevice` (HTTP POST probe)
  - `queryVizioDevice` (HTTP GET probe)
  - Generic HTTP probe
  - Files: Update `discovery-service.ts` (+200 lines)

- [ ] **Brand Detection Tests**
  - Mock WebSocket connections
  - Mock HTTP responses
  - Test confidence scoring
  - Files: Update test file (+100 lines)

**Deliverable**: Brand detection working for 5 major brands

---

## Week 2: Pairing System

### Day 6-7: Base Pairing Service
**Goal**: Create brand-agnostic pairing interface

- [ ] **BasePairingClient**
  - Abstract base class
  - Common methods (`sendPairingRequest`, etc.)
  - Timeout handling
  - Files: `clients/base-client.ts` (150 lines)

- [ ] **TVPairingService**
  - Pairing session management
  - Status tracking (in-memory Map)
  - Brand client factory
  - Files: `pairing-service.ts` (300 lines)

- [ ] **Token Encryption**
  - AES-256-GCM implementation
  - `encryptToken` / `decryptToken` functions
  - Environment variable for key
  - Generate encryption key docs
  - Files: `pairing-service.ts` (+100 lines)

**Deliverable**: Base pairing infrastructure ready

---

### Day 8-9: Brand-Specific Pairing Clients
**Goal**: Implement Samsung, LG, Sony, Vizio pairing

- [ ] **SamsungPairingClient**
  - WebSocket connection to ws://ip:8001/api/v2/
  - Send pairing request
  - PIN verification
  - Auth token extraction
  - Files: `clients/samsung-client.ts` (300 lines)

- [ ] **LGWebOSPairingClient**
  - WebSocket connection to ws://ip:3000/
  - Send register command
  - Poll for acceptance (no PIN)
  - Client key extraction
  - Files: `clients/lg-webos-client.ts` (250 lines)

- [ ] **SonyBRAVIAPairingClient**
  - HTTP POST to http://ip:20060/sony/accessControl
  - PSK entry (not PIN)
  - PSK storage
  - Files: `clients/sony-bravia-client.ts` (200 lines)

- [ ] **VizioSmartCastPairingClient**
  - HTTP POST to http://ip:7345/pairing/start
  - PIN verification via HTTP
  - Auth token extraction
  - Files: `clients/vizio-smartcast-client.ts` (200 lines)

**Deliverable**: All 4 brand clients working

---

### Day 10: Pairing API Endpoints
**Goal**: Complete pairing API

- [ ] **API Endpoints (Pairing)**
  - `POST /api/tv-discovery/pair` - Initiate pairing
  - `POST /api/tv-discovery/pair/:id/verify` - Verify PIN
  - `GET /api/tv-discovery/pair/:id/status` - Poll status (LG)
  - Rate limiting (20 pairs/hour)
  - Files: `pair/route.ts`, `pair/[id]/verify/route.ts`, `pair/[id]/status/route.ts` (300 lines)

- [ ] **Integration Tests**
  - Full pairing workflow (mocked TV responses)
  - Token encryption/decryption tests
  - Database persistence tests
  - Files: `tests/integration/tv-pairing.test.ts` (200 lines)

**Deliverable**: Complete pairing system, tested

---

## Week 3: Frontend UI

### Day 11-12: Discovery Wizard Foundation
**Goal**: Create main wizard container and config step

- [ ] **State Management Hook**
  - `useDiscoveryWizard` hook
  - State machine (7 steps)
  - Navigation logic
  - Files: `hooks/useDiscoveryWizard.ts` (300 lines)

- [ ] **TVDiscoveryWizard Container**
  - Radix Dialog wrapper
  - Step router
  - Progress indicator
  - Files: `TVDiscoveryWizard.tsx` (400 lines)

- [ ] **DiscoveryConfigStep**
  - Method selection (IP Range, CIDR, Subnet)
  - IP range inputs with validation
  - Port selection checkboxes
  - Advanced options
  - Files: `DiscoveryConfigStep.tsx` (300 lines)

**Deliverable**: Config screen working, validates inputs

---

### Day 13-14: Scan Progress & Results
**Goal**: Real-time scan progress and device list

- [ ] **useScanProgress Hook**
  - Polling hook for scan status
  - Updates every 1 second
  - Auto-cleanup on unmount
  - Files: `hooks/useScanProgress.ts` (150 lines)

- [ ] **DiscoveryScanStep**
  - Radix Progress bar
  - Current IP display
  - Detected devices list
  - Cancel scan button
  - Files: `DiscoveryScanStep.tsx` (350 lines)

- [ ] **DetectedDeviceCard Component**
  - Device info display
  - Status badge (color-coded)
  - Brand override dropdown
  - Test button
  - Files: `components/DetectedDeviceCard.tsx` (150 lines)

**Deliverable**: Scan progress screen with real-time updates

---

### Day 15-16: Pairing UI
**Goal**: Brand-specific pairing interfaces

- [ ] **usePairingFlow Hook**
  - Sequential pairing state machine
  - Timeout tracking
  - Status polling
  - Files: `hooks/usePairingFlow.ts` (200 lines)

- [ ] **PairingWorkflowStep**
  - Overview screen
  - Sequential TV list
  - Start/skip buttons
  - Files: `PairingWorkflowStep.tsx` (500 lines)

- [ ] **Brand-Specific Pairing UIs**
  - `SamsungPairingCard` (4-digit PIN input)
  - `LGPairingCard` (waiting indicator)
  - `SonyPairingCard` (PSK input)
  - `VizioPairingCard` (4-digit PIN input)
  - Files: `components/PairingCard.tsx` (400 lines)

**Deliverable**: Complete pairing workflow UI

---

## Week 4: Assignment & Polish

### Day 17-18: Matrix Assignment
**Goal**: Auto-assign and manual drag-and-drop

- [ ] **Auto-Assignment Algorithm**
  - Fuzzy string matching (CEC name vs model)
  - Confidence scoring (85-100%)
  - API endpoint implementation
  - Files: `assignment-service.ts` (200 lines)

- [ ] **MatrixAssignmentStep**
  - Method selection (auto vs manual)
  - Auto-assign results view
  - Manual drag-and-drop interface
  - Power test integration
  - Files: `MatrixAssignmentStep.tsx` (400 lines)

- [ ] **Drag-and-Drop Components**
  - `DraggableTVCard` (HTML5 drag API)
  - `MatrixOutputDropZone`
  - Visual feedback (hover states)
  - Files: `components/DraggableTVCard.tsx`, `components/MatrixOutputDropZone.tsx` (300 lines)

**Deliverable**: Complete assignment workflow

---

### Day 19: API Endpoints (Assignment)
**Goal**: Complete all remaining API endpoints

- [ ] **Assignment Endpoints**
  - `POST /api/tv-discovery/assign` - Manual assignment
  - `POST /api/tv-discovery/auto-assign` - Auto-assign
  - `DELETE /api/tv-discovery/devices/:id` - Remove device
  - Files: `assign/route.ts`, `auto-assign/route.ts`, `devices/[id]/route.ts` (250 lines)

- [ ] **Power Test Integration**
  - Send CEC/IP power command
  - Verify TV response
  - Update assignment status
  - Files: Update `assign/route.ts` (+50 lines)

**Deliverable**: All API endpoints complete

---

### Day 20: Testing & Bug Fixes
**Goal**: Comprehensive testing, fix bugs

- [ ] **Integration Tests**
  - Full discovery workflow (end-to-end)
  - Error recovery scenarios
  - Timeout handling
  - Files: `tests/integration/tv-discovery-e2e.test.ts` (300 lines)

- [ ] **Manual Testing Checklist**
  - Test with real Samsung TV
  - Test with real LG TV
  - Test with real Sony TV (if available)
  - Test error scenarios (no TVs found, pairing timeout, etc.)
  - Test on mobile/tablet screen sizes
  - Files: `docs/TV_DISCOVERY_TEST_PLAN.md` (create)

- [ ] **Bug Fixes**
  - Fix any issues found during testing
  - Refine error messages
  - Improve loading states
  - Polish animations

**Deliverable**: Working system, tested on real TVs

---

## Phase Checklist

### Phase 1: Core Discovery ✅
- [x] Database schema
- [x] TVDiscoveryService
- [x] Network scanning
- [x] Brand detection
- [x] Scan API endpoints

### Phase 2: Pairing System ⬜
- [ ] TVPairingService
- [ ] Brand-specific clients (4)
- [ ] Token encryption
- [ ] Pairing API endpoints

### Phase 3: Frontend ⬜
- [ ] Discovery wizard container
- [ ] Config step
- [ ] Scan progress step
- [ ] Pairing workflow step

### Phase 4: Assignment ⬜
- [ ] Auto-assignment algorithm
- [ ] Manual drag-and-drop
- [ ] Assignment API endpoints
- [ ] Power testing

### Phase 5: Testing & Polish ⬜
- [ ] Integration tests
- [ ] Manual testing on real TVs
- [ ] Bug fixes
- [ ] Documentation updates

---

## Daily Standups (Template)

### What I did yesterday:
- Completed X, Y, Z
- Fixed bug in W

### What I'm doing today:
- Working on A, B
- Testing C

### Blockers:
- Need access to real Samsung TV for testing
- Waiting on encryption key approval

---

## Testing Milestones

### Milestone 1 (End of Week 1)
**Test**: Network scanning finds mock devices
- Can scan IP range 192.168.5.1-10
- Progress updates work
- Brand detection identifies mock Samsung/LG

### Milestone 2 (End of Week 2)
**Test**: Pairing workflow completes with mock TV
- Can initiate pairing
- PIN verification works
- Token saved to database

### Milestone 3 (End of Week 3)
**Test**: Full UI workflow with mock backend
- Can navigate all wizard steps
- Real-time updates work
- Error states display correctly

### Milestone 4 (End of Week 4)
**Test**: Complete system with real TV
- Real Samsung TV discovered
- Real pairing flow works
- Assignment and power test succeed

---

## Code Review Checkpoints

Submit PR for review at these points:

1. **End of Week 1**: Core discovery service + API
2. **End of Week 2**: Pairing service + clients + API
3. **Mid Week 3**: Frontend foundation (wizard + config)
4. **End of Week 3**: Frontend complete (all steps)
5. **Mid Week 4**: Assignment + remaining APIs
6. **End of Week 4**: Final PR with tests + docs

---

## Environment Setup (Before Starting)

### 1. Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Save to .env.local as TOKEN_ENCRYPTION_KEY
```

### 2. Database Setup
```bash
npm run db:generate  # Generate migration
npm run db:push      # Apply migration
npm run db:studio    # Verify schema
```

### 3. Install Dependencies (if needed)
```bash
npm install ws       # WebSocket client
# No other new dependencies required
```

### 4. Create Directory Structure
```bash
mkdir -p src/lib/tv-discovery/clients
mkdir -p src/components/tv-discovery/components
mkdir -p src/components/tv-discovery/hooks
mkdir -p src/app/api/tv-discovery/{scan,pair,assign,auto-assign,devices}
```

---

## Success Criteria

### Functional Requirements
- ✅ Can discover TVs via IP range scan
- ✅ Detects Samsung, LG, Sony, Vizio brands
- ✅ Can pair with Samsung TV (PIN entry)
- ✅ Can pair with LG TV (accept prompt)
- ✅ Can assign TVs to matrix outputs
- ✅ Can test power control after assignment
- ✅ All auth tokens encrypted at rest

### Performance Requirements
- ✅ Scan 24 IPs in <15 seconds
- ✅ Pairing completes in <30 seconds
- ✅ Auto-assign runs in <2 seconds
- ✅ UI updates in <100ms

### Quality Requirements
- ✅ 90%+ code coverage (unit tests)
- ✅ Zero console errors in production
- ✅ All TypeScript types defined
- ✅ No sensitive data in logs
- ✅ Passes security review

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| Can't access real TVs for testing | Create TV simulator/mock | Dev |
| Brand API changes | Version API clients | Dev |
| Performance issues | Implement concurrency limits | Dev |
| Security concerns | Code review + pen test | Security team |
| User confusion | User testing + refinement | UX/PM |

---

## Launch Checklist

Before merging to production:

- [ ] All tests passing (unit + integration)
- [ ] Manual testing on real TVs (min 2 brands)
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] User guide written
- [ ] Changelog updated
- [ ] Encryption key in production env
- [ ] Rate limits configured
- [ ] Database migration tested on staging
- [ ] Rollback plan documented

---

## Post-Launch

### Week 1 After Launch
- Monitor error logs daily
- Track usage metrics (scans/hour, pairing success rate)
- Collect user feedback
- Hot-fix critical bugs

### Week 2-4 After Launch
- Review analytics
- Identify common error patterns
- Plan improvements based on feedback
- Document lessons learned

### Future Enhancements (Phase 2)
See [Design Summary](./TV_DISCOVERY_DESIGN_SUMMARY.md) - "Future Enhancements"
- mDNS/Bonjour discovery
- Wake-on-LAN support
- Scheduled discovery
- Health monitoring

---

## Resources

### Documentation
- [UX Specification](./TV_DISCOVERY_UX_SPECIFICATION.md) - Detailed flows
- [Quick Reference](./TV_DISCOVERY_QUICK_REFERENCE.md) - Fast lookups
- [Implementation Notes](./TV_DISCOVERY_IMPLEMENTATION_NOTES.md) - Code patterns
- [Design Summary](./TV_DISCOVERY_DESIGN_SUMMARY.md) - Overview

### External References
- [Samsung Smart TV API](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references.html)
- [LG WebOS API](https://webostv.developer.lge.com/develop/app-developer-guide/control-tv)
- [Sony BRAVIA API](https://pro-bravia.sony.net/develop/integrate/ip-control/index.html)
- [Vizio SmartCast API](https://github.com/exiva/Vizio_SmartCast_API)

### Tools
- Wireshark - Network packet analysis
- Postman - API testing
- React DevTools - Component debugging
- Chrome DevTools - Network monitoring

---

**Roadmap Version 1.0**
**Last Updated**: 2025-11-21
**Status**: Ready for Implementation

**Next Step**: Generate encryption key and create database migration
