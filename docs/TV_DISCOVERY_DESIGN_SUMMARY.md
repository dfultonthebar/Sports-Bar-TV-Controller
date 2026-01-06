# TV Discovery System - Design Summary

## Overview

This document provides an executive summary of the TV Discovery system design for the Sports Bar TV Controller. The complete specifications are split across three companion documents.

**Date**: 2025-11-21
**Version**: 1.0
**Status**: Design Complete - Ready for Implementation

---

## Document Index

1. **TV_DISCOVERY_UX_SPECIFICATION.md** (Main specification - 16 sections)
   - Complete user experience flows
   - Wireframe descriptions for all screens
   - Error handling and messages
   - Database schema changes
   - API endpoint specifications
   - Brand-specific pairing details

2. **TV_DISCOVERY_QUICK_REFERENCE.md** (Developer quick reference)
   - ASCII wireframes
   - Error message lookup table
   - API quick reference
   - Brand-specific notes
   - Keyboard shortcuts
   - Common port numbers

3. **TV_DISCOVERY_IMPLEMENTATION_NOTES.md** (Technical implementation)
   - Service architecture
   - Code examples and patterns
   - Security considerations
   - Testing strategy
   - Performance optimization
   - Environment variables

---

## System Purpose

Enable bar managers to discover, pair, and configure smart TVs (Samsung, LG, Sony, Vizio, TCL) on their network for centralized remote control via IP-based APIs. This eliminates manual configuration and provides a streamlined setup experience.

---

## Key Features

### 1. Network Discovery
- **IP Range Scanning**: Specify start/end IPs (e.g., 192.168.5.1 - 192.168.5.24)
- **CIDR Scanning**: Use network notation (e.g., 192.168.5.0/24)
- **Subnet Auto-Scan**: Automatically detect and scan server's subnet
- **Multi-Port Probing**: Scan common TV ports (8001, 3000, 20060, 7345, 9080)
- **Brand Detection**: Automatically identify Samsung, LG, Sony, Vizio, TCL
- **Confidence Scoring**: High/medium/low confidence for brand detection

### 2. TV Pairing
- **Samsung**: 4-digit PIN entry from TV screen
- **LG WebOS**: Accept/Reject prompt (no PIN)
- **Sony BRAVIA**: PSK (Pre-Shared Key) entry
- **Vizio SmartCast**: 4-digit PIN entry
- **Sequential Workflow**: Guide user through pairing one TV at a time
- **Timeout Handling**: 60-second timeouts with retry options
- **Auth Token Storage**: Encrypted tokens saved to database

### 3. Matrix Output Association
- **Auto-Assignment**: Match TVs to outputs by CEC name (fuzzy matching)
- **Manual Assignment**: Drag-and-drop interface for precise control
- **Power Testing**: Verify control after assignment
- **Bulk Operations**: Assign multiple TVs simultaneously

### 4. Error Handling
- **No TVs Found**: Comprehensive troubleshooting guide
- **Pairing Failures**: Context-specific recovery options
- **Network Errors**: Clear error messages with solutions
- **Validation**: Real-time input validation with inline errors

---

## User Journey (Typical 8-TV Bar)

```
1. Click "Discover TVs" button (Device Config page)
   ↓
2. Select "IP Range" method
   ↓
3. Enter: 192.168.5.1 - 192.168.5.10
   ↓
4. Click "Start Discovery" → Wait ~8 seconds
   ↓
5. Review: 8 Samsung TVs detected (all need pairing)
   ↓
6. Click "Select All" → "Continue to Pairing"
   ↓
7. Walk to each TV, enter PIN, verify (5 minutes total)
   ↓
8. Click "Auto-assign by CEC name"
   ↓
9. Review suggestions (all match correctly)
   ↓
10. Click "Assign Selected" → Run power tests
    ↓
11. All tests pass → Click "Save & Close"
    ↓
12. ✓ Complete! 8 TVs ready in ~10 minutes
```

**Time Estimate**: 10 minutes for 8 TVs (vs 30+ minutes manual configuration)

