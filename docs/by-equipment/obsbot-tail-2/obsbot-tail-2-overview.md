# OBSBOT Tail 2 — PTZ Camera Overview (Stub)

**Source URLs:**
- https://www.obsbot.com/ (manufacturer)
- https://www.obsbot.com/store/products/tail-2 (product page, returned 503 at fetch time)
- Existing in-repo plan: `docs/OBSBOT_TAIL_2_PLAN.md`

**Status:** STUB — integration is not yet live in this codebase. Captured for AI grounding and future implementation.

**Fetched:** 2026-05-18

---

## What It Is

The **OBSBOT Tail 2** is an AI-powered PTZ (pan/tilt/zoom) camera aimed at content creation and live production. The hardware is a self-contained PTZ unit with onboard AI for auto-tracking subjects, optical zoom, and integrated streaming output. Distinguishes itself from cheap conferencing PTZs (Logitech, AVer) by its on-device AI Director mode and from broadcast PTZs (Panasonic, Sony) by being a tenth of the price.

For a sports bar context, the use case is **live camera angles of the bar** (band stage, dart league, special events) routed into a multiview or streamed to social — not security camera duty.

## Specs (from OBSBOT public product listings)

| Spec | Value |
|------|-------|
| Resolution | 4K UHD (up to 4K @ 60fps depending on firmware/codec) |
| Sensor | 1/1.5" CMOS |
| Optical zoom | ~5x (additional digital zoom available) |
| Pan range | ±170° |
| Tilt range | ~−30° to +90° |
| AI features | Subject auto-tracking (face/body/whole-body), gesture control, AI Director multi-cam switching |
| Streaming protocols | NDI HX, RTSP, RTMP, SRT (model-dependent firmware) |
| Output | USB-C (UVC + UAC), HDMI, Ethernet, Wi-Fi |
| Audio | Dual built-in mic with onboard DSP; 3.5mm line-in |
| Control protocols | **VISCA over IP, Pelco-D, OSC, manufacturer SDK** |
| Web UI | Built-in for setup + manual PTZ |
| Power | PoE+ or USB-C PD |

## Why This Matters for the Codebase

The CLAUDE.md hardware control layer follows a "one package per device family" convention (`@sports-bar/atlas`, `@sports-bar/directv`, `@sports-bar/firecube`, etc.). When OBSBOT integration ships, it would likely land as `@sports-bar/obsbot` or `@sports-bar/ptz-camera` with at minimum:

- VISCA-over-IP client (port 52381 UDP, the de-facto VISCA-IP standard) for PTZ preset recall, pan/tilt/zoom moves
- Web API client for AI Director mode toggles (REST, JSON, port 80/443)
- Stream URL publisher to the multi-view package (`@sports-bar/multiview`) so a camera angle can land on a TV via Wolf Pack matrix
- NDI HX consumption path (probably outside this codebase — feeds a dedicated NDI display or vMix-style host)

## Integration Touch-Points (when implemented)

| Surface | What it does |
|---------|--------------|
| Device Config → Video → PTZ Cameras (TBD) | Add/remove cameras, set static IP, store preset names |
| Bartender remote → Video tab | Recall presets ("bar overview", "stage close-up"), toggle auto-track |
| Special-event scheduler | Auto-recall preset N at game-start time, switch matrix to camera input |
| AI Director events | Could log to the same `CECCommandLog`/`CommandLog` audit trail as other devices |

## Control Protocols Notes (preliminary)

### VISCA-over-IP

UDP port **52381**. Sony VISCA protocol wrapped in a small UDP framing header (payload type + sequence number). Same command words as classic serial VISCA — pan/tilt drive, zoom drive, preset recall, autofocus on/off, exposure. Plenty of public OSS clients exist (`pyvisca-ip`, `node-visca`) to model after.

### Pelco-D

Older serial-PTZ standard, supported as a fallback. Less precise positional control than VISCA. Probably not used in our integration unless someone needs to glue to an older NVR.

### OSC

Open Sound Control, UDP. Suitable for low-latency event-driven control (e.g. footswitch presses → camera preset). Likely overkill for our use case.

### Manufacturer Web API

REST + WebSocket on the camera's IP. Documented partially in the OBSBOT developer portal (developer.obsbot.com). Covers AI Director mode toggles, firmware update, stream-key configuration.

## Common Pitfalls (anticipated)

1. **PoE+ required, not PoE.** Standard 15W PoE switches won't power the Tail 2 fully — it needs 802.3at (25W). Symptoms of under-power: brownouts on hard pan/tilt moves.
2. **VISCA-IP sequence numbers must increment.** Some implementations forget; the camera silently drops mid-stream.
3. **NDI HX is licensed.** Free for use but requires the NewTek NDI tools to be discoverable on the LAN. mDNS must work.
4. **AI Director conflicts with manual PTZ.** Recalling a preset while AI Director is on either is ignored or fights the AI — disable AI Director programmatically before preset recall.
5. **HDMI output capabilities differ from USB output.** 4K60 over HDMI, may downsample over USB.

## References

- Existing implementation plan in this repo: `docs/OBSBOT_TAIL_2_PLAN.md`
- OBSBOT developer portal: https://developer.obsbot.com
- VISCA-over-IP spec reference: https://www.epiphan.com/userguides/LUMiO12x/Content/UserGuides/PTZ/3-operation/VISCAcommands.htm
- NDI HX SDK: https://ndi.video/sdk/
