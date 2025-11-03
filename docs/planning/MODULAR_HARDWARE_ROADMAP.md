# Modular Hardware Support Roadmap

## Overview
Plan to make the Sports Bar TV Controller support multiple hardware vendors through a modular, plugin-based architecture.

## Current State (v1.0)

### Hardcoded Hardware Support
- **Audio:** AtlasIED Atmosphere (AZM4/AZM8) only
- **Matrix:** Wolf Pack HDMI Matrix only
- **TV Control:** CEC (Pulse-Eight), IR (Global Cache), Fire TV
- **Music:** Soundtrack Your Brand

### Issues with Current Architecture
- Tightly coupled to specific hardware APIs
- Can't easily add new hardware vendors
- All hardware features visible even if not present
- No hardware selection/configuration UI

## Goals

### Primary Goals
1. **Hardware Abstraction** - Generic interfaces for each device type
2. **Plugin Architecture** - Easy to add new hardware drivers
3. **Auto-Detection** - Discover available hardware automatically
4. **Feature Manager** - Enable/disable features based on hardware
5. **Clean UI** - Only show controls for available hardware

### Secondary Goals
- Reduce bundle size (lazy load unused drivers)
- Better error handling (graceful degradation)
- Improved onboarding (setup wizard)
- Multiple hardware of same type (e.g., 2 different matrices)

## Hardware Inventory

### Audio Processors Available for Testing

#### DBX ZonePro Series
**What we have:**
- [ ] DBX ZonePro 640/640m (specify model)
- [ ] DBX ZonePro 1260/1260m (specify model)
- [ ] Other model: _______________

**Connection Info:**
- Control Method: [ ] Ethernet [ ] RS-232 [ ] Both
- IP Address (if Ethernet): _______________
- Port: Usually 23 (Telnet)
- Credentials: [ ] None [ ] Username/Password

**Documentation:**
- [ ] Programming manual available
- [ ] Protocol specification available
- [ ] Example control code available
- [ ] Need to request from DBX

#### Crestron Audio Processors
**What we have:**
- [ ] Model: _______________
- [ ] Model: _______________

**Connection Info:**
- Control Method: _______________
- IP Address: _______________
- Port: _______________

**Documentation:**
- [ ] Available
- [ ] Need to obtain

### Matrix Switchers Available for Testing

#### Crestron Matrices
**What we have:**
- [ ] Crestron DM model: _______________
- [ ] Crestron HD model: _______________
- [ ] Other: _______________

**Connection Info:**
- Control Method: [ ] CIP (Port 41794) [ ] HTTP/REST [ ] Telnet [ ] Other
- IP Address: _______________
- Authentication: [ ] None [ ] Username/Password [ ] API Key

**Documentation:**
- [ ] Programming guide available
- [ ] Protocol specification available
- [ ] Need to obtain

#### Wolf Pack Matrices (Current)
**Current Implementation:**
- Telnet control (Port 23)
- Text-based commands
- Working in production

### Other Hardware (Future Consideration)

#### Additional Audio Processors
- [ ] QSC Q-SYS
- [ ] Biamp Tesira
- [ ] Yamaha MTX/MRX series
- [ ] BSS Soundweb
- [ ] Other: _______________

#### Additional Matrix Switchers
- [ ] Extron DXP/XTP series
- [ ] Atlona Velocity
- [ ] Kramer VS/VP series
- [ ] Black Magic Design
- [ ] Other: _______________

#### Additional Music Services
- [ ] Rockbot
- [ ] Pandora for Business
- [ ] Custom Radio Solutions
- [ ] Other: _______________

## Technical Architecture Plan

### Phase 0: Pre-Implementation (CURRENT PHASE)
**Status:** Planning and Documentation
**Duration:** Ongoing

**Tasks:**
- [x] Document current architecture
- [ ] Gather hardware inventory details
- [ ] Collect hardware documentation
- [ ] Set up test environment for each device type
- [x] Create this roadmap document
- [ ] Get v1.0 stable and debugged
- [ ] Decide on "go" date for refactor

**Deliverables:**
- Complete hardware inventory
- Hardware access for testing
- Documentation collected
- Stable v1.0 baseline

### Phase 1: Abstraction Layer Foundation
**Status:** Not Started
**Duration:** 1.5-2 days (8-12 hours)

**Tasks:**
1. Create abstract interfaces
2. Implement factory pattern
3. Refactor AtlasIED to use interface
4. Refactor Wolf Pack to use interface
5. Update database schema
6. Test existing functionality still works

