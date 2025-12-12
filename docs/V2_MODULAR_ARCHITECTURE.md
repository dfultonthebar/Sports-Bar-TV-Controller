# Sports Bar TV Controller - Version 2 Modular Architecture

**Branch:** `v2-modular-architecture`
**Status:** Planning & Development
**Last Updated:** December 12, 2025
**Production Branch:** `main` (v1.x - continues running)

---

## Executive Summary

Version 2 transforms the Sports Bar TV Controller from a monolithic application into a modular, package-based architecture. This enables:

1. **Better Maintainability** - Clear module boundaries and ownership
2. **Hardware Flexibility** - Plugin-based hardware support
3. **Faster Development** - Independent package development and testing
4. **Zero Downtime Migration** - Production continues on `main` while v2 develops

---

## Current State Analysis (v1.x)

### Problems Identified

| Issue | Impact | Files Affected |
|-------|--------|----------------|
| Flat file structure | Hard to navigate | 100+ files in `/src/lib` |
| No module boundaries | Unclear ownership | All service files |
| Tightly coupled hardware | Can't add new vendors | CEC, IR, ADB, Matrix |
| Large schema file | Hard to maintain | 1778 lines, 40+ tables |
| Circular dependencies | Testing difficulties | scheduler-service.ts |
| Duplicate implementations | Wasted code | 4 sports API services |

### Current Architecture

```
/src
├── app/                    # 73 API routes (mixed concerns)
├── components/             # 100+ components (no clear organization)
├── lib/                    # 100+ files (flat structure)
│   ├── atlas-*.ts          # Audio control (7 files)
│   ├── directv-*.ts        # DirecTV control
│   ├── cec-*.ts            # CEC control
│   ├── scheduler-*.ts      # Scheduling (circular deps)
│   └── ...                 # Everything else mixed together
└── db/
    └── schema.ts           # 1778 lines, 40+ tables
```

---

## V2 Target Architecture

### Package-Based Monorepo

```
sports-bar-tv-controller/
├── apps/
│   └── web/                          # Next.js 15 App (main application)
│       ├── src/
│       │   ├── app/                  # Pages & API routes
│       │   ├── components/           # App-specific components
│       │   └── hooks/                # React hooks
│       ├── package.json
│       └── next.config.js
│
├── packages/
│   ├── @sports-bar/database/         # Database layer
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── devices.ts        # Device tables
│   │   │   │   ├── scheduling.ts     # Schedule tables
│   │   │   │   ├── audio.ts          # Audio tables
│   │   │   │   └── index.ts          # Combined export
│   │   │   ├── helpers.ts            # CRUD operations
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/hardware/         # Hardware abstraction layer
│   │   ├── src/
│   │   │   ├── interfaces/           # Abstract interfaces
│   │   │   │   ├── audio-processor.ts
│   │   │   │   ├── matrix-switcher.ts
│   │   │   │   ├── tv-controller.ts
│   │   │   │   └── ir-blaster.ts
│   │   │   ├── drivers/
│   │   │   │   ├── atlasied/         # AtlasIED driver
│   │   │   │   ├── dbx-zonepro/      # DBX driver (future)
│   │   │   │   ├── wolfpack/         # Wolf Pack matrix
│   │   │   │   ├── crestron/         # Crestron (future)
│   │   │   │   ├── global-cache/     # IR blaster
│   │   │   │   ├── pulse-eight/      # CEC adapter
│   │   │   │   └── firetv/           # Fire TV ADB
│   │   │   ├── detection/            # Auto-detection
│   │   │   └── factory.ts            # Hardware factory
│   │   └── package.json
│   │
│   ├── @sports-bar/audio/            # Audio control
│   │   ├── src/
│   │   │   ├── atlas-client.ts
│   │   │   ├── meter-service.ts
│   │   │   ├── soundtrack.ts         # Soundtrack Your Brand
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/sports-data/      # Sports APIs
│   │   ├── src/
│   │   │   ├── espn-api.ts
│   │   │   ├── rail-media-api.ts
│   │   │   ├── channel-guide.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/scheduler/        # Scheduling engine
│   │   ├── src/
│   │   │   ├── scheduler-service.ts
│   │   │   ├── priority-calculator.ts
│   │   │   ├── state-reader.ts
│   │   │   ├── distribution-engine.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/validation/       # Request validation
│   │   ├── src/
│   │   │   ├── schemas.ts
│   │   │   ├── middleware.ts
│   │   │   ├── rate-limiting/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/logger/           # Logging
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   ├── enhanced-logger.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── @sports-bar/ui/               # Shared UI components
│   │   ├── src/
│   │   │   ├── primitives/           # Radix UI wrappers
│   │   │   ├── remotes/              # Remote control UIs
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── @sports-bar/types/            # Shared TypeScript types
│       ├── src/
│       │   ├── hardware.ts
│       │   ├── api.ts
│       │   ├── scheduling.ts
│       │   └── index.ts
│       └── package.json
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Workspace config
├── package.json                      # Root package
└── ecosystem.config.js               # PM2 config
```

