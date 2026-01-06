# TV Network Control - Implementation Placement Guide

**Date:** 2025-11-21
**Context:** Replacing deprecated CEC discovery with IP-based TV control

## User Requirements

The TV network control feature should:
- **Location:** Device Config page (`/device-config`)
- **Replaces:** CEC Discovery button (now deprecated)
- **Purpose:** Discover and control TVs via network protocols (Samsung, LG, Sony, Vizio, Roku)

## Implementation Location

### Frontend Component
**File:** `/src/components/device-config/TVNetworkDiscovery.tsx` (new)

**Integration Point:**
- Add to `/src/app/device-config/page.tsx`
- Replace or remove the old CEC discovery UI
- Position in the "TV Control" section

### UI Placement

```tsx
// /src/app/device-config/page.tsx
import { TVNetworkDiscovery } from '@/components/device-config/TVNetworkDiscovery'

<Tabs defaultValue="matrix">
  <TabsList>
    <TabsTrigger value="matrix">Matrix</TabsTrigger>
    <TabsTrigger value="tv-network">TV Discovery</TabsTrigger> {/* NEW */}
    <TabsTrigger value="fire-tv">Fire TV</TabsTrigger>
    <TabsTrigger value="directv">DirecTV</TabsTrigger>
    <TabsTrigger value="ir">IR Devices</TabsTrigger>
  </TabsList>

  <TabsContent value="tv-network">
    <TVNetworkDiscovery />
  </TabsContent>
  {/* ... other tabs ... */}
</Tabs>
```

## Feature Requirements

Based on previous planning documents:

1. **IP Range Scanner**
   - Input: Start IP (e.g., 192.168.5.1)
   - Input: End IP (e.g., 192.168.5.24)
   - Button: "Scan for TVs"

2. **Discovery Results**
   - Display found TVs with:
     - IP address
     - Brand (Samsung, LG, Sony, Vizio, Roku)
     - Model (if available)
     - Status (online/offline)
   - Button: "Pair" for each TV

3. **Pairing Flow**
   - Samsung/LG: Show PIN on TV, user enters PIN
   - Sony: Show PSK setup instructions
   - Vizio: Show token pairing flow
   - Roku: Automatic (no auth)

4. **TV Management**
   - List of paired TVs
   - Test connection button
   - Remove TV button
   - Power control buttons (On/Off/Test)

## Database Schema

The planning documents include full schema in `TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md`:

```typescript
// /src/db/schema.ts - Add these tables
export const networkTVDevices = sqliteTable('NetworkTVDevice', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull(),
  brand: text('brand').notNull(), // 'samsung' | 'lg' | 'sony' | 'vizio' | 'roku'
  model: text('model'),
  macAddress: text('macAddress'),
  authToken: text('authToken'), // Encrypted
  authClientKey: text('authClientKey'),
  wsPort: integer('wsPort'),
  isOnline: integer('isOnline', { mode: 'boolean' }).default(false),
  lastSeen: text('lastSeen'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull()
})

export const tvDiscoveryLog = sqliteTable('TVDiscoveryLog', {
  id: text('id').primaryKey(),
  scanRange: text('scanRange').notNull(),
  foundCount: integer('foundCount').notNull(),
  duration: integer('duration').notNull(),
  results: text('results'), // JSON
  createdAt: text('createdAt').notNull()
})
```

## API Endpoints

All endpoints documented in implementation plan:

```
POST   /api/tv-network/discover        - Scan IP range
GET    /api/tv-network/devices         - List paired TVs
POST   /api/tv-network/devices         - Add TV manually
PUT    /api/tv-network/devices/:id     - Update TV
DELETE /api/tv-network/devices/:id     - Remove TV
POST   /api/tv-network/pair            - Pair TV (with PIN/token)
POST   /api/tv-network/command         - Send power/control command
POST   /api/tv-network/test            - Test TV connection
```

## Service Layer

```
/src/lib/tv-network/
├── discovery-service.ts       - IP scanning & SSDP discovery
├── samsung-tv-client.ts       - Samsung WebSocket client
├── lg-tv-client.ts           - LG WebSocket client
├── sony-tv-client.ts         - Sony REST client
├── vizio-tv-client.ts        - Vizio HTTPS client
├── roku-tv-client.ts         - Roku HTTP client
└── tv-network-manager.ts     - Unified interface
```

## Reference Documentation

See comprehensive planning documents created earlier:
- `TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md` - Full technical details
- `TV_DISCOVERY_UX_SPECIFICATION.md` - Complete UX flows
- `TV_DISCOVERY_IMPLEMENTATION_NOTES.md` - Implementation steps
- `TV_NETWORK_CONTROL_COMPARISON_MATRIX.md` - Brand comparison

## Next Steps

1. Create database schema changes
2. Implement discovery service
3. Create brand-specific TV clients
4. Build API endpoints
5. Create frontend component
6. Integrate into device-config page
7. Test with real TVs

## Note on CEC Deprecation

CEC control has been removed from the system because:
- Spectrum/Charter cable boxes have CEC disabled in firmware
- Reliability issues in commercial environments
- Replaced with IR control via Global Cache iTach

The CEC Discovery button is no longer needed and should be replaced with this TV Network Discovery feature.