---

## Technical Architecture

```
┌─────────────────────────────────────────┐
│      Frontend Components (React)        │
│  - TVDiscoveryWizard                    │
│  - DiscoveryConfigStep                  │
│  - DiscoveryScanStep                    │
│  - PairingWorkflowStep                  │
│  - MatrixAssignmentStep                 │
└─────────────────────────────────────────┘
              ↓ HTTP/WebSocket
┌─────────────────────────────────────────┐
│      API Routes (Next.js 15)            │
│  - POST /api/tv-discovery/scan          │
│  - GET  /api/tv-discovery/scan/:id      │
│  - POST /api/tv-discovery/pair          │
│  - POST /api/tv-discovery/verify        │
│  - POST /api/tv-discovery/assign        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      Service Layer (/src/lib)           │
│  - TVDiscoveryService                   │
│  - TVPairingService                     │
│  - SamsungPairingClient                 │
│  - LGWebOSPairingClient                 │
│  - SonyBRAVIAPairingClient              │
│  - VizioSmartCastPairingClient          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      Database (Drizzle + SQLite)        │
│  - NetworkTVDevice (new table)          │
│  - MatrixOutput (updated)               │
└─────────────────────────────────────────┘
```

---

## Database Schema

### New Table: NetworkTVDevice

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | Primary key (UUID) |
| ipAddress | TEXT | TV IP address (unique) |
| port | INTEGER | API port (8001, 3000, etc.) |
| brand | TEXT | Samsung, LG, Sony, etc. |
| model | TEXT | TV model number |
| displayName | TEXT | User-friendly name |
| authToken | TEXT | Encrypted auth token |
| pairingStatus | TEXT | unpaired, paired, expired |
| matrixOutputId | TEXT | FK to MatrixOutput |
| status | TEXT | online, offline, error |
| discoveryMethod | TEXT | ip_scan, cidr_scan, manual |
| discoveryConfidence | TEXT | high, medium, low |
| supportsPower | BOOLEAN | Power control capability |
| supportsVolume | BOOLEAN | Volume control capability |
| supportsInput | BOOLEAN | Input control capability |
| supportsApps | BOOLEAN | App control capability |
| lastSeen | TIMESTAMP | Last successful connection |
| discoveredAt | TIMESTAMP | Initial discovery time |
| createdAt | TIMESTAMP | Record creation time |
| updatedAt | TIMESTAMP | Last update time |

### MatrixOutput Updates

Add new column:
- `networkTVDeviceId` (TEXT, FK to NetworkTVDevice)

Maintains backward compatibility with existing CEC fields.

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/tv-discovery/scan | POST | Start network scan |
| /api/tv-discovery/scan/:scanId/status | GET | Poll scan progress |
| /api/tv-discovery/pair | POST | Initiate TV pairing |
| /api/tv-discovery/pair/:pairingId/verify | POST | Verify PIN/complete pairing |
| /api/tv-discovery/pair/:pairingId/status | GET | Poll pairing status (LG) |
| /api/tv-discovery/assign | POST | Assign TVs to matrix outputs |
| /api/tv-discovery/auto-assign | POST | Auto-assign by CEC names |
| /api/tv-discovery/devices/:deviceId | DELETE | Remove discovered device |

---

## Brand-Specific Details

### Samsung
- **Ports**: 8001 (WS), 8002 (WSS)
- **Pairing**: 4-digit PIN on TV screen
- **API**: WebSocket-based
- **Settings**: Enable "External Device Manager"
- **Timeout**: 60 seconds

### LG WebOS
- **Ports**: 3000 (WS), 3001 (WSS)
- **Pairing**: Accept/Reject prompt (no PIN)
- **API**: WebSocket-based
- **Settings**: Enable "LG Connect Apps"
- **Timeout**: 45 seconds

### Sony BRAVIA
- **Ports**: 20060 (HTTP)
- **Pairing**: PSK from TV settings menu
- **API**: HTTP REST
- **Settings**: Enable "IP Control" + set PSK
- **Timeout**: 120 seconds