---

## Technology Stack

### Build System: Turborepo + pnpm

**Why Turborepo:**
- Intelligent caching (70-90% faster builds)
- Parallel task execution
- Incremental builds
- Works with existing Next.js setup
- Maintained by Vercel (same team as Next.js)

**Why pnpm:**
- 3x faster than npm
- Efficient disk usage
- Better workspace support
- Strict dependency resolution

### Configuration Files

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**turbo.json:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## Hardware Abstraction Layer

### Interface Pattern

```typescript
// packages/@sports-bar/hardware/src/interfaces/audio-processor.ts

export interface AudioProcessor {
  // Identity
  readonly vendor: string;
  readonly model: string;
  readonly connectionType: 'http' | 'tcp' | 'telnet' | 'rs232';

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Zone Control
  getZones(): Promise<Zone[]>;
  setZoneVolume(zoneId: string, volume: number): Promise<void>;
  getZoneVolume(zoneId: string): Promise<number>;
  muteZone(zoneId: string, muted: boolean): Promise<void>;

  // Meters (optional)
  getMeterLevels?(): Promise<MeterLevel[]>;
  subscribeMeterUpdates?(callback: (levels: MeterLevel[]) => void): void;

  // Source Routing
  setZoneSource(zoneId: string, sourceId: string): Promise<void>;
  getAvailableSources(): Promise<Source[]>;
}
```

### Driver Implementation Example

```typescript
// packages/@sports-bar/hardware/src/drivers/atlasied/index.ts

import { AudioProcessor, Zone, MeterLevel } from '../../interfaces';
import { AtlasHTTPClient } from './http-client';
import { AtlasTCPClient } from './tcp-client';

export class AtlasIEDDriver implements AudioProcessor {
  readonly vendor = 'AtlasIED';
  readonly model: string;
  readonly connectionType = 'http';

  private httpClient: AtlasHTTPClient;
  private tcpClient: AtlasTCPClient;

  constructor(config: AtlasConfig) {
    this.model = config.model;
    this.httpClient = new AtlasHTTPClient(config.ipAddress);
    this.tcpClient = new AtlasTCPClient(config.ipAddress, config.tcpPort);
  }

  async connect(): Promise<void> {
    await this.httpClient.connect();
    await this.tcpClient.connect();
  }

  async setZoneVolume(zoneId: string, volume: number): Promise<void> {
    await this.httpClient.setParameter(`Zone${zoneId}_Volume`, volume);
  }

  // ... rest of implementation
}
```

### Hardware Detection

```typescript
// packages/@sports-bar/hardware/src/detection/orchestrator.ts

export async function detectHardware(): Promise<DetectedHardware[]> {
  const results: DetectedHardware[] = [];

  // Run all detectors in parallel
  const [audio, matrix, ir, cec] = await Promise.all([
    detectAudioProcessors(),
    detectMatrixSwitchers(),
    detectIRBlasters(),
    detectCECAdapters()
  ]);

  return [...audio, ...matrix, ...ir, ...cec];
}

async function detectAudioProcessors(): Promise<DetectedHardware[]> {
  const detectors = [
    new AtlasIEDDetector(),
    new DBXZoneProDetector(),
    new CrestronAudioDetector()
  ];

  const results = await Promise.all(
    detectors.map(d => d.detect())
  );

  return results.flat();
}
```

