# Network Architecture Decision Record

**Date**: 2025-11-03
**Status**: RECOMMENDED ARCHITECTURE
**Decision Makers**: Sports Bar TV Controller System Team

---

## Context

The Sports Bar TV Controller system currently has devices split across two network subnets:
- **192.168.5.x** (Primary/Active) - New system subnet
- **192.168.1.x** (Legacy) - Old system subnet

This network segmentation is causing connectivity issues and operational complexity.

---

## Current Network Topology

### Active Devices (192.168.5.x subnet) ✅

| Device | IP Address | Status | Function |
|--------|------------|--------|----------|
| **Control Server** | 192.168.5.??? | Online | Intel NUC running controller |
| **Wolf Pack Matrix** | 192.168.5.100:23 | ✅ Online | HDMI video routing (4x4) |
| **AtlasIED AZMP8** | 192.168.5.101:5321 | ✅ Online | Audio processor (8 zones) |
| **Fire TV Cube (Amazon 1)** | 192.168.5.131:5555 | ✅ Online | Streaming device |
| **DirecTV 1** | 192.168.5.121 | ⚠️ Offline | Satellite receiver |

### Legacy Devices (192.168.1.x subnet) ⚠️

| Device | IP Address | Status | Function |
|--------|------------|--------|----------|
| **DirecTV 2-8** | 192.168.1.122-128 | ❌ Unreachable | 7 satellite receivers |
| **Global Cache iTach 1** | 192.168.1.110 | ❌ Unreachable | IR blaster for AV control |
| **Global Cache iTach 2** | 192.168.1.111 | ❌ Unreachable | IR blaster for AV control |
| **Old Matrix System** | 192.168.1.??? | 🔄 Active (legacy) | Previous HDMI matrix |
| **Fire TV (Amazon 2)** | 192.168.1.??? | 🔄 Active (legacy) | Currently with old system |

**Note**: Amazon 2 Fire TV is intentionally on the legacy network as it's being used with the older matrix system until migration is complete.

---

## Problem Statement

### Issues with Current Dual-Subnet Configuration:

1. **Unreachable Devices** (HIGH IMPACT)
   - 7 DirecTV receivers cannot be controlled or monitored
   - 2 Global Cache IR controllers are inaccessible
   - No remote channel changing or power control for legacy subnet

2. **Operational Complexity** (MEDIUM IMPACT)
   - Two separate network configurations to maintain
   - Confusion about which devices are on which subnet
   - Documentation must track both networks
   - Troubleshooting requires checking multiple subnets

3. **Migration Risk** (MEDIUM IMPACT)
   - Devices may be misconfigured during transition
   - Static IPs may conflict if not properly managed
   - Service interruption during network changes

4. **Configuration Drift** (LOW IMPACT)
   - Static config file had wrong IP (192.168.1.100 vs 192.168.5.100)
   - Indicates documentation may not match reality

---

## Decision

### **RECOMMENDED: Consolidate to 192.168.5.x Subnet**

All production devices should be migrated to the **192.168.5.x** subnet as the single, unified network for the Sports Bar TV Controller system.

### Rationale:

1. **Wolf Pack Matrix is the future** - Already on 192.168.5.x
2. **Control server requires direct access** - 192.168.5.x is the active subnet
3. **Simpler management** - Single subnet, single configuration
4. **Better performance** - No VLAN routing overhead
5. **Clean migration path** - Old system can be phased out completely

---

## Recommended Implementation Plan

### Phase 1: Documentation & Planning (30 minutes)

1. ✅ **Document current state** - Already completed in HARDWARE_CONNECTIVITY_REPORT.md
2. ✅ **Identify all devices** - Hardware inventory complete
3. **Create IP address allocation plan**:
   ```
   192.168.5.100 - Wolf Pack Matrix (already configured)
   192.168.5.101 - AtlasIED AZMP8 Audio (already configured)
   192.168.5.110 - Global Cache iTach 1 (MOVE from .1.110)
   192.168.5.111 - Global Cache iTach 2 (MOVE from .1.111)
   192.168.5.121 - DirecTV 1 (already configured, verify online)
   192.168.5.122 - DirecTV 2 (MOVE from .1.122)
   192.168.5.123 - DirecTV 3 (MOVE from .1.123)
   192.168.5.124 - DirecTV 4 (MOVE from .1.124)
   192.168.5.125 - DirecTV 5 (MOVE from .1.125)
   192.168.5.126 - DirecTV 6 (MOVE from .1.126)
   192.168.5.127 - DirecTV 7 (MOVE from .1.127)
   192.168.5.128 - DirecTV 8 (MOVE from .1.128)
   192.168.5.131 - Fire TV Cube Amazon 1 (already configured)
   192.168.5.132 - Fire TV Cube Amazon 2 (MOVE when legacy system retired)
   ```