**Files to Create:**
```
src/lib/audio-processors/
  ├── index.ts              # AudioProcessor interface
  ├── factory.ts            # Create processor by type
  ├── atlasied/
  │   ├── index.ts          # AtlasIED driver
  │   ├── commands.ts       # Command definitions
  │   └── parser.ts         # Response parsing
  └── types.ts              # Shared types

src/lib/matrix-switchers/
  ├── index.ts              # MatrixSwitcher interface
  ├── factory.ts            # Create switcher by type
  ├── wolfpack/
  │   ├── index.ts          # Wolf Pack driver
  │   ├── commands.ts       # Command definitions
  │   └── parser.ts         # Response parsing
  └── types.ts              # Shared types
```

**Database Changes:**
```sql
-- Store which hardware is active
CREATE TABLE hardwareConfigs (
  id TEXT PRIMARY KEY,
  category TEXT,            -- 'audio-processor', 'matrix-switcher'
  vendor TEXT,              -- 'atlasied', 'dbx', 'crestron'
  model TEXT,
  connectionType TEXT,      -- 'http', 'telnet', 'rs232'
  config JSON,              -- IP, port, credentials, etc.
  isActive BOOLEAN,
  lastDetected TIMESTAMP
)
```

**Success Criteria:**
- [ ] Existing AtlasIED features work unchanged
- [ ] Existing Wolf Pack features work unchanged
- [ ] Code is cleaner and more maintainable
- [ ] Tests pass

### Phase 2: Feature Manager System
**Status:** Not Started
**Duration:** 1-2 days (6-8 hours)

**Tasks:**
1. Create systemFeatures database table
2. Build feature registry
3. Implement React context for features
4. Create FeatureGuard component
5. Update navigation to use features
6. Build Feature Manager UI page

**Files to Create:**
```
src/lib/features/
  ├── registry.ts           # All feature definitions
  ├── types.ts              # Feature interfaces
  └── context.tsx           # React context

src/components/
  └── FeatureGuard.tsx      # Conditional rendering

src/app/system-admin/features/
  └── page.tsx              # Feature Manager UI
```

**UI Location:**
- System Admin → Feature Manager tab

**Success Criteria:**
- [ ] Can enable/disable features
- [ ] Navigation updates based on features
- [ ] Home page cards conditional
- [ ] Settings persist in database

### Phase 3: Hardware Detection System
**Status:** Not Started
**Duration:** 1-2 days (6-8 hours)

**Tasks:**
1. Create detection functions for each hardware type
2. Build detection orchestrator
3. Add "Detect Hardware" button to UI
4. Show detection status/results
5. Auto-enable features based on detection

**Files to Create:**
```
src/lib/features/detectors/
  ├── audio-atlasied.ts
  ├── audio-dbx.ts
  ├── audio-crestron.ts
  ├── matrix-wolfpack.ts
  ├── matrix-crestron.ts
  └── orchestrator.ts       # Run all detections
```

**Detection Logic:**
- Network scan for common IP ranges
- Port scanning with timeouts
- Protocol validation (send test command)
- Device identification
- Update database with results

**Success Criteria:**
- [ ] Detects AtlasIED processors
- [ ] Detects Wolf Pack matrices
- [ ] Detects CEC adapters
- [ ] Shows clear results in UI
- [ ] Auto-enables appropriate features

### Phase 4: DBX ZonePro Integration
**Status:** Not Started
**Duration:** 1 day (4-6 hours)

**Prerequisites:**
- [ ] Phase 1-3 complete
- [ ] DBX hardware available for testing
- [ ] DBX documentation collected
- [ ] Network access to DBX device
- [ ] Know IP address and credentials

**Tasks:**
1. Research DBX ZonePro protocol
2. Implement DBX driver
3. Create detection function
4. Add to feature registry
5. Test with real hardware
6. Document DBX-specific setup

**Files to Create:**
```
src/lib/audio-processors/dbx-zonepro/
  ├── index.ts              # DBX driver implementation
  ├── commands.ts           # DBX command definitions
  ├── parser.ts             # Response parsing
  └── types.ts              # DBX-specific types

docs/
  └── HARDWARE_DBX_ZONEPRO.md  # Setup guide
```

**DBX Protocol Research:**
- Command format: `SETD channel parameter value`
- Response format: Need to verify
- Meter data format: Need to verify
- Zone structure: How zones are defined
- Volume range: Typically -100dB to +20dB

**Testing Checklist:**
- [ ] Can connect via Telnet
- [ ] Can query zone information
- [ ] Can set zone volume
- [ ] Can get meter readings
- [ ] Can route sources
- [ ] All UI controls work
- [ ] Error handling works
- [ ] Disconnection recovery works

**Success Criteria:**
- [ ] DBX ZonePro detected automatically
- [ ] Can control zones via UI
- [ ] Volume control works
- [ ] Meters display (if available)
- [ ] Works alongside AtlasIED (not replacing it)

### Phase 5: Crestron Matrix Integration
**Status:** Not Started
**Duration:** 1-2 days (6-10 hours)