---

## Feature Manager System

### Feature Registry

```typescript
// packages/@sports-bar/hardware/src/features/registry.ts

export const FEATURES = {
  // Audio Features
  AUDIO_CONTROL: {
    id: 'audio-control',
    name: 'Audio Control',
    description: 'Zone volume and source control',
    requiredHardware: ['audio-processor'],
    routes: ['/audio-control', '/api/audio/*'],
    navItem: { label: 'Audio Control', icon: 'Volume2' }
  },

  AUDIO_METERS: {
    id: 'audio-meters',
    name: 'Real-time Meters',
    description: 'Live audio level monitoring',
    requiredHardware: ['audio-processor'],
    optional: true,
    dependsOn: ['AUDIO_CONTROL']
  },

  // Matrix Features
  MATRIX_ROUTING: {
    id: 'matrix-routing',
    name: 'Video Routing',
    description: 'HDMI matrix source routing',
    requiredHardware: ['matrix-switcher'],
    routes: ['/tv-setup', '/api/matrix/*']
  },

  // TV Control Features
  CEC_CONTROL: {
    id: 'cec-control',
    name: 'HDMI-CEC Control',
    description: 'TV power and volume via CEC',
    requiredHardware: ['cec-adapter']
  },

  IR_CONTROL: {
    id: 'ir-control',
    name: 'IR Control',
    description: 'Infrared remote control',
    requiredHardware: ['ir-blaster']
  }
} as const;
```

### React Context

```typescript
// packages/@sports-bar/hardware/src/features/context.tsx

export const FeatureContext = createContext<FeatureState>(null);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<EnabledFeatures>({});

  useEffect(() => {
    // Load enabled features from database
    loadEnabledFeatures().then(setFeatures);
  }, []);

  return (
    <FeatureContext.Provider value={{ features, isEnabled }}>
      {children}
    </FeatureContext.Provider>
  );
}

// Usage in components
function Navigation() {
  const { isEnabled } = useFeatures();

  return (
    <nav>
      {isEnabled('AUDIO_CONTROL') && <NavItem href="/audio-control" />}
      {isEnabled('MATRIX_ROUTING') && <NavItem href="/tv-setup" />}
    </nav>
  );
}
```

---

## Migration Strategy

### Phase Overview

| Phase | Duration | Risk | Description |
|-------|----------|------|-------------|
| 1. Setup | 1 week | Low | Install Turborepo, create structure |
| 2. Database | 1 week | Low | Extract database package |
| 3. Hardware | 2 weeks | Medium | Extract hardware drivers |
| 4. Services | 2 weeks | Low | Extract sports data, scheduler |
| 5. UI | 1 week | Low | Extract shared components |

**Total: 7 weeks, zero functional downtime**

### Phase 1: Infrastructure Setup

**Tasks:**
1. Install pnpm and Turborepo
2. Create workspace structure
3. Move existing code to `apps/web/`
4. Configure TypeScript paths
5. Test build still works
6. Update PM2 configuration

**Commands:**
```bash
# Install tools
npm install -g pnpm
pnpm add -D turbo

# Create structure
mkdir -p apps/web packages
mv src apps/web/
mv package.json apps/web/

# Create root package.json
# Create pnpm-workspace.yaml
# Create turbo.json

# Test build
turbo build
```

### Phase 2: Extract Database Package

**Files to Move:**
```
src/db/schema.ts → packages/@sports-bar/database/src/schema/
src/lib/db-helpers.ts → packages/@sports-bar/database/src/helpers.ts
drizzle.config.ts → packages/@sports-bar/database/
```

**Update Imports:**
```typescript
// Before
import { db } from '@/db'
import { schema } from '@/db/schema'

// After
import { db, schema } from '@sports-bar/database'
```

### Phase 3: Extract Hardware Package

