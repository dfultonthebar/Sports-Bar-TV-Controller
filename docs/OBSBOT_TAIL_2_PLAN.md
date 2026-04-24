# OBSBOT Tail 2 Camera — Integration Plan

**Status:** Planning. Hardware ships to next location (TBD).
**Owner:** Sports Bar TV Controller team.
**Created:** 2026-04-24.

## Goal

Bartender remote tab + admin device-config tab for the OBSBOT Tail 2
PTZ camera. Per-location: zero, one, or many cameras. Bartender previews
the live feed and controls PTZ + AI tracking + presets from the iPad.

## Protocol Findings (research summary)

| Surface | Tail 2 support | Use for |
|---|---|---|
| **VISCA over IP (UDP 52381)** | Native, primary | All control commands |
| **VISCA over UART** | Native | Not used (no serial wiring planned) |
| **Pelco-D / Pelco-P** | Native | Not used (legacy serial) |
| **HTTP REST API** | NO (web UI only, undocumented endpoints) | Not used |
| **ONVIF** | NO | Not used |
| **RTSP** | YES, `rtsp://<ip>:8554/live` (port 8554, NOT 554) | Live stream source |
| **NDI \|HX2/HX3** | Paid license required | Not used |
| **SRT** | YES, default UDP 5000 | Not used |
| **mDNS** | YES, advertises as `Tail_2_XXXXXX.local` | Auto-discovery |

**Key finding:** No native HTTP REST API. All control via VISCA-over-UDP.
Web UI uses `Admin/Admin` default credentials (forced change on first
login) but its endpoints are undocumented and not used by this integration.