### Vizio SmartCast
- **Ports**: 7345 (HTTP), 9000 (Cast)
- **Pairing**: 4-digit PIN on TV screen
- **API**: HTTP REST
- **Settings**: Enable "Cast"
- **Timeout**: 60 seconds

### TCL Roku TV
- **Ports**: 8060 (ECP), 9080 (Legacy)
- **Pairing**: Not required for basic control
- **API**: ECP (External Control Protocol)
- **Settings**: Enable "External Control"
- **Note**: Limited power control via IP

---

## Security Measures

### 1. Authentication Token Encryption
- AES-256-GCM encryption for all stored tokens
- Unique IV per token
- Environment variable for encryption key
- Never log plaintext tokens

### 2. Input Validation
- Zod schemas for all API inputs
- IP address format validation
- CIDR notation validation
- PIN format validation (4 digits)
- Port range validation (1-65535)

### 3. Rate Limiting
- Max 10 scans per hour per IP
- Max 20 pairing attempts per hour
- Prevent network flooding
- Configurable via RateLimitConfigs

### 4. Network Isolation
- Only scan specified IP ranges
- No outbound internet access required
- Local network only
- Firewall-friendly

---

## Performance Targets

| Operation | Target | Acceptable | Notes |
|-----------|--------|------------|-------|
| IP scan (24 hosts) | 10s | 20s | Concurrent scanning |
| Single pairing | 15s | 30s | User walk time |
| All pairings (8 TVs) | 5min | 10min | Sequential process |
| Auto-assign | <1s | 2s | Fuzzy matching |
| Power test | 3s | 5s | CEC/IP command |
| Database save | <500ms | 1s | SQLite write |

### Optimization Strategies
- Concurrent IP scanning (5-10 hosts at once)
- Aggressive timeouts (2s per host)
- Connection pooling for HTTP requests
- Early termination on first successful port
- In-memory progress caching

---

## Testing Requirements

### Unit Tests
- IP range generation
- IP to/from number conversion
- Brand detection logic
- PIN validation
- CIDR parsing

### Integration Tests
- Full discovery workflow (scan → pair → assign)
- Samsung pairing flow
- LG pairing flow
- Auto-assignment algorithm
- Power test execution

### E2E Tests
- Complete user journey (8 TVs)
- Error recovery flows
- Timeout handling
- Network failure scenarios

### Manual Testing
- Test with real TVs (all supported brands)
- Verify pairing prompts appear correctly
- Test power control after assignment
- Verify encrypted tokens in database

---

## Error Messages (Most Common)

| Error Code | User Message | Solution |
|------------|--------------|----------|
| NO_TVS_FOUND | No TVs detected in the specified range | Check TVs are on, network control enabled |
| PAIRING_TIMEOUT | TV did not respond within 60 seconds | Ensure someone is at TV to accept pairing |
| PAIRING_REJECTED | Pairing request was denied on the TV | Press Allow/Accept on TV screen |
| INVALID_PIN | Invalid PIN format | Enter 4-digit PIN shown on TV |
| TV_UNREACHABLE | Cannot reach TV at {ip} | Check TV power and network connection |
| NETWORK_ERROR | Network connection failed | Check server network access |

---

## Component Breakdown

### Frontend Components (Estimate)
- TVDiscoveryWizard.tsx (~400 lines)
- DiscoveryConfigStep.tsx (~300 lines)
- DiscoveryScanStep.tsx (~350 lines)
- PairingWorkflowStep.tsx (~500 lines)
- MatrixAssignmentStep.tsx (~400 lines)
- Supporting components (~800 lines)
- **Total**: ~2,750 lines

### Backend Services (Estimate)
- TVDiscoveryService (~600 lines)
- TVPairingService (~400 lines)
- SamsungPairingClient (~300 lines)
- LGWebOSPairingClient (~250 lines)
- SonyBRAVIAPairingClient (~200 lines)
- VizioSmartCastPairingClient (~200 lines)
- API routes (~600 lines)
- **Total**: ~2,550 lines