**Order of Extraction:**
1. CEC (least used for Spectrum boxes)
2. IR (Global Cache)
3. ADB (Fire TV)
4. DirecTV
5. Matrix (Wolf Pack)

**For Each Driver:**
1. Create interface in `packages/@sports-bar/hardware/src/interfaces/`
2. Move implementation to `packages/@sports-bar/hardware/src/drivers/`
3. Update API routes to use new import
4. Test hardware still works
5. Move to next driver

### Phase 4: Extract Service Packages

**Packages to Create:**
- `@sports-bar/audio` - Atlas control, Soundtrack
- `@sports-bar/sports-data` - ESPN API, Rail Media
- `@sports-bar/scheduler` - Scheduling engine
- `@sports-bar/validation` - Request validation

### Phase 5: Extract UI Package

**Components to Extract:**
- Remote controls (Cable, DirecTV, FireTV)
- UI primitives (Radix wrappers)
- Shared components

---

## Development Workflow

### Working on V2

```bash
# Switch to v2 branch
git checkout v2-modular-architecture

# Install dependencies
pnpm install

# Start development
turbo dev

# Run tests
turbo test

# Build all packages
turbo build
```

### Keeping Production Running

```bash
# Production stays on main branch
# PM2 continues running main branch code

# When v2 is ready, merge to main
git checkout main
git merge v2-modular-architecture
npm run build
pm2 restart sports-bar-tv-controller
```

### Package Development

```bash
# Work on specific package
cd packages/@sports-bar/hardware

# Run tests for just this package
pnpm test

# Build just this package
turbo build --filter=@sports-bar/hardware
```

---

## Future Hardware Support

### Audio Processors (Planned)

| Vendor | Model | Protocol | Status |
|--------|-------|----------|--------|
| AtlasIED | AZM4/AZM8 | HTTP/TCP | Current |
| DBX | ZonePro 640/1260 | Telnet | Planned |
| Crestron | Various | CIP | Planned |
| QSC | Q-SYS | JSON-RPC | Future |
| Biamp | Tesira | TTP | Future |

### Matrix Switchers (Planned)

| Vendor | Model | Protocol | Status |
|--------|-------|----------|--------|
| Wolf Pack | Various | Telnet | Current |
| Crestron | DM Series | CIP | Planned |
| Extron | DXP/XTP | SIS | Future |
| Atlona | Velocity | REST | Future |

---

## Success Metrics

### Technical

- [ ] Build time < 30 seconds (from cache)
- [ ] All 73 API routes working
- [ ] All hardware integrations functional
- [ ] Test coverage > 70%
- [ ] No circular dependencies
- [ ] TypeScript strict mode enabled

### Developer Experience

- [ ] New hardware driver < 1 day to add
- [ ] Clear package boundaries
- [ ] Independent package testing
- [ ] Easy onboarding for new developers

### Business

- [ ] Support multiple hardware vendors
- [ ] Faster customer deployments
- [ ] Reduced support burden
- [ ] Easier demonstrations

---

## Related Documents

- [MODULAR_HARDWARE_ROADMAP.md](./planning/MODULAR_HARDWARE_ROADMAP.md) - Hardware abstraction details
- [FEATURE_MANAGER_UI_MOCKUPS.md](./planning/FEATURE_MANAGER_UI_MOCKUPS.md) - UI designs
- [MODULAR_SYSTEM_STATUS.md](./planning/MODULAR_SYSTEM_STATUS.md) - Original planning status
- [ARCHITECTURE_DECISION_RECORDS.md](./ARCHITECTURE_DECISION_RECORDS.md) - ADRs
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Design patterns

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Switch to v2 branch
git checkout v2-modular-architecture

# Install dependencies
pnpm install

# Start development
turbo dev
```

### Contributing

1. Create feature branch from `v2-modular-architecture`
2. Make changes in appropriate package
3. Run tests: `turbo test`
4. Create PR to `v2-modular-architecture`

---

**Document Owner:** System Administrator
**Review Schedule:** Weekly during development
**Next Milestone:** Phase 1 Complete