**Prerequisites:**
- [ ] Phase 1-3 complete
- [ ] Crestron hardware available for testing
- [ ] Crestron documentation collected
- [ ] Network access to Crestron device
- [ ] Know model, IP, credentials, control method

**Tasks:**
1. Research Crestron DM protocol (CIP or REST)
2. Implement Crestron driver
3. Handle authentication
4. Create detection function
5. Add to feature registry
6. Test with real hardware
7. Document Crestron-specific setup

**Files to Create:**
```
src/lib/matrix-switchers/crestron/
  ├── index.ts              # Crestron driver
  ├── cip-client.ts         # CIP protocol (if needed)
  ├── rest-client.ts        # REST API (if available)
  ├── commands.ts           # Command definitions
  └── types.ts              # Crestron types

docs/
  └── HARDWARE_CRESTRON_MATRIX.md  # Setup guide
```

**Crestron Protocol Research:**
- Which protocol: CIP vs REST vs Telnet
- Authentication method
- Command format
- Response parsing
- Input/output enumeration
- Routing commands
- Preset management

**Testing Checklist:**
- [ ] Can connect to Crestron
- [ ] Can authenticate
- [ ] Can query inputs/outputs
- [ ] Can route sources to displays
- [ ] Can save/recall presets
- [ ] All UI controls work
- [ ] Error handling works

**Success Criteria:**
- [ ] Crestron matrix detected automatically
- [ ] Can route sources via UI
- [ ] Preset management works
- [ ] Works alongside Wolf Pack (not replacing it)

### Phase 6: Setup Wizard (Optional Enhancement)
**Status:** Not Started
**Duration:** 1 day (4-6 hours)

**Tasks:**
1. Create first-time setup flow
2. Welcome screen
3. Hardware detection step
4. Hardware selection step
5. Feature configuration step
6. Test & verify step
7. Completion screen

**User Flow:**
```
Welcome → Detect Hardware → Review Results →
Select Hardware → Configure Features → Test → Done
```

**Success Criteria:**
- [ ] First-time users can configure system
- [ ] Auto-detection works
- [ ] Manual configuration available
- [ ] Can skip wizard and configure later
- [ ] Wizard can be re-run

### Phase 7: Additional Hardware (As Needed)
**Status:** Not Started
**Duration:** 1 day per device type

**Future Hardware Additions:**
Each new hardware type follows same pattern:
1. Research protocol (2-4 hours)
2. Implement driver (2-3 hours)
3. Add detection (1 hour)
4. Test (1-2 hours)
5. Document (1 hour)

## Implementation Strategy

### Approach: Staged Rollout ✅

**Stage 1: Foundation (3-5 days)**
- Complete Phase 1-3
- Get abstraction layer working
- Get feature manager working
- Get detection working
- Verify existing hardware still works

**Stage 2: First New Hardware (1-2 days)**
- Implement DBX ZonePro OR Crestron Matrix
- Validate the abstraction layer works
- Fix any issues with the pattern
- Update documentation

**Stage 3: Expand Hardware Support (1 day each)**
- Add remaining hardware types
- Each new device validates the system
- Gets easier with each addition

**Stage 4: Polish (1-2 days)**
- Setup wizard
- Better error messages
- Performance optimization
- User documentation

### What NOT to Do ❌

**Don't:**
- Do a "big bang" rewrite
- Break existing functionality
- Add all hardware at once
- Skip testing between phases
- Forget to document

**Do:**
- Keep existing features working
- Test after each phase
- Add one hardware type at a time
- Document as you go
- Get feedback from users

## Success Metrics

### Technical Metrics
- [ ] All existing features still work
- [ ] Can detect available hardware automatically
- [ ] Can add new hardware in < 1 day
- [ ] Code coverage > 70%
- [ ] No performance regression

### User Experience Metrics
- [ ] New users can set up system in < 15 minutes
- [ ] Clear indication of what hardware is available
- [ ] Only shows controls for available hardware
- [ ] Easy to add/change hardware
- [ ] Good error messages when hardware unavailable

### Business Metrics
- [ ] Can support multiple customer hardware configs
- [ ] Reduced support burden (clearer errors)
- [ ] Faster customer onboarding
- [ ] Easier to demo with different hardware

## Documentation Plan

### User Documentation
- [ ] Hardware compatibility matrix
- [ ] Setup guide for each hardware type
- [ ] Feature Manager user guide
- [ ] Troubleshooting guide
- [ ] Video tutorials (optional)

### Developer Documentation
- [ ] Architecture overview
- [ ] How to add new hardware driver
- [ ] Interface specifications
- [ ] Testing guide
- [ ] Code examples

