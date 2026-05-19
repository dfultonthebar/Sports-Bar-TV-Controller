# @sports-bar/firecube

**Purpose:** Amazon Fire TV / Fire TV Cube control over ADB — keep-alive shell sessions, network discovery, app catalog probing, sideload, sports-content detection.

**Key exports** (`src/index.ts`):
- `ADBClient`, `ADBConnectionOptions` — keep-alive ADB shell wrapper (`src/adb-client.ts`)
- `FireCubeDiscovery` — network scan + ADB discovery (`src/discovery.ts`)
- `SideloadService` — APK push/install (`src/sideload-service.ts`)
- `SportsContentDetector` — detects when sports content is playing (`src/sports-content-detector.ts`)
- `SubscriptionDetector`, `createSubscriptionDetector` — subscription polling (`src/subscription-detector.ts`)
- `KeepAwakeScheduler`, `createKeepAwakeScheduler` — prevents screensaver / sleep (`src/keep-awake-scheduler.ts`)
- Constants: `FIRETV_SPORTS_APPS`, `SPORTS_QUICK_ACCESS`, `KNOWN_SPORTS_APPS`, `generateFireTVDeviceId`
- Scheduler-types: `FireCubeDevice`, `FireCubeApp`, `KeepAwakeLog`, `ConnectionManagerAdapter`, `FireCubeDeviceRepository`, repository interfaces

**Protocol / port:** ADB over TCP **5555** (`new ADBClient(ip, 5555)`). Devices must have "ADB Debugging" enabled in Fire TV Developer Options.

**Used by:** `apps/web` Fire TV API routes; `@sports-bar/scheduler` (`firetv-app-sync`, `firetv-catalog-walker`, `firetv-content-detector`); `@sports-bar/streaming` for app launch.

**Gotchas:**
- **ADB shell default timeout is 3000 ms** — silently truncates `uiautomator dump` on busy launcher home screens. Pass 10000 ms when walking the launcher (CLAUDE.md per memory: walker passes 10000 ms in v2.32.89).
- Prime Video on Cube model AFTR (PVFTV builds) is **launcher-hosted in `com.amazon.firebat`** — `com.amazon.avod` is not installed. Always `pm path` to verify package presence (CLAUDE.md Gotcha #9).
- ESPN GTV Watch CTA is **DPAD-only** — synthetic touch (`input tap` / `dispatchGesture`) is rejected. Only `KEYCODE_DPAD_CENTER` advances to PlayerActivity (per memory).
- Discovery scans subnets — coordinate with infosec on noisy network probes.

**See also:**
- `@sports-bar/streaming` (app catalog / launch layer that sits on top of this)
- CLAUDE.md Gotchas #9 (Prime Video launcher-hosted) and §5.1 (Fire TV control)
- `docs/PVFTV320_LAUNCHER_PROBE.md`
