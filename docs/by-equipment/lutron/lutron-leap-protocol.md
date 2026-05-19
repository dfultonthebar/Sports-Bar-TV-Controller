# Lutron LEAP Protocol (Caseta, RA2 Select, RadioRA 3, Homeworks QSX)

**Source URLs:**
- https://github.com/gurumitts/pylutron-caseta (open-source Python LEAP client — primary protocol reference)
- https://github.com/gurumitts/pylutron-caseta/blob/master/README.md
- Cross-referenced against the Home Assistant `lutron_caseta` integration source

**Fetched:** 2026-05-18

---

## What LEAP Is

**LEAP = Lutron Embedded Application Protocol.** It is Lutron's modern, JSON-based, TLS-secured integration protocol used by:

- **Caseta Wireless** (Smart Bridge L-BDG2-WH, Smart Bridge Pro L-BDGPRO2-WH)
- **RA2 Select** (RR-SEL-REPK-BL main repeater)
- **RadioRA 3** (RR-PROC3 processor) — the current high-mid-tier system
- **Homeworks QSX** (QSX-PROC) — the current high-end system

It is the spiritual successor to the old ASCII-over-telnet "Lutron Integration Protocol" still used by **RadioRA 2** main repeaters and **Homeworks QS** (one generation older than QSX). See `lutron-legacy-telnet-integration.md` for that side.

## Transport