### Phase 2: Pre-Migration Preparation (1 hour)

1. **Backup current configurations**:
   ```bash
   # Backup database
   cp data/tv-controller.db data/tv-controller.db.backup-$(date +%Y%m%d)

   # Backup configuration files
   tar -czf config-backup-$(date +%Y%m%d).tar.gz \
     src/data/ data/*.json
   ```

2. **Update configuration files** with new IP addresses:
   - `/data/directv-devices.json` - Update DirecTV 2-8 IPs
   - `/data/globalcache-devices.json` - Update iTach IPs
   - Database `GlobalCacheDevice` table - Update IP addresses
   - Database `DirecTVDevice` table - Update IP addresses

3. **Create rollback plan** in case of issues

### Phase 3: Device Migration (2-4 hours, during low-traffic period)

**For DirecTV Receivers** (7 devices):
1. Navigate to receiver network settings menu
2. Change from DHCP to Static IP (or update DHCP reservation)
3. Set new IP: 192.168.5.122-128
4. Set subnet mask: 255.255.255.0
5. Set gateway: 192.168.5.1 (router IP)
6. Set DNS: 8.8.8.8, 8.8.4.4
7. Save and restart receiver
8. Verify connectivity: `ping 192.168.5.12x`

**For Global Cache iTach Devices** (2 devices):
1. Access web interface at current IP (192.168.1.110, .1.111)
2. Navigate to Network Settings
3. Change Static IP to 192.168.5.110, 192.168.5.111
4. Subnet mask: 255.255.255.0
5. Gateway: 192.168.5.1
6. Save and reboot device
7. Verify connectivity: `nc -zv 192.168.5.110 4998`

**For Fire TV Cube Amazon 2** (when legacy system retired):
1. Settings → Network → Configure Network
2. Change to Static IP: 192.168.5.132
3. Update ADB connection string in system
4. Test streaming apps

### Phase 4: System Configuration Update (30 minutes)

1. **Update database**:
   ```sql
   -- Update DirecTV devices
   UPDATE DirecTVDevice SET ipAddress = '192.168.5.122' WHERE name = 'DirecTV 2';
   UPDATE DirecTVDevice SET ipAddress = '192.168.5.123' WHERE name = 'DirecTV 3';
   -- ... (continue for all devices)

   -- Update Global Cache devices
   UPDATE GlobalCacheDevice SET ipAddress = '192.168.5.110' WHERE name = 'iTach 1';
   UPDATE GlobalCacheDevice SET ipAddress = '192.168.5.111' WHERE name = 'iTach 2';
   ```

2. **Update JSON config files** (if any references exist)

3. **Restart PM2 services**:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

### Phase 5: Verification & Testing (1 hour)

1. **Connectivity Tests**:
   ```bash
   # Test all devices
   for ip in {100,101,110,111,121..128,131,132}; do
     echo "Testing 192.168.5.$ip"
     ping -c 2 192.168.5.$ip
   done
   ```

2. **Functional Tests**:
   - DirecTV channel changing via IR
   - Matrix video routing
   - Audio zone control
   - Fire TV ADB commands
   - CEC power control

3. **Health Monitoring**:
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Update documentation** with final IP addresses

### Phase 6: Legacy System Decommission (Future)

Once the new system is proven stable:

1. **Verify no dependencies** on 192.168.1.x network
2. **Power down old matrix system**
3. **Migrate Amazon 2 Fire TV** to 192.168.5.132
4. **Reclaim old equipment** for spare parts or disposal
5. **Update firewall rules** to remove 192.168.1.x exceptions
6. **Document final architecture** for future reference

---

## Alternative Options Considered

### Option A: Inter-VLAN Routing (REJECTED)

**Description**: Configure router to route traffic between 192.168.1.x and 192.168.5.x

**Pros**:
- No device reconfiguration needed
- Can be done immediately
- No service interruption

**Cons**:
- Adds network complexity
- Requires router configuration access
- Additional latency for routed traffic
- Still maintains two subnets to manage
- Doesn't solve long-term architecture issue

**Why Rejected**: Adds complexity without addressing root cause. This is a band-aid solution.

### Option B: Move Control Server to 192.168.1.x (REJECTED)

**Description**: Reconfigure control server and new devices to 192.168.1.x subnet

**Pros**:
- Most devices already on this subnet
- Less device reconfiguration

**Cons**:
- **Wrong direction** - Moving away from new architecture
- Wolf Pack Matrix already on 192.168.5.x (would need to move)
- AtlasIED Audio already on 192.168.5.x (would need to move)
- Fire TV already on 192.168.5.x (would need to move)
- Preserves legacy network as primary