**Risk flag:** OBSBOT-specific VISCA extensions (AI tracking on/off,
"Only Me" target lock, gimbal reset) are NOT in the standard Sony VISCA
spec. They're listed in a downloadable Tail 2 VISCA Excel file from
[obsbot.com/explore/obsbot-tail-air/visca-over-ip](https://www.obsbot.com/explore/obsbot-tail-air/visca-over-ip).
**Operator must obtain this XLS before implementing AI features.** As a
fallback, the commands can be reverse-engineered by sniffing the OBSBOT
Center desktop app with Wireshark or watching the Web UI in browser
DevTools.

## Architecture

### Stream Preview — RTSP → LL-HLS via MediaMTX

Browser `<video>` cannot play RTSP directly. Run MediaMTX as a sidecar
on the same host as the Next.js app. iPad Safari plays LL-HLS in
`<video>` natively (no JS shim required). Latency target: ~500ms.

```
Tail 2 (RTSP :8554/live) → MediaMTX → LL-HLS (:8888/<path>/index.m3u8) → iPad <video>
```

MediaMTX config example (`mediamtx.yml`):
```yaml
paths:
  obsbot-mainbar:
    source: rtsp://192.168.1.100:8554/live
    sourceOnDemand: yes  # Only pull when a viewer is connected
```

Alternative: `go2rtc` (similar capability, different config). Choose
MediaMTX for the iOS-friendly LL-HLS path.

### Control — VISCA-over-UDP

New shared package `packages/obsbot/` mirroring the
`packages/wolfpack/` pattern (command queue, retry, structured logging).

```
packages/obsbot/
├── src/
│   ├── visca-client.ts       # raw UDP socket + command framing + queue
│   ├── obsbot-tail2.ts       # high-level: pan(), tilt(), zoom(), preset(), aiTrack()
│   ├── visca-commands.ts     # opcode constants (Sony standard + OBSBOT extensions)
│   └── index.ts
├── package.json
└── tsconfig.json
```

Sony-standard opcodes (work day-1):

| Function | Frame |
|---|---|
| Pan/Tilt | `81 01 06 01 VV WW 0p 0t FF` |
| Zoom (variable) | `81 01 04 07 0p FF` |
| Home | `81 01 06 04 FF` |
| Reset gimbal | `81 01 06 05 FF` |
| Preset save | `81 01 04 3F 01 0p FF` |
| Preset recall | `81 01 04 3F 02 0p FF` |

OBSBOT extensions (require XLS): AI tracking on/off, target lock.

### Discovery

Auto-discovery via mDNS using `bonjour-service` npm lib. Filter by name
prefix `Tail_2_`. Manual IP entry remains the fallback in Device Config UI.

Service-type sniff to confirm: `dns-sd -B _http._tcp` on a network with
the camera. (OBSBOT does not document the service type.)

### Database

New table `ObsbotCamera` in `apps/web/src/db/schema.ts`:

```typescript
export const obsbotCameras = sqliteTable('ObsbotCamera', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),                       // "Main Bar Cam"
  ipAddress: text('ipAddress').notNull(),
  viscaPort: integer('viscaPort').default(52381),
  rtspPort: integer('rtspPort').default(8554),
  rtspPath: text('rtspPath').default('/live'),
  mediamtxPath: text('mediamtxPath'),                 // "obsbot-mainbar"
  webUiUser: text('webUiUser'),                       // "Admin" (encrypted-at-rest if password stored)
  webUiPasswordEnc: text('webUiPasswordEnc'),
  status: text('status').default('offline'),
  lastSeenAt: text('lastSeenAt'),
  presets: text('presets'),                           // JSON: { "1": {pan, tilt, zoom, label}, ... }
  aiTrackingEnabled: integer('aiTrackingEnabled').default(0),
  createdAt: text('createdAt').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updatedAt').default(sql`CURRENT_TIMESTAMP`).notNull(),
})
```

Follow CLAUDE.md §6 device-DB-source-of-truth pattern. JSON file is
seed-only on first install; DB is authoritative thereafter.

### API Routes

Planned under `apps/web/src/app/api/obsbot/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/obsbot/cameras` | GET, POST | List, create |
| `/api/obsbot/cameras/[id]` | GET, PUT, DELETE | CRUD |
| `/api/obsbot/cameras/[id]/test` | POST | Connection test |
| `/api/obsbot/cameras/[id]/move` | POST | `{pan, tilt, speed}` |
| `/api/obsbot/cameras/[id]/zoom` | POST | `{direction: 'in'|'out'|'stop', speed}` |
| `/api/obsbot/cameras/[id]/home` | POST | Recenter |
| `/api/obsbot/cameras/[id]/preset` | POST | `{action: 'save'|'recall', slot: 0-15, label?}` |
| `/api/obsbot/cameras/[id]/ai-track` | POST | `{enabled: bool}` (TODO: needs XLS) |
| `/api/obsbot/discover` | GET | mDNS scan, returns candidate cameras |

### UI Components

1. **Bartender remote new tab — "Camera"** (only visible if `ObsbotCamera`
   table has rows). Component path:
   `apps/web/src/components/ObsbotCameraPanel.tsx`. Layout:
   - LL-HLS video preview (full width on iPad)
   - PTZ joystick widget (touch-drag → pan/tilt with proportional speed)
   - Zoom +/- buttons (hold-to-zoom)
   - Home button
   - Preset row (8 buttons: tap to recall, long-press to save current
     position to that slot)
   - AI tracking toggle (when XLS commands available)

2. **Device Config new section — "OBSBOT Cameras"**:
   `apps/web/src/components/ObsbotCameraManager.tsx`. CRUD + test
   + auto-discover button.

### Sequencing (build order)

1. **Phase 1 — Skeleton (this doc + DB + empty package)**
   - DB table + drizzle migration
   - `packages/obsbot/` empty package + visca-commands.ts constants
   - `/api/obsbot/cameras` CRUD
   - Device Config UI (no preview, no control yet)

2. **Phase 2 — Stream preview**
   - MediaMTX install + sidecar systemd unit
   - `mediamtxPath` resolution from camera config
   - `<video>` HLS player in bartender tab

3. **Phase 3 — VISCA control (Sony standard)**
   - `visca-client.ts` UDP client + queue + retry
   - PTZ + zoom + home + presets working from bartender tab

4. **Phase 4 — OBSBOT extensions (gated on XLS)**
   - AI tracking toggle
   - "Only Me" / target lock
   - Gimbal reset

5. **Phase 5 — mDNS discovery** (nice-to-have; manual IP works)

## Per-location Setup

When the next location's camera arrives:

1. Power on, complete Web UI initial setup (change Admin password).
2. Note the static IP (configure DHCP reservation in router for stability).
3. In Web UI → Settings → Stream → enable RTSP. Confirms URL is
   `rtsp://<ip>:8554/live`.
4. Add to MediaMTX config (or trigger `obsbot-add` script that does it).
5. Add row to `ObsbotCamera` via Device Config UI.
6. Test PTZ via the Test button before bartenders see it.

## Rollback

All additive — new table, new package, new routes, new UI tab. To
remove: drop the `ObsbotCamera` table, delete the package, revert the
new routes/components. No existing functionality depends on this.

## Open Questions

- **Mounting / camera placement.** Where in the bar does Tail 2 go?
  Behind-bar overhead for crowd / bartender view? On-stage for live
  performances? Affects which features matter most.
- **Stream recording.** Do we want MediaMTX to also record clips to
  disk (e.g. for highlights)? Out of scope for v1.
- **Multiple bartender views.** If a bartender opens Camera tab on two
  iPads simultaneously, MediaMTX serves both from one upstream pull
  (efficient). No work needed, just verify.
- **AI tracking with audience.** Tail 2 AI tracking is designed for one
  presenter on stage. In a bar with crowd movement, may behave erratically.
  Test before exposing to bartenders.

## References

- OBSBOT Tail 2 Web UI Guide: https://www.obsbot.com/explore/obsbot-tail-2/web-ui-user-guide
- OBSBOT Tail Series VISCA over IP: https://www.obsbot.com/explore/obsbot-tail-air/visca-over-ip
- MediaMTX: https://github.com/bluenviron/mediamtx
- bonjour-service (mDNS): https://github.com/onlxltd/bonjour-service
- Sony VISCA spec (community-maintained): https://github.com/norihiro/libvisca-ip
