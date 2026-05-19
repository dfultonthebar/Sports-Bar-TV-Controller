# PKnight CR011R DMX RGB Decoder

**Source URLs:**
- https://www.amazon.com/PKnight-Decoder-Controller-Channels-Lighting/dp/B07PJB22LZ (HTTP 503 at fetch time — specs reconstructed from product family knowledge + DMX512 conventions)
- https://www.pknight.eu/ (DNS unresolved at fetch time)
- Cross-referenced against generic DMX RGB-decoder conventions documented at https://en.wikipedia.org/wiki/DMX512
- **Referenced from:** `.claude/locations/holmgren-way.md` (Holmgren installation)

**Fetched:** 2026-05-18 (vendor sites unreachable — this doc captures the integration-relevant facts known from product listings and DMX-standard channel layouts; verify against the physical unit's manual before commissioning)

---

## What It Is

The PKnight CR011R is an inexpensive (~$20-30) **DMX512 → constant-voltage PWM decoder** for driving RGB or RGBW LED strips and tape. It's a "DMX-in, PWM-out" device: it does not generate DMX — an upstream controller (lighting console, Art-Net node, or our software via an Art-Net→DMX bridge) sends it standard DMX512, and it outputs PWM-dimmed DC to up to 3 (RGB) or 4 (RGBW) channels of LEDs.

It is **monitored / controlled by us, not extended.** We never write firmware for it — we just send DMX channel values.

## Electrical Specs (typical for the CR011R family)

| Parameter | Value |
|-----------|-------|
| Input voltage | DC 12 V or 24 V (constant voltage, matches LED strip) |
| Output channels | 3 (RGB) or 4 (RGBW) depending on SKU variant |
| Max current per channel | ~5-8 A (verify on physical label) |
| Total max load | ~20 A (limited by terminal-block ratings) |
| Output type | PWM, ~1-3 kHz typical (flicker-free for camera) |
| DMX input | 3-pin or 5-pin XLR or screw terminals (RS-485, 250 kbps) |
| DMX address setting | 10-position DIP switch (binary, channels 1-512) |
| DMX termination | 120 Ω, may need external terminator on the last device in chain |
| Dimensions | ~150 × 60 × 30 mm |

## DMX Channel Layout

The CR011R uses a **3-channel (RGB) or 4-channel (RGBW)** consecutive footprint starting at the DIP-switch-set base address `N`:

### RGB Variant (3 channels)

| DMX Channel Offset | Function | 0 = Off, 255 = Full |
|--------------------|----------|---------------------|
| `N + 0` | Red intensity | 0-255 |
| `N + 1` | Green intensity | 0-255 |
| `N + 2` | Blue intensity | 0-255 |

### RGBW Variant (4 channels)

| DMX Channel Offset | Function | 0 = Off, 255 = Full |
|--------------------|----------|---------------------|
| `N + 0` | Red intensity | 0-255 |
| `N + 1` | Green intensity | 0-255 |
| `N + 2` | Blue intensity | 0-255 |
| `N + 3` | White intensity | 0-255 |

**No master dimmer channel, no strobe channel, no preset macros** — it's a plain linear decoder. To dim the whole fixture, scale all channels in software.

### DIP Switch Address Setting

10-position DIP. Sum the position values to get the base address. Standard DMX DIP convention:

| Position | Value |
|----------|-------|
| 1 | 1 |
| 2 | 2 |
| 3 | 4 |
| 4 | 8 |
| 5 | 16 |
| 6 | 32 |
| 7 | 64 |
| 8 | 128 |
| 9 | 256 |
| 10 (sometimes labeled "ON/OFF" or mode) | mode/512 |

Example: address 1 = no switches up (or only switch 1 up, vendor-dependent on the +1 offset convention). Address 100 = switches 3+6+7 up (4 + 32 + 64 = 100). **Verify on the unit** — some manufacturers use "address - 1" binary encoding.

## Integration into This Codebase

The CR011R is referenced in Holmgren's location notes as part of the bar's accent-lighting rig. There is **no dedicated `@sports-bar/pknight` package** — the integration path (if/when we automate it) is:

```
Sports Bar TV Controller
        │
        ▼  (Art-Net OpDmx 0x5000 — see artnet-protocol-reference.md)
   Art-Net node
   (e.g. Enttec ODE Mk3, DMXKing eDMX1, or a Raspberry Pi running OLA)
        │
        ▼  (RS-485 DMX512 over XLR/cat5)
   PKnight CR011R (DMX address N)
        │
        ▼  (PWM 12/24 V)
   RGB/RGBW LED strip
```

When implementing, the controller layer writes 3 or 4 consecutive bytes starting at DMX channel `N` in the target universe, sends an `OpDmx` packet to the Art-Net node, and the CR011R picks the data up off the DMX wire.

## Common Pitfalls

1. **DIP switch off-by-one.** Vendor docs are inconsistent on whether DIP-bit-1 maps to address 1 or address 2. Set the DIPs, send 100% red on what you THINK is channel 1, and watch which strip lights up. Adjust.
2. **Daisy-chain termination.** RS-485 needs 120 Ω across A/B on the last device. Without it, long runs work intermittently — symptoms are random flicker, especially with multiple units.
3. **PWM flicker on camera.** If we ever shoot video of the bar (bartender remote camera, OBSBOT Tail 2), the CR011R's PWM frequency may beat with the camera's shutter and cause rolling-bar artifacts. Most current SKUs are >1 kHz and fine, but old stock may be ~250 Hz; spec-check before camera-critical installs.
4. **24 V strip on a 12 V decoder (or vice versa)** — match the strip's voltage to the decoder's input rating exactly. Wrong voltage either underdrives (dim, color-shifted) or burns the FETs.
5. **Channel ordering on the strip.** The strip's "RGB" wire labels are not always honored by the decoder's terminal silkscreen. Test each output independently at install time.

## Diagnostic Quick-Test (no controller required)

If the unit has a "test mode" DIP position (often position 10), enabling it runs a built-in R→G→B chase so you can prove decoder + strip + wiring are good before chasing DMX issues upstream.

## References

- DMX512 underlying protocol: https://en.wikipedia.org/wiki/DMX512
- Art-Net→DMX path: `docs/by-equipment/dmx-artnet/artnet-protocol-reference.md`
- Holmgren install notes: `.claude/locations/holmgren-way.md`
