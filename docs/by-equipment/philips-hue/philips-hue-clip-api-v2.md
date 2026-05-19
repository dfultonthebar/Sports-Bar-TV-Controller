# Philips Hue Bridge CLIP API v2

**Source URLs:**
- https://developers.meethue.com/develop/hue-api-v2/ (Philips Hue developer portal — login-gated for the deeper reference pages, public for getting-started)
- https://developers.meethue.com/develop/get-started-2/
- https://github.com/home-assistant/core/tree/dev/homeassistant/components/hue (Home Assistant Hue integration — open-source reference implementation)
- https://github.com/quentinsf/aiohue (Async Python Hue v2 client)

**Fetched:** 2026-05-18

---

## What CLIP API v2 Is

CLIP = "Connected Lighting Interface Protocol." The Hue Bridge (model **BSB002**, the square 2015+ unit — NOT the older round v1 bridge) exposes a local HTTPS REST API on the bridge's LAN IP. **CLIP API v2** is the current, recommended API (introduced ~2021) and replaces the legacy v1 API. Both run simultaneously on the same bridge; new integrations should use v2.

Key v2 advances over v1:

- **Resource-oriented** model with stable UUIDs (v1 used churn-prone integer IDs).
- **Server-Sent Events (SSE)** push stream — no more polling.
- **Bearer-token style header auth** (`hue-application-key`) — same secret as v1 username but used as an HTTP header rather than a URL path segment.
- **Grouped lights, scenes, and rooms as first-class resources.**

The v1 round bridge cannot do v2 — only the square BSB002 with firmware ≥ 1948086000.

## Transport

| Parameter | Value |
|-----------|-------|
| Base URL | `https://<bridge-ip>/clip/v2/resource/` |
| Port | **443/HTTPS** |
| Cert | Self-signed by Philips per-bridge — clients must skip CN verification or trust the bridge's signing CA (Philips ships a root cert at `https://www.philips-hue.com/...` for production use) |
| Auth | `hue-application-key: <app-key>` header on every request |
| Content-Type | `application/json` |

## Bridge Discovery

Two options:

1. **N-UPnP via Philips broker** — `GET https://discovery.meethue.com` returns a JSON array of bridges visible to your egress IP:
   ```json
   [{"id":"001788FFFE112233","internalipaddress":"192.168.1.50","port":443}]
   ```
2. **mDNS** — bridges advertise `_hue._tcp.local`.

The broker (option 1) is fine for one-shot install; mDNS is preferred for resilience because it works even when the internet is down.

## Authentication: Creating an Application Key

The v2 API uses the same one-time **link-button** ceremony as v1, but the resulting credential is consumed via the `hue-application-key` header instead of being stuffed into the URL path.

### Step 1: User presses the round link button on top of the bridge.

This opens a ~30-second window during which the bridge will accept new app-key requests.

### Step 2: Client POSTs to the v1 endpoint (yes, even for v2 keys — this part of the auth flow is v1)

```
POST https://<bridge-ip>/api
Content-Type: application/json

{
  "devicetype": "sports_bar_controller#holmgren",
  "generateclientkey": true
}
```

`devicetype` is a free-form label, conventionally `<app>#<instance>`. `generateclientkey: true` additionally generates a clientkey used for Entertainment streaming (DTLS).

### Step 3: Response

If the link button has not been pressed within ~30 s:

```json
[{"error":{"type":101,"address":"","description":"link button not pressed"}}]
```

If success:

```json
[{
  "success": {
    "username": "abcDEF1234...",   ← THIS is the application key
    "clientkey": "FF00112233..."   ← Entertainment streaming key (optional)
  }
}]
```

### Step 4: Use the username as a header on v2 calls

```
GET https://<bridge-ip>/clip/v2/resource/light
hue-application-key: abcDEF1234...
```

The application key is **per-app, not per-user**. Store it securely and reuse it across sessions.

## Resource Model

Every entity is a typed resource with a stable UUID. Get all resources of a type:

```
GET /clip/v2/resource/<type>
```

Get one:

```
GET /clip/v2/resource/<type>/<uuid>
```

### Primary resource types

| Type | Purpose |
|------|---------|
| `light` | Individual bulb / lamp (the on/off + brightness + color state) |
| `device` | Physical device (bulb hardware, dimmer switch, motion sensor) — wraps one or more `light`/`button`/`motion` services |
| `room` | Logical room grouping of devices |
| `zone` | Logical zone (multi-room or partial-room grouping) |
| `grouped_light` | The combined on/off+brightness control surface of a room/zone |
| `scene` | A saved snapshot of light states |
| `bridge` | The bridge itself |
| `bridge_home` | The whole home (top-level zone) |
| `motion` | Motion sensor service |
| `temperature` | Temperature sensor service |
| `light_level` | Ambient-light-level sensor service |
| `button` | Button on a Hue dimmer/tap/Smart button |
| `relative_rotary` | Rotary-input service (Hue Tap dial) |
| `behavior_instance` | Active behavior (formula/rule) |
| `geolocation` | Bridge's geo for sunrise/sunset triggers |

### Example: GET /resource/light

```
GET https://192.168.1.50/clip/v2/resource/light
hue-application-key: abcDEF1234...
```

Response:

```json
{
  "errors": [],
  "data": [
    {
      "type": "light",
      "id": "ff0084e8-4b85-4abe-9b95-c0e8c9b03dd2",
      "id_v1": "/lights/3",
      "owner": { "rid": "8c8d8b8e-...", "rtype": "device" },
      "metadata": { "name": "Bar Overhead 1", "archetype": "ceiling_round" },
      "on": { "on": true },
      "dimming": { "brightness": 78.0, "min_dim_level": 0.20 },
      "color_temperature": {
        "mirek": 366,
        "mirek_valid": true,
        "mirek_schema": { "mirek_minimum": 153, "mirek_maximum": 500 }
      },
      "color": {
        "xy": { "x": 0.4575, "y": 0.4099 },
        "gamut": { "red": {...}, "green": {...}, "blue": {...} },
        "gamut_type": "C"
      },
      "dynamics": { "status": "none", "status_values": ["none","dynamic_palette"] },
      "mode": "normal"
    }
  ]
}
```

`id` is the v2 stable UUID. `id_v1` is the legacy `/lights/3` path for cross-version mapping.

## Light Control (PUT)

### Turn a light on

```
PUT https://192.168.1.50/clip/v2/resource/light/ff0084e8-4b85-4abe-9b95-c0e8c9b03dd2
hue-application-key: abcDEF1234...
Content-Type: application/json

{ "on": { "on": true } }
```

### Set brightness to 50% and on

```json
{
  "on": { "on": true },
  "dimming": { "brightness": 50.0 }
}
```

`brightness` is **0.0-100.0 float (percent)**, not 0-254 like v1's `bri`.

### Set color temperature

```json
{ "color_temperature": { "mirek": 250 } }
```

Mirek = 1,000,000 / Kelvin. 153 mirek ≈ 6500K (cool), 500 mirek ≈ 2000K (warm).

### Set XY color

```json
{ "color": { "xy": { "x": 0.5, "y": 0.4 } } }
```

CIE 1931 xy coordinates. Each bulb has a `gamut` field listing what colors it can actually hit.

### Fade-in over time

```json
{
  "on": { "on": true },
  "dimming": { "brightness": 100 },
  "dynamics": { "duration": 5000 }
}
```

`duration` is milliseconds; the bulb smoothly interpolates.

## Grouped Light Control

Don't loop over individual lights when controlling a whole room — use `grouped_light`:

```
GET /clip/v2/resource/room                  ← find the room's grouped_light service
PUT /clip/v2/resource/grouped_light/<uuid>  ← writes propagate to all members in one ZigBee frame
```

This matters: writing 8 individual `light` PUTs floods the ZigBee mesh and lights pop on one-by-one. One `grouped_light` PUT is atomic from the user's perspective.

## Scene Activation

```
PUT /clip/v2/resource/scene/<scene-uuid>
Content-Type: application/json

{ "recall": { "action": "active" } }
```

Optional `duration` and `dimming` overrides:

```json
{
  "recall": { "action": "active", "duration": 3000, "dimming": { "brightness": 70 } }
}
```

`recall.action` values: `active` (default), `dynamic_palette`, `static`.

## SSE Event Stream

Real-time push, replaces polling:

```
GET https://192.168.1.50/eventstream/clip/v2
hue-application-key: abcDEF1234...
Accept: text/event-stream
```

Bridge holds the connection open and pushes events as Server-Sent Events:

```
id: 1700000000:0
data: [{"type":"update","id":"<event-uuid>","creationtime":"2026-05-18T12:00:00Z","data":[{"id":"ff00...","type":"light","on":{"on":false}}]}]

id: 1700000001:0
data: [{"type":"update", ...}]
```

Each `data:` line is a JSON array of update batches. Subscribe once at startup, reconnect on EOF. **Don't poll** — the bridge actively dislikes >10 req/s and will start dropping commands.

## Rate Limits (informal but real)

Philips documents ~10 commands/sec to a single bridge as a safe ceiling, and ~1 command/sec per individual light. Faster than that and the ZigBee mesh queue overruns — symptoms are commands appearing to land out-of-order or silently disappear. The `grouped_light` pattern + SSE event stream eliminates almost all need for high write rates.

## CLIP v2 vs v1 — When to Use Which

| Concern | v1 | v2 |
|---------|----|----|
| URL | `/api/<user>/lights/3/state` | `/clip/v2/resource/light/<uuid>` |
| Auth | username in URL path | `hue-application-key` header |
| IDs | small integers, reused after deletion | stable UUIDs |
| Brightness | 0-254 int | 0.0-100.0 float (percent) |
| Push events | none (poll-only) | SSE stream |
| Entertainment | not supported | DTLS streaming + Entertainment areas |

**Use v2 for everything new.** v1 remains supported for legacy integrations but Philips has signaled it will eventually go.

## Common Pitfalls

1. **Self-signed cert.** Most HTTP libraries reject the bridge's cert by default. Either: (a) disable verification on LAN (acceptable on a segregated VLAN), or (b) pin the Philips signing CA cert.
2. **Link button window is 30 s.** Don't ask the operator to press the button until the POST is queued and ready.
3. **`hue-application-key` is a secret.** Treat it like a password — anyone with it controls every light.
4. **SSE keepalive.** Bridges send a comment line (`:` followed by newline) every ~10s as keepalive. If you don't see one for >30s, reconnect.
5. **UUID stability across firmware updates** — generally yes, but factory reset re-generates everything. Don't hard-code UUIDs in code; look them up by `metadata.name` at startup.
6. **`grouped_light` vs `room`** — `room` is the logical entity; the room's `grouped_light` is the writable service. Always PUT to `grouped_light`, not `room`.
7. **PUT semantics are partial.** Sending `{"on":{"on":true}}` only changes the on state; brightness/color are untouched. There is no "replace whole light state" verb.

## References

- Hue v2 API docs (login-gated portal): https://developers.meethue.com/develop/hue-api-v2/
- aiohue async client: https://github.com/quentinsf/aiohue
- Home Assistant Hue v2 integration source: https://github.com/home-assistant/core/tree/dev/homeassistant/components/hue
- Bridge discovery broker: https://discovery.meethue.com