| Parameter | Value |
|-----------|-------|
| Port | **8081/TCP** (TLS-wrapped) |
| Protocol | JSON message framing over TLS, mutual cert auth |
| Encoding | UTF-8 JSON, newline-terminated frames |
| Auth | Client SSL certificate (provisioned via the bridge's "small black button" pairing flow) |

## Pairing / Authentication Flow

LEAP requires **mutual TLS** — both bridge and client present certs. The bridge's cert is self-signed (acts as its own CA); the client cert is signed by the bridge during a one-time pairing handshake.

Steps:

1. Press the **small black button on the back of the Smart Bridge** (this is the "PhysicalAccess" gesture — the bridge only signs certs while this button is pressed/recently pressed).
2. Client opens a plain TCP socket to `bridge_ip:8083` (pairing port, NOT 8081), sends a CSR (Certificate Signing Request).
3. Bridge signs the CSR with its internal CA and returns three artifacts:
   - **`caseta-bridge.crt`** — the bridge's CA cert (trust anchor for verifying the bridge in future TLS handshakes)
   - **`caseta.crt`** — the client cert (signed by the bridge's CA)
   - **`caseta.key`** — the client's private key (generated locally, never leaves the client)
4. From now on, the client opens TLS connections to `bridge_ip:8081` presenting `caseta.crt` + `caseta.key` and verifying the bridge against `caseta-bridge.crt`.

Pylutron-caseta stores these in `$XDG_CONFIG_HOME/pylutron_caseta/` (typically `~/.config/pylutron_caseta/`).

```python
# Reference: pylutron-caseta connection setup
from pylutron_caseta.smartbridge import Smartbridge
bridge = Smartbridge.create_tls(
    "192.168.1.50",       # bridge IP
    "caseta.key",         # client private key
    "caseta.crt",         # client cert
    "caseta-bridge.crt",  # bridge CA cert (trust anchor)
)
await bridge.connect()
```

## Message Format

LEAP messages are JSON objects with three top-level fields:

```json
{
  "CommuniqueType": "ReadRequest" | "UpdateRequest" | "ReadResponse" | ...,
  "Header": {
    "ClientTag": "<arbitrary-correlation-id>",
    "Url": "/zone/5/status"
  },
  "Body": {
    // request- or response-specific payload
  }
}
```

`ClientTag` is echoed in the response so async clients can correlate request → response.

## Common Communique Types

| CommuniqueType | Direction | Purpose |
|----------------|-----------|---------|
| `ReadRequest` | Client → Bridge | Query state (zone level, device status, area config) |
| `ReadResponse` | Bridge → Client | Reply to ReadRequest |
| `CreateRequest` | Client → Bridge | Invoke a command processor (set level, raise/lower, button press) |
| `CreateResponse` | Bridge → Client | Reply to CreateRequest |
| `UpdateRequest` | Client → Bridge | Modify a resource |
| `SubscribeRequest` | Client → Bridge | Subscribe to event stream for a URL |
| `ReadStatusRequest` | Client → Bridge | Status-style read (subscription-aware) |

## Common URLs

| URL | What it does |
|-----|--------------|
| `/server/1/status/ping` | Heartbeat |
| `/project` | Project metadata (name, location, system type) |
| `/area` | All rooms/zones the bridge knows about |
| `/zone` | All controllable zones (dimmable lights, switches, shades, fan controllers) |
| `/zone/{id}/status` | Current level/state of one zone |
| `/zone/{id}/commandprocessor` | Send a command to one zone (GoToLevel, Raise, Lower, Stop, GoToFanSpeed) |
| `/device` | All devices (keypads, picos, sensors, hubs) |
| `/device/{id}/buttonevent` | Subscribe to Pico/keypad button events |
| `/virtualbutton` | Smart Bridge Pro / RA3 / QSX virtual buttons (used for scene activation) |
| `/virtualbutton/{id}/commandprocessor` | "Press" a virtual button |
| `/occupancygroup` | Occupancy sensors |

## Command Examples

### Set a dimmer to 75%

```json
// Request
{
  "CommuniqueType": "CreateRequest",
  "Header": {
    "ClientTag": "abc-123",
    "Url": "/zone/5/commandprocessor"
  },
  "Body": {
    "Command": {
      "CommandType": "GoToLevel",
      "Parameter": [
        { "Type": "Level", "Value": 75 }
      ]
    }
  }
}
```

Level is **0-100** (percent), not 0-255 like DMX. `0` = off, `100` = full on. Lutron handles dimmer-curve mapping internally.

### Turn a switch on

```json
{
  "CommuniqueType": "CreateRequest",
  "Header": { "Url": "/zone/12/commandprocessor" },
  "Body": {
    "Command": {
      "CommandType": "GoToLevel",
      "Parameter": [{ "Type": "Level", "Value": 100 }]
    }
  }
}
```

(Switched outputs accept only 0 or 100.)

### Activate a scene (virtual button press)

```json
{
  "CommuniqueType": "CreateRequest",
  "Header": { "Url": "/virtualbutton/3/commandprocessor" },
  "Body": {
    "Command": { "CommandType": "PressAndRelease" }
  }
}
```

### Read a zone's current level

```json
// Request
{
  "CommuniqueType": "ReadRequest",
  "Header": { "Url": "/zone/5/status" }
}

// Response
{
  "CommuniqueType": "ReadResponse",
  "Header": { "Url": "/zone/5/status", "StatusCode": "200 OK" },
  "Body": {
    "ZoneStatus": {
      "href": "/zone/5/status",
      "Level": 75,
      "Zone": { "href": "/zone/5" }
    }
  }
}
```

### Subscribe to Pico button events

```json
{
  "CommuniqueType": "SubscribeRequest",
  "Header": { "Url": "/device/14/buttongroup/0/buttonevent" }
}
```

Bridge then streams unsolicited `ReadResponse` frames whenever the button is pressed/released — useful for "if guest presses scene 2 on the bar Pico, switch matrix to game-day input."

## High-Level Pylutron-Caseta Calls

The Python library wraps LEAP into idiomatic calls:

```python
await bridge.turn_on(device_id)              # GoToLevel 100
await bridge.turn_off(device_id)             # GoToLevel 0
await bridge.set_value(device_id, 50)        # GoToLevel 50
await bridge.activate_scene(scene_id)        # virtualbutton PressAndRelease
devices = bridge.get_devices_by_domain("light")
scenes = bridge.get_scenes()
bridge.add_subscriber(device_id, callback)   # Pico events
```

## How LEAP Differs From the Old Telnet Integration

| Aspect | LEAP (Caseta, RA3, QSX) | Telnet (RadioRA 2, Homeworks QS) |
|--------|--------------------------|----------------------------------|
| Port | 8081/TLS | 23/cleartext telnet |
| Format | JSON | ASCII lines `#OUTPUT,5,1,75` |
| Auth | Mutual TLS, cert pairing | Username/password (default `lutron`/`integration`) |
| Discovery | Resource tree under `/zone`, `/device`, `/area` | Numeric IDs from the integration report |
| Events | Subscribe to specific URLs | Stream of `~OUTPUT`/`~DEVICE` lines, must parse all |
| Level range | 0-100 | 0-100 (same) |
| Bridges supported | Smart Bridge, Smart Bridge Pro, RA2 Select, RR-PROC3, QSX-PROC | RR-MAIN-REP-WH (RA2), QSE-CI-NWK-E (Homeworks QS) |

**Mapping the same operation across both:**

| Operation | LEAP | Telnet |
|-----------|------|--------|
| Set dimmer 5 to 75% | `CreateRequest /zone/5/commandprocessor {GoToLevel 75}` | `#OUTPUT,5,1,75` |
| Query dimmer 5 | `ReadRequest /zone/5/status` | `?OUTPUT,5,1` |
| Press scene button | `CreateRequest /virtualbutton/3/commandprocessor {PressAndRelease}` | `#DEVICE,1,3,3` (device 1, button 3, action 3=press) |

## Bridge Model Identification

When pylutron-caseta connects, it reads `/project` to learn what kind of bridge it's talking to:

| `ProductType` field | Model |
|---------------------|-------|
| `Caseta Wireless` | Smart Bridge / Smart Bridge Pro |
| `RA2 Select` | RR-SEL-REPK-BL |
| `RadioRA 3 Project` | RR-PROC3 |
| `Homeworks QSX Project` | QSX-PROC |

Some commands are bridge-specific — e.g. fan-speed control is only on certain firmwares; scene tagging differs between Caseta and RA3.

## Common Pitfalls

1. **Pairing only works during physical button press.** Plan an install with someone physically at the bridge — remote provisioning is impossible by design.
2. **Cert files are device-specific.** A `caseta.crt` signed by Bridge A will not authenticate to Bridge B. Don't copy certs between locations.
3. **The bridge's cert is self-signed with no CN matching the IP.** Stock SSL verification will fail — clients MUST trust against `caseta-bridge.crt` specifically, not the system CA store.
4. **LEAP IDs are NOT human-readable.** A "dimmer" is `/zone/5`, not `/zone/bar-overhead`. Maintain a name→id table in your integration layer.
5. **The bridge will silently disconnect idle TLS connections after a few minutes.** Send `/server/1/status/ping` every 60s, or reconnect on EOF.
6. **Pico remote events are subscription-only.** Without an active `SubscribeRequest`, you'll never see button presses. Re-subscribe on every reconnect.

## References

- pylutron-caseta: https://github.com/gurumitts/pylutron-caseta
- Home Assistant integration: https://github.com/home-assistant/core/tree/dev/homeassistant/components/lutron_caseta
- Lutron Integration Protocol (telnet, legacy) doc: `docs/by-equipment/lutron/lutron-legacy-telnet-integration.md`