### Total Estimated Code: ~5,300 lines

---

## Implementation Phases

### Phase 1: Core Discovery (Week 1)
- [ ] Database schema migration
- [ ] TVDiscoveryService implementation
- [ ] Basic network scanning
- [ ] IP range generation
- [ ] Port probing logic
- [ ] Progress tracking
- [ ] API endpoints (scan, status)

### Phase 2: Brand Detection (Week 1-2)
- [ ] Samsung detection
- [ ] LG detection
- [ ] Sony detection
- [ ] Vizio detection
- [ ] Generic fallback
- [ ] Confidence scoring

### Phase 3: Pairing System (Week 2)
- [ ] TVPairingService base
- [ ] SamsungPairingClient
- [ ] LGWebOSPairingClient
- [ ] SonyBRAVIAPairingClient
- [ ] VizioSmartCastPairingClient
- [ ] Token encryption
- [ ] API endpoints (pair, verify, status)

### Phase 4: Frontend (Week 3)
- [ ] TVDiscoveryWizard container
- [ ] DiscoveryConfigStep
- [ ] DiscoveryScanStep
- [ ] PairingWorkflowStep
- [ ] Real-time progress updates
- [ ] Error handling UI

### Phase 5: Assignment (Week 3-4)
- [ ] MatrixAssignmentStep
- [ ] Auto-assign algorithm
- [ ] Drag-and-drop UI
- [ ] Power test integration
- [ ] API endpoints (assign, auto-assign)

### Phase 6: Testing & Polish (Week 4)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing with real TVs
- [ ] Error message refinement
- [ ] Performance optimization
- [ ] Documentation
- [ ] User acceptance testing

**Total Estimated Time**: 4 weeks (1 developer)

---

## Dependencies

### NPM Packages (New)
- `ws` - WebSocket client for Samsung/LG
- `node-cidr` - CIDR parsing (or implement manually)
- No other new dependencies required

### Existing Dependencies (Used)
- `next` - App Router for API routes
- `drizzle-orm` - Database access
- `zod` - Input validation
- `@radix-ui/*` - UI components
- `tailwindcss` - Styling

---

## Configuration

### Environment Variables
```bash
# Token encryption (REQUIRED)
TOKEN_ENCRYPTION_KEY=<32-byte-hex-string>

# Discovery settings (OPTIONAL)
TV_DISCOVERY_DEFAULT_TIMEOUT=2000
TV_DISCOVERY_MAX_CONCURRENT=10
TV_DISCOVERY_ENABLE_CACHE=true

# Pairing settings (OPTIONAL)
TV_PAIRING_DEFAULT_TIMEOUT=60
TV_PAIRING_LG_TIMEOUT=45
TV_PAIRING_SONY_TIMEOUT=120

# Feature flags (OPTIONAL)
TV_DISCOVERY_ENABLE_CEC_FALLBACK=true
TV_DISCOVERY_ENABLE_AUTO_ASSIGN=true
```

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Success Metrics

### User Experience
- Time to configure 8 TVs: <10 minutes (target)
- Pairing success rate: >95%
- Auto-assign accuracy: >90%
- User error rate: <5%

### System Performance
- Scan time (24 IPs): <15 seconds
- API response time: <500ms (p95)
- Database write time: <200ms
- Zero network timeouts: >98%

### Reliability
- Uptime: 99.9%
- Error recovery rate: >95%
- Token persistence: 100%
- No data loss: 100%

---

## Future Enhancements (Post-MVP)

### Phase 2 Features
1. **mDNS/Bonjour Discovery** - Auto-detect TVs without scanning
2. **Wake-on-LAN** - Wake TVs before discovery
3. **Scheduled Discovery** - Auto-run daily/weekly
4. **Health Monitoring** - Periodic status checks
5. **Bulk Operations** - Pair all TVs automatically
6. **Import/Export** - Save/restore configurations
7. **TV Firmware Updates** - Check and apply updates
8. **Advanced Diagnostics** - Network speed tests, latency monitoring