### Hardware-Specific Guides
- [x] AtlasIED Atmosphere (existing)
- [ ] DBX ZonePro setup
- [ ] Crestron Matrix setup
- [ ] Crestron Audio setup
- [ ] Hardware comparison matrix

## Risk Assessment

### High Risk ⚠️
**Risk:** Breaking existing functionality during refactor
**Mitigation:**
- Thorough testing after each phase
- Keep v1.0 backup branch
- Incremental changes
- Can rollback at any point

### Medium Risk ⚡
**Risk:** Hardware detection false positives/negatives
**Mitigation:**
- Allow manual override
- Multiple detection methods
- Clear status indicators
- Timeout handling

**Risk:** Protocol documentation incomplete/incorrect
**Mitigation:**
- Test with real hardware early
- Packet sniffing if needed
- Contact vendor support
- Community research

### Low Risk ✅
**Risk:** Performance degradation
**Mitigation:**
- Lazy loading
- Efficient detection
- Caching
- Benchmarking

## Timeline Estimate

### Optimistic (Everything Goes Smoothly)
- Phase 1-3: 5 days
- Phase 4: 1 day
- Phase 5: 1 day
- Phase 6: 1 day
- **Total: 8 days**

### Realistic (Some Issues, Testing, Debugging)
- Phase 1-3: 7 days
- Phase 4: 2 days
- Phase 5: 2 days
- Phase 6: 2 days
- **Total: 13 days**

### Pessimistic (Significant Challenges)
- Phase 1-3: 10 days
- Phase 4: 3 days
- Phase 5: 3 days
- Phase 6: 2 days
- **Total: 18 days**

**Recommendation:** Plan for realistic timeline (13 days = ~2.5 weeks)

## Next Steps (Pre-Implementation Checklist)

### Before Starting Phase 1:
- [ ] v1.0 is stable and debugged
- [ ] All current features working in production
- [ ] No outstanding critical bugs
- [ ] Git branch created for modular work
- [ ] Backup plan in place (can rollback)
- [ ] Decision made to proceed

### Hardware Preparation:
- [ ] Complete hardware inventory section above
- [ ] Collect all hardware documentation
- [ ] Ensure network access to test devices
- [ ] Get credentials/login info
- [ ] Set up test bench if needed
- [ ] Identify primary contact for hardware questions

### Documentation Preparation:
- [ ] Review DBX ZonePro documentation
- [ ] Review Crestron documentation
- [ ] Download protocol specifications
- [ ] Find example code if available
- [ ] Join vendor forums/communities

### Team Preparation:
- [ ] Allocate development time
- [ ] Plan testing schedule
- [ ] Identify testing resources
- [ ] Plan for user feedback
- [ ] Set milestone dates

## Questions to Answer Before Starting

### Technical Questions:
1. **DBX ZonePro:**
   - [ ] What models do you have?
   - [ ] Ethernet or RS-232 connection?
   - [ ] Do you have programming manuals?
   - [ ] Can you capture sample telnet session?

2. **Crestron Matrices:**
   - [ ] What models do you have?
   - [ ] What control method? (CIP/REST/Telnet)
   - [ ] Do you have programming guides?
   - [ ] Is there existing control program?

3. **Testing:**
   - [ ] Can we test without disrupting production?
   - [ ] Do we have a test environment?
   - [ ] Who will be testing?
   - [ ] What's the testing timeline?

### Business Questions:
1. **Priority:**
   - [ ] Which hardware is highest priority?
   - [ ] Is this for existing customers or new ones?
   - [ ] What's the target completion date?

2. **Resources:**
   - [ ] How many hours per week available?
   - [ ] Any deadlines or constraints?
   - [ ] Budget for testing equipment?

3. **Success Criteria:**
   - [ ] What does "done" look like?
   - [ ] Who needs to approve?
   - [ ] What's required for go-live?

## Contact & Resources

### Hardware Vendors:
- **DBX Support:** https://dbxpro.com/en/support
- **Crestron Support:** https://support.crestron.com
- **AtlasIED Support:** https://www.atlasied.com/support

### Community Resources:
- Crestron Programming Forums
- AVS Forum - Commercial AV
- Reddit: r/CommercialAV
- GitHub repos with protocol implementations

### Internal Resources:
- [Link to test environment]
- [Link to hardware inventory spreadsheet]
- [Link to documentation folder]
- [Link to project management board]

---

**Document Status:** Planning Phase
**Last Updated:** October 30, 2024
**Next Review:** When v1.0 is stable and ready to proceed
**Owner:** [Your Name]

## Approval to Proceed

Before starting Phase 1, confirm:
- [ ] v1.0 is stable
- [ ] Hardware inventory complete
- [ ] Documentation collected
- [ ] Timeline approved
- [ ] Resources allocated
- [ ] Go/No-Go decision: __________

**Approved By:** _______________
**Date:** _______________