**Why Rejected**: This moves backwards, not forwards. New infrastructure should define the network.

### Option C: Dual-Subnet with Discovery Service (REJECTED)

**Description**: Implement mDNS/Bonjour for device discovery across subnets

**Pros**:
- Devices don't need IP updates
- Automatic discovery

**Cons**:
- Complex to implement
- Multicast routing between VLANs required
- Not all devices support mDNS
- Still maintains fragmented network

**Why Rejected**: Over-engineered solution for a simple problem.

---

## Implementation Timeline

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|-------------|------------|
| Phase 1: Documentation | 30 min | None | Low |
| Phase 2: Preparation | 1 hour | Phase 1 complete | Low |
| Phase 3: Migration | 2-4 hours | Low-traffic period | Medium |
| Phase 4: Config Update | 30 min | Phase 3 complete | Low |
| Phase 5: Verification | 1 hour | Phase 4 complete | Low |
| **TOTAL** | **5-7 hours** | Scheduled maintenance window | **Medium** |

**Recommended Schedule**:
- Start: 2 AM (after bar closing)
- Expected completion: 7-9 AM
- Buffer for issues: Until noon
- Rollback deadline: Before 11 AM (lunch service)

---

## Success Criteria

✅ All devices reachable on 192.168.5.x subnet
✅ No packet loss to any production device
✅ Health endpoint reports all systems healthy
✅ Matrix routing functional across all zones
✅ Audio zones operational
✅ DirecTV channel changing works
✅ Fire TV streaming operational
✅ CEC power control functional
✅ No service interruption during operating hours

---

## Rollback Plan

If critical issues occur during migration:

1. **Immediate**: Power cycle affected devices to restore original IPs (if DHCP)
2. **5 minutes**: Restore database from backup
3. **10 minutes**: Restore configuration files from backup
4. **15 minutes**: Restart PM2 services
5. **20 minutes**: Verify all services operational on old architecture
6. **Document lessons learned** for next attempt

---

## Long-Term Network Architecture

### Future-Proof Design (After Migration Complete)

```
┌─────────────────────────────────────────────────────────────┐
│  Sports Bar TV Controller - Network Architecture            │
│  Subnet: 192.168.5.0/24                                     │
└─────────────────────────────────────────────────────────────┘

Control Layer (192.168.5.10-50)
├─ 192.168.5.10  - Control Server (Intel NUC)
├─ 192.168.5.11  - Backup/Monitoring Server (future)
└─ 192.168.5.12  - Network Management (future)

Video Infrastructure (192.168.5.100-119)
├─ 192.168.5.100 - Wolf Pack Matrix (4x4 HDMI)
├─ 192.168.5.101 - (Reserved for future matrix expansion)
└─ 192.168.5.110-111 - Global Cache iTach IR Blasters

Satellite Receivers (192.168.5.120-129)
├─ 192.168.5.121-128 - DirecTV Receivers 1-8
└─ 192.168.5.129 - (Reserved for future receiver)

Streaming Devices (192.168.5.130-139)
├─ 192.168.5.131 - Fire TV Cube Amazon 1
├─ 192.168.5.132 - Fire TV Cube Amazon 2
└─ 192.168.5.133-139 - (Reserved for expansion)

Audio Infrastructure (192.168.5.150-159)
├─ 192.168.5.150 - AtlasIED AZMP8 Audio Processor (MOVE from .101)
└─ 192.168.5.151-159 - (Reserved for future audio)

CEC Control (192.168.5.160-169)
├─ 192.168.5.160 - Pulse-Eight CEC Adapter (USB, no IP)
└─ 192.168.5.161-169 - (Reserved for future CEC devices)

Displays (192.168.5.200-250)
├─ 192.168.5.200-225 - Smart TVs 1-26 (if networked)
└─ 192.168.5.226-250 - (Reserved for expansion)
```

### Network Best Practices

1. **Static IPs for all production devices** (no DHCP)
2. **Document all IP assignments** in hardware inventory
3. **Reserve IP ranges** for each device category
4. **Use consistent numbering** (sequential within category)
5. **Leave expansion room** in each range
6. **Backup configs** before any network changes
7. **Test in maintenance windows** only
8. **Monitor health endpoint** after changes

---

## References

- [HARDWARE_CONNECTIVITY_REPORT.md](./HARDWARE_CONNECTIVITY_REPORT.md) - Detailed connectivity verification
- [HARDWARE_CONFIGURATION.md](./HARDWARE_CONFIGURATION.md) - Complete hardware specifications
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints for monitoring

---

## Status: READY TO IMPLEMENT

**Action Required**: Schedule maintenance window and execute Phase 1-6 migration plan.

**Questions? Contact**: Sports Bar TV Controller System Team
