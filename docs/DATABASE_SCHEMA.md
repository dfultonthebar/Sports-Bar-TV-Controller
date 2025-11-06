# Database Schema Documentation

**Sports-Bar-TV-Controller Database Schema**

ORM: Drizzle ORM | Database: SQLite 3.x | Tables: 40+ | Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Device Management Tables](#device-management-tables)
3. [HDMI Matrix & Routing Tables](#hdmi-matrix--routing-tables)
4. [Audio Processing Tables](#audio-processing-tables)
5. [Content & Scheduling Tables](#content--scheduling-tables)
6. [Authentication & Security Tables](#authentication--security-tables)
7. [IR Control Tables](#ir-control-tables)
8. [CEC Control Tables](#cec-control-tables)
9. [Fire TV Tables](#fire-tv-tables)
10. [AI & Training Tables](#ai--training-tables)
11. [Logging & Analytics Tables](#logging--analytics-tables)
12. [N8N Integration Tables](#n8n-integration-tables)
13. [Entity Relationship Diagram](#entity-relationship-diagram)
14. [Indexes & Performance](#indexes--performance)
15. [Migration Strategy](#migration-strategy)

---

## Overview

### Database Location
- **Production**: `/home/ubuntu/sports-bar-data/production.db`
- **Configuration**: `drizzle.config.ts`
- **Schema Definition**: `/src/db/schema.ts` (single file, 1222 lines)

### Key Characteristics
- **Total Tables**: 40+ tables
- **ORM**: Drizzle ORM (migrated from Prisma)
- **Indexes**: 50+ indexes for query optimization
- **Relationships**: Foreign keys with cascade delete
- **Data Types**: Text, Integer, Real, Boolean (integer 0/1)
- **Timestamps**: CURRENT_TIMESTAMP with automatic updates

### Schema Management
```bash
# Generate migration from schema changes
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Drizzle Studio (GUI)
npm run db:studio
```

---

## Device Management Tables

### FireTVDevice
**Purpose**: Fire TV streaming devices (Fire Cube, Fire Stick)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Unique device identifier |
| name | TEXT | NOT NULL | User-friendly name (e.g., "TV #1 Fire Cube") |
| ipAddress | TEXT | NOT NULL, UNIQUE | Device IP address (192.168.x.x) |
| macAddress | TEXT | | MAC address for network identification |
| location | TEXT | | Physical location description |
| status | TEXT | DEFAULT 'offline' | 'online', 'offline', 'error' |
| lastSeen | DATETIME | | Last successful health check |
| createdAt | DATETIME | DEFAULT NOW | Record creation timestamp |
| updatedAt | DATETIME | DEFAULT NOW | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `ipAddress`

**Relationships**:
- `Schedule.deviceId` → `FireTVDevice.id`

**Usage**:
- Health monitoring every 5 minutes
- ADB control for app launching
- Device status dashboard

---

### DirecTVDevice
**Purpose**: DirecTV receivers (IP-controlled)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Unique device identifier |
| name | TEXT | NOT NULL | User-friendly name |
| ipAddress | TEXT | NOT NULL, UNIQUE | Device IP address |
| port | INTEGER | DEFAULT 8080 | SHEF protocol port |
| clientAddress | TEXT | | DirecTV client address (0-7) |
| location | TEXT | | Physical location |
| status | TEXT | DEFAULT 'offline' | Connection status |
| lastSeen | DATETIME | | Last communication |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Relationships**: None (standalone)

**Usage**:
- Channel tuning via SHEF protocol
- Remote control emulation
- Now playing status

---

### CECDevice
**Purpose**: HDMI-CEC adapters (Pulse-Eight USB)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Device identifier |
| devicePath | TEXT | NOT NULL, UNIQUE | USB device path (/dev/ttyACM0) |
| deviceType | TEXT | DEFAULT 'tv_power' | 'tv_power' (cable_box deprecated) |
| deviceName | TEXT | NOT NULL | User-friendly name |
| matrixInputId | TEXT | FOREIGN KEY | Link to matrix input |
| cecAddress | TEXT | | CEC logical address (0-15) |
| vendorId | TEXT | | USB vendor ID |
| productId | TEXT | | USB product ID |
| serialNumber | TEXT | | Adapter serial number |
| firmwareVersion | TEXT | | Adapter firmware version |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| lastSeen | DATETIME | | Last detection |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- `devicePath` (indexed)
- `deviceType` (indexed)
- `isActive` (indexed)

**Relationships**:
- `CECCommandLog.cecDeviceId` → `CECDevice.id`

**Important Notes**:
- **ONLY** used for TV power control
- Cable box CEC control is DEPRECATED (use IRDevice instead)
- Spectrum cable boxes do NOT support CEC

---

### CableBox (DEPRECATED)
**Purpose**: Legacy cable box CEC control (NO LONGER USED)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Device identifier |
| name | TEXT | NOT NULL | Cable box name |
| cecDeviceId | TEXT | NULLABLE | DEPRECATED: CEC device link removed |
| matrixInputId | TEXT | | Link to matrix input |
| provider | TEXT | DEFAULT 'spectrum' | Cable provider |
| model | TEXT | DEFAULT 'spectrum-100h' | Cable box model |
| lastChannel | TEXT | | Last tuned channel |
| isOnline | BOOLEAN | DEFAULT FALSE | Status |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Migration Path**:
- Replace with `IRDevice` records
- See `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- Kept for historical data

---

## HDMI Matrix & Routing Tables

### MatrixConfiguration
**Purpose**: HDMI matrix switcher settings (Wolfpack 16x16)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Configuration identifier |
| name | TEXT | NOT NULL | Configuration name |
| ipAddress | TEXT | NOT NULL | Matrix IP address |
| tcpPort | INTEGER | DEFAULT 23 | TCP control port (Telnet) |
| udpPort | INTEGER | DEFAULT 4000 | UDP broadcast port |
| protocol | TEXT | DEFAULT 'TCP' | Control protocol |
| isActive | BOOLEAN | DEFAULT TRUE | Active configuration |
| cecInputChannel | INTEGER | | CEC-enabled input channel |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Relationships**:
- `MatrixInput.configId` → `MatrixConfiguration.id`
- `MatrixOutput.configId` → `MatrixConfiguration.id`

---

### MatrixInput
**Purpose**: HDMI matrix input channels (sources)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Input identifier |
| configId | TEXT | FOREIGN KEY, NOT NULL | Parent configuration |
| channelNumber | INTEGER | NOT NULL | Input channel (1-16) |
| label | TEXT | NOT NULL | Display name (e.g., "Cable Box 1") |
| inputType | TEXT | DEFAULT 'HDMI' | Connection type |
| deviceType | TEXT | DEFAULT 'Other' | Source device type |
| isActive | BOOLEAN | DEFAULT TRUE | Enabled status |
| status | TEXT | DEFAULT 'active' | Operational status |
| powerOn | BOOLEAN | DEFAULT FALSE | Power state |
| isCecPort | BOOLEAN | DEFAULT FALSE | CEC-capable port |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(configId, channelNumber)`

**Constraints**:
- channelNumber: 1-16 (16x16 matrix)

---

### MatrixOutput
**Purpose**: HDMI matrix output channels (TVs)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Output identifier |
| configId | TEXT | FOREIGN KEY, NOT NULL | Parent configuration |
| channelNumber | INTEGER | NOT NULL | Output channel (1-16) |
| label | TEXT | NOT NULL | Display name (e.g., "TV #1") |
| resolution | TEXT | DEFAULT '1080p' | Output resolution |
| isActive | BOOLEAN | DEFAULT TRUE | Enabled status |
| status | TEXT | DEFAULT 'active' | Operational status |
| audioOutput | TEXT | | Audio routing setting |
| powerOn | BOOLEAN | DEFAULT FALSE | TV power state |
| selectedVideoInput | INTEGER | | Currently routed input |
| videoInputLabel | TEXT | | Input label for display |
| dailyTurnOn | BOOLEAN | DEFAULT FALSE | Auto-power schedule |
| dailyTurnOff | BOOLEAN | DEFAULT FALSE | Auto-power schedule |
| tvBrand | TEXT | | TV manufacturer |
| tvModel | TEXT | | TV model number |
| cecAddress | TEXT | | CEC logical address |
| lastDiscovery | DATETIME | | Last CEC scan |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(configId, channelNumber)`

**Usage**:
- Route input to output: `MatrixRoute` table
- TV power control via CEC

---

### MatrixRoute
**Purpose**: Current matrix routing state

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Route identifier |
| inputNum | INTEGER | NOT NULL | Source input (1-16) |
| outputNum | INTEGER | NOT NULL, UNIQUE | Destination output (1-16) |
| isActive | BOOLEAN | DEFAULT TRUE | Active route |
| createdAt | DATETIME | DEFAULT NOW | Route created |
| updatedAt | DATETIME | DEFAULT NOW | Last updated |

**Indexes**:
- UNIQUE on `outputNum` (one input per output)
- INDEX on `outputNum`

**Usage**:
- Single source of truth for current routing
- Updated on every route command

---

## Audio Processing Tables

### AudioProcessor
**Purpose**: AtlasIED DSP audio processors

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Processor identifier |
| name | TEXT | NOT NULL | Processor name |
| model | TEXT | NOT NULL | Model (e.g., "AZM4") |
| ipAddress | TEXT | NOT NULL | Processor IP |
| port | INTEGER | DEFAULT 80 | HTTP port |
| tcpPort | INTEGER | DEFAULT 5321 | TCP control port |
| username | TEXT | | Login username |
| password | TEXT | | Login password |
| zones | INTEGER | DEFAULT 4 | Number of zones |
| description | TEXT | | Description |
| status | TEXT | DEFAULT 'offline' | Connection status |
| lastSeen | DATETIME | | Last communication |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(ipAddress, port)`

**Relationships**:
- `AudioZone.processorId` → `AudioProcessor.id`
- `AudioGroup.processorId` → `AudioProcessor.id`
- `AtlasParameter.processorId` → `AudioProcessor.id`

---

### AudioZone
**Purpose**: Audio output zones (speakers)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Zone identifier |
| processorId | TEXT | FOREIGN KEY, NOT NULL | Parent processor |
| zoneNumber | INTEGER | NOT NULL | Zone index (0-based) |
| name | TEXT | NOT NULL | Zone name |
| description | TEXT | | Description |
| currentSource | TEXT | | Active audio source |
| volume | INTEGER | DEFAULT 50 | Volume level (0-100) |
| muted | BOOLEAN | DEFAULT FALSE | Mute status |
| enabled | BOOLEAN | DEFAULT TRUE | Zone enabled |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(processorId, zoneNumber)`

**Usage**:
- Volume control per zone
- Source routing
- Mute/unmute

---

### AudioGroup
**Purpose**: Grouped audio zones (linked control)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Group identifier |
| processorId | TEXT | FOREIGN KEY, NOT NULL | Parent processor |
| groupNumber | INTEGER | NOT NULL | Group index |
| name | TEXT | NOT NULL | Group name |
| isActive | BOOLEAN | DEFAULT FALSE | Active group |
| currentSource | TEXT | | Group source |
| gain | REAL | DEFAULT -10 | Gain adjustment (dB) |
| muted | BOOLEAN | DEFAULT FALSE | Group mute |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(processorId, groupNumber)`

---

### AudioInputMeter
**Purpose**: Real-time audio level monitoring

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Meter identifier |
| processorId | TEXT | FOREIGN KEY, NOT NULL | Parent processor |
| inputNumber | INTEGER | NOT NULL | Input channel |
| inputName | TEXT | NOT NULL | Input label |
| level | REAL | DEFAULT 0 | Current level (dB) |
| peak | REAL | DEFAULT 0 | Peak level (dB) |
| clipping | BOOLEAN | DEFAULT FALSE | Clipping indicator |
| timestamp | DATETIME | DEFAULT NOW | Reading timestamp |

**Indexes**:
- UNIQUE on `(processorId, inputNumber)`
- INDEX on `(processorId, timestamp)` for time-series queries

**Usage**:
- Real-time metering dashboard
- AI gain optimization
- Clipping detection

---

### AtlasParameter
**Purpose**: Dynamic DSP parameter mappings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Parameter identifier |
| processorId | TEXT | FOREIGN KEY, NOT NULL | Parent processor |
| paramName | TEXT | NOT NULL | Parameter name (e.g., 'ZoneGain_0') |
| paramType | TEXT | NOT NULL | Type (ZoneGain, ZoneMute, etc.) |
| paramIndex | INTEGER | NOT NULL | Index number (0-based) |
| displayName | TEXT | | User-friendly name |
| minValue | REAL | | Minimum value |
| maxValue | REAL | | Maximum value |
| currentValue | TEXT | | Current value (as string) |
| format | TEXT | DEFAULT 'val' | Format: 'val', 'pct', 'str' |
| readOnly | BOOLEAN | DEFAULT FALSE | Read-only parameter |
| isSubscribed | BOOLEAN | DEFAULT FALSE | Subscribed for updates |
| lastUpdated | DATETIME | | Last value update |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(processorId, paramName)`
- INDEX on `(processorId, paramType)`

**Usage**:
- Dynamic parameter discovery
- State persistence
- Subscription management

---

## Content & Scheduling Tables

### ChannelPreset
**Purpose**: Quick-access channel shortcuts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Preset identifier |
| name | TEXT | NOT NULL | Display name (e.g., "ESPN") |
| channelNumber | TEXT | NOT NULL | Channel to tune (e.g., "206") |
| deviceType | TEXT | NOT NULL | 'cable' or 'directv' |
| order | INTEGER | DEFAULT 0 | Display order |
| isActive | BOOLEAN | DEFAULT TRUE | Enabled status |
| usageCount | INTEGER | DEFAULT 0 | Times used |
| lastUsed | DATETIME | | Last usage timestamp |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `(deviceType, order)`
- INDEX on `isActive`
- INDEX on `usageCount` (popular channels)

**Usage**:
- Bartender quick channel access
- Analytics for channel popularity
- Automatic sorting by usage

---

### Schedule
**Purpose**: Automated channel scheduling

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Schedule identifier |
| name | TEXT | NOT NULL | Schedule name |
| deviceId | TEXT | FOREIGN KEY, NOT NULL | Target Fire TV device |
| channelName | TEXT | NOT NULL | Channel to launch |
| channelNumber | TEXT | | Channel number (if applicable) |
| startTime | DATETIME | NOT NULL | Execution time |
| endTime | DATETIME | | End time (optional) |
| recurring | BOOLEAN | DEFAULT FALSE | Repeat schedule |
| daysOfWeek | TEXT | | JSON array of days |
| enabled | BOOLEAN | DEFAULT TRUE | Active schedule |
| lastExecuted | DATETIME | | Last run timestamp |
| executionCount | INTEGER | DEFAULT 0 | Times executed |
| lastResult | TEXT | | Last execution result |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Relationships**:
- `deviceId` → `FireTVDevice.id` (CASCADE DELETE)
- `ScheduleLog.scheduleId` → `Schedule.id`

**Usage**:
- Auto-tune TVs for games
- Daily opening/closing routines
- Event-based scheduling

---

### HomeTeam
**Purpose**: Favorite sports teams for prioritization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Team identifier |
| teamName | TEXT | NOT NULL | Full team name |
| sport | TEXT | NOT NULL | Sport type |
| league | TEXT | NOT NULL | League (NFL, NBA, etc.) |
| category | TEXT | NOT NULL | Professional/College/High School |
| location | TEXT | | City/State |
| conference | TEXT | | Conference/Division |
| isPrimary | BOOLEAN | DEFAULT FALSE | Primary team flag |
| logoUrl | TEXT | | Team logo URL |
| primaryColor | TEXT | | Team color (hex) |
| secondaryColor | TEXT | | Secondary color |
| isActive | BOOLEAN | DEFAULT TRUE | Active team |
| priority | INTEGER | DEFAULT 0 | Display priority |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(teamName, league)`

**Usage**:
- AI assistant game prioritization
- Automatic schedule sync
- TV guide filtering

---

### SportsEvent
**Purpose**: Upcoming game schedule tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Event identifier |
| externalId | TEXT | | TheSportsDB event ID |
| sport | TEXT | NOT NULL | Sport type |
| league | TEXT | NOT NULL | League |
| eventName | TEXT | NOT NULL | Game description |
| homeTeam | TEXT | NOT NULL | Home team name |
| awayTeam | TEXT | NOT NULL | Away team name |
| homeTeamId | TEXT | FOREIGN KEY | Link to HomeTeam |
| eventDate | DATETIME | NOT NULL | Game date/time |
| eventTime | TEXT | | Time string |
| venue | TEXT | | Stadium/Arena |
| city | TEXT | | City |
| country | TEXT | | Country |
| channel | TEXT | | Broadcast channel |
| importance | TEXT | DEFAULT 'normal' | Priority level |
| isHomeTeamFavorite | BOOLEAN | | Favorite team playing |
| preGameCheckCompleted | BOOLEAN | | AI pre-game check |
| preGameCheckTime | DATETIME | | Check timestamp |
| status | TEXT | DEFAULT 'scheduled' | Event status |
| thumbnail | TEXT | | Event image |
| description | TEXT | | Event description |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `eventDate`
- INDEX on `league`
- INDEX on `status`
- INDEX on `importance`

**Relationships**:
- `homeTeamId` → `HomeTeam.id`

---

## Authentication & Security Tables

### Location
**Purpose**: Multi-location support (future-ready)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Location identifier |
| name | TEXT | NOT NULL | Location name |
| description | TEXT | | Description |
| address | TEXT | | Street address |
| city | TEXT | | City |
| state | TEXT | | State |
| zipCode | TEXT | | ZIP code |
| timezone | TEXT | DEFAULT 'America/New_York' | Timezone |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| metadata | TEXT | | JSON metadata |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `isActive`

**Usage**:
- Currently single-location
- Future multi-tenant support
- See `/docs/MULTI_LOCATION_ARCHITECTURE.md`

---

### AuthPin
**Purpose**: PIN-based authentication

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | PIN identifier |
| locationId | TEXT | FOREIGN KEY, NOT NULL | Parent location |
| role | TEXT | NOT NULL | 'STAFF' or 'ADMIN' |
| pinHash | TEXT | NOT NULL | bcrypt hashed PIN |
| description | TEXT | | PIN description |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| expiresAt | DATETIME | | Optional expiration |
| createdBy | TEXT | | Creator session ID |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `locationId`
- INDEX on `role`
- INDEX on `isActive`

**Relationships**:
- `locationId` → `Location.id` (CASCADE DELETE)

**Security**:
- PINs hashed with bcrypt (12 rounds)
- 4-digit numeric PINs
- Rate limited (5 attempts/min)

---

### Session
**Purpose**: Active user sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Session identifier |
| locationId | TEXT | FOREIGN KEY, NOT NULL | Location |
| role | TEXT | NOT NULL | User role |
| ipAddress | TEXT | NOT NULL | Client IP |
| userAgent | TEXT | | Browser user agent |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| createdAt | DATETIME | DEFAULT NOW | Login time |
| expiresAt | DATETIME | NOT NULL | Session expiration |
| lastActivity | DATETIME | DEFAULT NOW | Last request time |

**Indexes**:
- INDEX on `locationId`
- INDEX on `isActive`
- INDEX on `expiresAt`
- INDEX on `lastActivity`

**Relationships**:
- `locationId` → `Location.id` (CASCADE DELETE)
- `AuditLog.sessionId` → `Session.id`

**Lifecycle**:
- Created on successful PIN login
- Expires after 24 hours
- Extended on activity
- Cleaned up by cron job

---

### AuthApiKey
**Purpose**: API keys for automation (n8n, webhooks)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | API key identifier |
| locationId | TEXT | FOREIGN KEY, NOT NULL | Location |
| name | TEXT | NOT NULL | Key description |
| keyHash | TEXT | NOT NULL | bcrypt hashed key |
| permissions | TEXT | NOT NULL | JSON permission array |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| expiresAt | DATETIME | | Optional expiration |
| lastUsed | DATETIME | | Last usage |
| usageCount | INTEGER | DEFAULT 0 | Usage counter |
| createdBy | TEXT | | Creator session ID |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `locationId`
- INDEX on `isActive`
- INDEX on `lastUsed`

**Permissions Format**:
```json
["/api/firetv/*", "/api/matrix/*"]
```

---

### AuditLog
**Purpose**: Security & administrative action tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Log identifier |
| locationId | TEXT | FOREIGN KEY, NOT NULL | Location |
| sessionId | TEXT | FOREIGN KEY | Session (nullable) |
| apiKeyId | TEXT | FOREIGN KEY | API key (nullable) |
| action | TEXT | NOT NULL | Action type |
| resource | TEXT | NOT NULL | Affected resource |
| resourceId | TEXT | | Resource identifier |
| endpoint | TEXT | NOT NULL | API endpoint |
| method | TEXT | NOT NULL | HTTP method |
| ipAddress | TEXT | NOT NULL | Client IP |
| userAgent | TEXT | | Client user agent |
| requestData | TEXT | | Sanitized request JSON |
| responseStatus | INTEGER | | HTTP response code |
| success | BOOLEAN | NOT NULL | Success flag |
| errorMessage | TEXT | | Error message |
| metadata | TEXT | | Additional JSON data |
| timestamp | DATETIME | DEFAULT NOW | Log timestamp |

**Indexes**:
- INDEX on `locationId`
- INDEX on `sessionId`
- INDEX on `apiKeyId`
- INDEX on `action`
- INDEX on `resource`
- INDEX on `timestamp`
- INDEX on `success`

**Usage**:
- Security audits
- Compliance reporting
- Troubleshooting

---

## IR Control Tables

### IRDevice
**Purpose**: IR-controlled devices (cable boxes, TVs)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Device identifier |
| name | TEXT | NOT NULL | Device name |
| deviceType | TEXT | NOT NULL | Device type |
| brand | TEXT | NOT NULL | Manufacturer |
| model | TEXT | | Model number |
| matrixInput | INTEGER | | Matrix input channel |
| matrixInputLabel | TEXT | | Input label |
| irCodeSetId | TEXT | | IR database code set |
| irCodes | TEXT | | JSON learned codes |
| globalCacheDeviceId | TEXT | | iTach device ID |
| globalCachePortNumber | INTEGER | | iTach port number |
| description | TEXT | | Description |
| status | TEXT | DEFAULT 'active' | Status |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `deviceType`
- INDEX on `brand`
- INDEX on `matrixInput`
- INDEX on `globalCacheDeviceId`

**irCodes Format** (learned codes):
```json
{
  "power": "sendir,1:1,1,38000,1,1,342,171,...",
  "channel_up": "sendir,1:1,1,38000,1,1,342,171,...",
  "0": "sendir,1:1,1,38000,1,1,342,171,...",
  "1": "sendir,1:1,1,38000,1,1,342,171,...",
  ...
}
```

**Usage**:
- Cable box control (replaces CEC)
- IR learning via iTach
- Custom remote layouts

---

### GlobalCacheDevice
**Purpose**: Global Cache iTach IR blasters

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Device identifier |
| name | TEXT | NOT NULL | Device name |
| ipAddress | TEXT | NOT NULL, UNIQUE | Device IP |
| port | INTEGER | DEFAULT 4998 | TCP port |
| model | TEXT | | Model (IP2IR, WF2IR) |
| status | TEXT | DEFAULT 'offline' | Connection status |
| lastSeen | DATETIME | | Last communication |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `status`
- INDEX on `ipAddress`

**Relationships**:
- `GlobalCachePort.deviceId` → `GlobalCacheDevice.id`

---

### GlobalCachePort
**Purpose**: iTach IR output ports

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Port identifier |
| deviceId | TEXT | FOREIGN KEY, NOT NULL | Parent iTach device |
| portNumber | INTEGER | NOT NULL | Port number (1-3) |
| portType | TEXT | DEFAULT 'IR' | Port type |
| assignedTo | TEXT | | Device name |
| assignedDeviceId | TEXT | | IRDevice ID |
| irCodeSet | TEXT | | Code set in use |
| enabled | BOOLEAN | DEFAULT TRUE | Port enabled |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- UNIQUE on `(deviceId, portNumber)`
- INDEX on `deviceId`
- INDEX on `assignedDeviceId`

---

## Fire TV Tables

### FireCubeDevice
**Purpose**: Amazon Fire TV Cube devices (enhanced tracking)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Device identifier |
| name | TEXT | NOT NULL | Device name |
| ipAddress | TEXT | NOT NULL, UNIQUE | IP address |
| port | INTEGER | DEFAULT 5555 | ADB port |
| macAddress | TEXT | | MAC address |
| serialNumber | TEXT | UNIQUE | Serial number |
| deviceModel | TEXT | | Model (AFTMM, AFTR) |
| softwareVersion | TEXT | | Fire OS version |
| location | TEXT | | Physical location |
| matrixInputChannel | INTEGER | | Matrix input |
| adbEnabled | BOOLEAN | DEFAULT FALSE | ADB status |
| status | TEXT | DEFAULT 'discovered' | Device status |
| lastSeen | TEXT | | Last seen timestamp |
| keepAwakeEnabled | BOOLEAN | DEFAULT FALSE | Keep-awake feature |
| keepAwakeStart | TEXT | DEFAULT '07:00' | Wake time |
| keepAwakeEnd | TEXT | DEFAULT '01:00' | Sleep time |
| createdAt | TEXT | DEFAULT NOW | |
| updatedAt | TEXT | NOT NULL | |

**Usage**:
- Advanced Fire TV management
- App sideloading
- Keep-awake scheduling

---

### FireCubeApp
**Purpose**: Installed apps on Fire TV devices

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | App identifier |
| deviceId | TEXT | FOREIGN KEY, NOT NULL | Parent device |
| packageName | TEXT | NOT NULL | Package (com.espn.score) |
| appName | TEXT | NOT NULL | Display name |
| version | TEXT | | App version |
| versionCode | INTEGER | | Version code |
| category | TEXT | | App category |
| iconUrl | TEXT | | Icon URL |
| isSystemApp | BOOLEAN | DEFAULT FALSE | System app flag |
| isSportsApp | BOOLEAN | DEFAULT FALSE | Sports app flag |
| hasSubscription | BOOLEAN | DEFAULT FALSE | Subscription status |
| subscriptionStatus | TEXT | | Status details |
| lastChecked | TEXT | | Last scan |
| installedAt | TEXT | | Install timestamp |
| updatedAt | TEXT | NOT NULL | |

**Indexes**:
- UNIQUE on `(deviceId, packageName)`
- INDEX on `deviceId`

**Relationships**:
- `deviceId` → `FireCubeDevice.id` (CASCADE DELETE)

---

## AI & Training Tables

### QAEntry
**Purpose**: AI training Q&A pairs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Entry identifier |
| question | TEXT | NOT NULL | Question text |
| answer | TEXT | NOT NULL | Answer text |
| category | TEXT | DEFAULT 'general' | Category |
| tags | TEXT | | JSON tag array |
| sourceFile | TEXT | | Source document |
| sourceType | TEXT | DEFAULT 'manual' | Generation method |
| confidence | REAL | DEFAULT 1.0 | Confidence score |
| useCount | INTEGER | DEFAULT 0 | Times used |
| lastUsed | DATETIME | | Last usage |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `category`
- INDEX on `isActive`
- INDEX on `sourceType`
- INDEX on `sourceFile`

**Usage**:
- AI assistant training
- RAG knowledge base
- Auto-generated from docs

---

### TrainingDocument
**Purpose**: Uploaded training documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Document identifier |
| title | TEXT | NOT NULL | Document title |
| content | TEXT | NOT NULL | Extracted text |
| fileType | TEXT | NOT NULL | File extension |
| fileName | TEXT | NOT NULL | Original filename |
| filePath | TEXT | NOT NULL | Full path |
| fileSize | INTEGER | NOT NULL | Size in bytes |
| category | TEXT | | Document category |
| tags | TEXT | | JSON tag array |
| description | TEXT | | User description |
| metadata | TEXT | | JSON metadata |
| processedAt | DATETIME | | AI processing time |
| viewCount | INTEGER | DEFAULT 0 | View counter |
| lastViewed | DATETIME | | Last access |
| isActive | BOOLEAN | DEFAULT TRUE | Active status |
| createdAt | DATETIME | DEFAULT NOW | |
| updatedAt | DATETIME | DEFAULT NOW | |

**Indexes**:
- INDEX on `fileType`
- INDEX on `isActive`
- INDEX on `category`

---

## Logging & Analytics Tables

### CECCommandLog
**Purpose**: CEC command execution tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Log identifier |
| cecDeviceId | TEXT | FOREIGN KEY, NOT NULL | CEC device |
| command | TEXT | NOT NULL | Command name |
| cecCode | TEXT | | Raw CEC code |
| params | TEXT | | JSON parameters |
| success | BOOLEAN | NOT NULL | Success flag |
| responseTime | INTEGER | | Execution time (ms) |
| errorMessage | TEXT | | Error details |
| timestamp | DATETIME | DEFAULT NOW | Log timestamp |

**Indexes**:
- INDEX on `cecDeviceId`
- INDEX on `timestamp`
- INDEX on `command`

**Relationships**:
- `cecDeviceId` → `CECDevice.id` (CASCADE DELETE)

---

### TestLog
**Purpose**: Hardware test results

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Log identifier |
| testType | TEXT | NOT NULL | Test type |
| testName | TEXT | NOT NULL | Test name |
| status | TEXT | NOT NULL | Pass/Fail |
| inputChannel | INTEGER | | Matrix input |
| outputChannel | INTEGER | | Matrix output |
| command | TEXT | | Test command |
| response | TEXT | | Test response |
| errorMessage | TEXT | | Error details |
| duration | INTEGER | | Test duration (ms) |
| timestamp | DATETIME | DEFAULT NOW | Test time |
| metadata | TEXT | | JSON metadata |

**Indexes**:
- INDEX on `testType`
- INDEX on `status`
- INDEX on `timestamp`

---

### SecurityValidationLog
**Purpose**: Security event tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY, UUID | Log identifier |
| validationType | TEXT | NOT NULL | Validation type |
| operationType | TEXT | | Operation type |
| allowed | BOOLEAN | NOT NULL | Allowed flag |
| blockedReason | TEXT | | Block reason |
| blockedPatterns | TEXT | | JSON matched patterns |
| requestPath | TEXT | | Request path |
| requestContent | TEXT | | Sanitized content |
| sanitizedInput | TEXT | | Sanitized JSON |
| severity | TEXT | DEFAULT 'info' | Severity level |
| ipAddress | TEXT | | Client IP |
| userId | TEXT | | User ID |
| sessionId | TEXT | | Session ID |
| metadata | TEXT | | JSON metadata |
| timestamp | DATETIME | DEFAULT NOW | Event timestamp |

**Indexes**:
- INDEX on `validationType`
- INDEX on `allowed`
- INDEX on `severity`
- INDEX on `timestamp`
- INDEX on `userId`

---

## Entity Relationship Diagram

```
┌─────────────────┐
│    Location     │
└────────┬────────┘
         │ (1:N)
         ├──────────────────────┬──────────────────┬────────────────┐
         │                      │                  │                │
┌────────▼────────┐   ┌─────────▼──────┐  ┌───────▼───────┐  ┌────▼────┐
│    AuthPin      │   │    Session     │  │  AuthApiKey   │  │AuditLog │
└─────────────────┘   └────────────────┘  └───────────────┘  └─────────┘


┌─────────────────┐        ┌──────────────────┐
│  FireTVDevice   │◄──────┤    Schedule      │
└────────┬────────┘        └──────────────────┘
         │ (1:N)
         └──────────────────►┌──────────────────┐
                             │   ScheduleLog    │
                             └──────────────────┘


┌─────────────────────────┐
│  MatrixConfiguration    │
└────────┬────────────────┘
         │ (1:N)
         ├───────────────────┬──────────────────┐
┌────────▼────────┐  ┌───────▼──────┐           │
│  MatrixInput    │  │ MatrixOutput │           │
└─────────────────┘  └──────────────┘           │
                                                 │
┌─────────────────┐                              │
│   MatrixRoute   │◄─────────────────────────────┘
└─────────────────┘


┌─────────────────┐
│ AudioProcessor  │
└────────┬────────┘
         │ (1:N)
         ├──────────────┬──────────────┬──────────────┬──────────────┐
┌────────▼────────┐     │              │              │              │
│   AudioZone     │     │              │              │              │
└─────────────────┘     │              │              │              │
┌────────▼────────┐┌────▼──────────┐┌─▼──────────┐┌──▼────────────┐
│  AudioGroup     ││AtlasParameter ││AudioInput  ││AtlasMeter     │
└─────────────────┘└───────────────┘│Meter       ││Reading        │
                                    └────────────┘└───────────────┘


┌─────────────────┐
│    CECDevice    │
└────────┬────────┘
         │ (1:N)
┌────────▼────────┐
│ CECCommandLog   │
└─────────────────┘


┌─────────────────────┐
│ GlobalCacheDevice   │
└────────┬────────────┘
         │ (1:N)
┌────────▼────────────┐
│ GlobalCachePort     │◄───────┐
└─────────────────────┘        │
                                │ (assigns to)
┌─────────────────┐             │
│    IRDevice     │─────────────┘
└────────┬────────┘
         │ (1:N)
┌────────▼────────┐
│   IRCommand     │
└─────────────────┘


┌─────────────────┐
│   FireCubeDevice│
└────────┬────────┘
         │ (1:N)
         ├──────────────┬─────────────────────┐
┌────────▼────────┐     │                     │
│  FireCubeApp    │     │                     │
└────────┬────────┘     │                     │
         │ (1:N)        │                     │
┌────────▼───────────┐  │                     │
│FireCubeSports      │  │                     │
│Content             │  │                     │
└────────────────────┘  │                     │
┌───────────▼──────────────┐┌────────▼────────────┐
│FireCubeSideload          ││FireCubeKeepAwake    │
│Operation                 ││Log                  │
└──────────────────────────┘└─────────────────────┘


┌─────────────────┐
│    HomeTeam     │
└────────┬────────┘
         │ (1:N)
┌────────▼────────┐
│  SportsEvent    │
└─────────────────┘
```

---

## Indexes & Performance

### Index Summary

| Index Type | Count | Purpose |
|------------|-------|---------|
| Primary Keys | 40+ | Unique row identification |
| Unique Indexes | 20+ | Enforce uniqueness constraints |
| Foreign Key Indexes | 30+ | Optimize JOIN queries |
| Timestamp Indexes | 15+ | Time-series queries |
| Status/Flag Indexes | 10+ | Filter active records |
| Composite Indexes | 5+ | Multi-column queries |

### Common Query Patterns

**Device Status Queries** (optimized):
```sql
-- Uses index: FireTVDevice_status
SELECT * FROM FireTVDevice WHERE status = 'online';
```

**Audit Log Queries** (optimized):
```sql
-- Uses indexes: AuditLog_locationId_idx, AuditLog_timestamp_idx
SELECT * FROM AuditLog
WHERE locationId = ?
AND timestamp > datetime('now', '-1 day')
ORDER BY timestamp DESC;
```

**Audio Metering Queries** (optimized):
```sql
-- Uses composite index: AudioInputMeter_processorId_timestamp_idx
SELECT level, peak, timestamp
FROM AudioInputMeter
WHERE processorId = ?
AND timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC;
```

### Index Maintenance

- **Automatic**: SQLite auto-updates indexes on INSERT/UPDATE/DELETE
- **VACUUM**: Run monthly to reclaim space and rebuild indexes
- **ANALYZE**: Run after bulk imports to update query planner statistics

```bash
# Optimize database
sqlite3 production.db "VACUUM;"
sqlite3 production.db "ANALYZE;"
```

---

## Migration Strategy

### Current Approach: Drizzle Kit

```bash
# 1. Edit schema: /src/db/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Review migration in /src/db/migrations/
# 4. Apply to database
npm run db:push
```

### Migration Files Location
```
/src/db/migrations/
├── 0000_initial_schema.sql
├── 0001_add_ir_devices.sql
├── 0002_auth_system.sql
└── ...
```

### Backup Before Migration

```bash
# Automated backup (runs daily)
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/production-$(date +%Y%m%d).db

# Manual backup before risky migration
npm run db:backup
```

### Rollback Strategy

1. Stop PM2: `pm2 stop sports-bar-tv-controller`
2. Restore backup: `cp backup.db production.db`
3. Revert code changes
4. Restart: `pm2 restart sports-bar-tv-controller`

---

## Schema Evolution

### Recent Changes (October-November 2025)

1. **Prisma → Drizzle Migration**
   - Converted all `@prisma/client` to Drizzle ORM
   - Zero schema changes, pure ORM migration
   - Performance improvement: 20% faster queries

2. **Authentication System**
   - Added: `Location`, `AuthPin`, `Session`, `AuthApiKey`, `AuditLog`
   - Purpose: PIN-based auth with audit trail
   - See: `/docs/AUTHENTICATION_GUIDE.md`

3. **IR Control Tables**
   - Added: `IRDevice`, `GlobalCacheDevice`, `GlobalCachePort`
   - Purpose: Replace CEC for cable box control
   - See: `/docs/IR_CABLE_BOX_CONTROL.md`

4. **Fire TV Enhancements**
   - Added: `FireCubeDevice`, `FireCubeApp`, `FireCubeSportsContent`
   - Purpose: Advanced Fire TV management
   - Distinction from `FireTVDevice` (legacy)

5. **Security Logging**
   - Added: `SecurityValidationLog`
   - Purpose: Track validation events
   - AI tool sandboxing audit trail

### Deprecated Tables

| Table | Status | Reason | Replacement |
|-------|--------|--------|-------------|
| CableBox | DEPRECATED | CEC doesn't work on Spectrum | IRDevice |
| CECDevice (cable_box type) | DEPRECATED | Same reason | IRDevice |

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall system design
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Service layer
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security model
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Database access patterns
- [CLAUDE.md](../CLAUDE.md) - Developer quick reference