### Integrations
- Google Cast discovery
- Apple AirPlay discovery
- Roku device discovery (separate from TCL)
- Android TV discovery
- Smart home integrations (Home Assistant, etc.)

---

## Known Limitations

### Technical Limitations
1. **Spectrum Cable Boxes**: Do not support CEC (known issue)
2. **TCL Power Control**: Limited via IP (CEC recommended)
3. **Vizio CEC**: Inconsistent, prefer IP control
4. **Network Firewalls**: May block scanning/pairing
5. **WiFi TVs**: May have higher latency than wired

### User Experience Limitations
1. **Physical Access Required**: User must be at TV for pairing
2. **Sequential Pairing**: One TV at a time (cannot batch)
3. **Network Knowledge**: User must know IP range/subnet
4. **TV Settings**: Network control must be pre-enabled on TVs

### Workarounds
- Provide clear setup guide for TV network settings
- Show network detection tips during scan
- Offer manual add option for problem TVs
- Fall back to CEC/IR for unsupported TVs

---

## Related Documentation

### Existing Docs (Reference)
- `/docs/CEC_TV_DISCOVERY_GUIDE.md` - CEC discovery (existing system)
- `/docs/HARDWARE_CONFIGURATION.md` - Hardware setup
- `/docs/API_REFERENCE.md` - API standards

### New Docs (This Design)
- `/docs/TV_DISCOVERY_UX_SPECIFICATION.md` - Complete UX flows
- `/docs/TV_DISCOVERY_QUICK_REFERENCE.md` - Developer quick ref
- `/docs/TV_DISCOVERY_IMPLEMENTATION_NOTES.md` - Code patterns

### To Be Created
- `/docs/TV_DISCOVERY_USER_GUIDE.md` - End-user instructions
- `/docs/TV_DISCOVERY_TROUBLESHOOTING.md` - Common issues
- `/docs/TV_BRAND_SETUP_GUIDES.md` - Per-brand setup steps

---

## Open Questions

1. **Token Expiry**: Should tokens auto-renew or require re-pairing?
   - **Recommendation**: Auto-renew if possible (brand-specific)

2. **Multi-Location Support**: How to handle multiple bar locations?
   - **Recommendation**: Phase 2 feature (location selector)

3. **Conflict Resolution**: What if CEC and IP control both exist?
   - **Recommendation**: Prefer IP control, allow user override

4. **Network Segmentation**: How to handle TVs on different subnets?
   - **Recommendation**: Support multiple scan ranges in sequence

5. **Offline Mode**: Can discovery work offline (saved scans)?
   - **Recommendation**: Phase 2 feature (scan history)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TVs not responding to scan | Medium | High | Provide troubleshooting guide |
| Pairing failures | Medium | Medium | Retry logic + clear errors |
| Network firewall blocking | Low | High | Document required ports |
| Token encryption key loss | Low | Critical | Backup procedures |
| Performance issues (large scans) | Low | Medium | Concurrent scanning + timeouts |
| Brand API changes | Low | Medium | Versioned API clients |

---

## Conclusion

The TV Discovery system provides a comprehensive, user-friendly solution for discovering and configuring smart TVs in sports bar environments. The design balances ease of use with technical robustness, supporting major TV brands while providing fallback options for edge cases.

Key strengths:
- **User-focused design**: Step-by-step wizard with clear guidance
- **Brand coverage**: Supports 5 major TV brands (90%+ market share)
- **Error handling**: Comprehensive error recovery at every step
- **Security**: Encrypted token storage, input validation, rate limiting
- **Performance**: Fast scanning with concurrent operations
- **Extensibility**: Easy to add new brands or features

The system is ready for implementation and estimated to take 4 weeks for a single developer to complete all phases.

---

**Design Summary Version 1.0**
**Last Updated**: 2025-11-21
**Status**: ✅ Design Complete - Ready for Development

**Next Steps**:
1. Review design with stakeholders
2. Generate encryption key for development
3. Create database migration
4. Begin Phase 1 implementation
5. Schedule user acceptance testing
