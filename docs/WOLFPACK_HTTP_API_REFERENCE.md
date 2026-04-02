# Wolf Pack HTTP API Reference

Complete reference for the HDTVSupply Wolf Pack matrix switcher HTTP API.

**Firmware:** V1.5.1 | **Web server:** lighttpd/1.4.45 | **Port:** 80

## Authentication

All state-changing commands require a PHP session cookie.

### Login Flow

```
1. POST /login.php
   Body: username=admin&password=admin
   Response: 302 redirect + Set-Cookie: PHPSESSID=xxx

2. GET /index.php
   Cookie: PHPSESSID=xxx
   (Finalizes the session — required before commands work)

3. GET /get_json_cmd.php?cmd=o2o&prm=0,32
   Cookie: PHPSESSID=xxx
   (Now commands are accepted)
```

**Important:** You must follow the redirect to `/index.php` after login. Without this step, the session is not fully authenticated and routing commands are silently ignored.

**Important:** Must use Node's native `http` module (not `fetch()`) to avoid Next.js request deduplication and interception.

## Index Convention

All input/output indices are **0-based**:
- Input 1 = index 0
- Output 33 = index 32

## Routing Commands

### `o2o` — SET Route (Primary, Idempotent)

Sets a single crosspoint. Safe to call repeatedly — calling it with an already-set route is a no-op.

```
GET /get_json_cmd.php?cmd=o2o&prm={input0Based},{output0Based}
```

**Response:** JSON array representing the full routing map. Array index = 0-based output, value = 0-based input. Value `65535` = disconnected.

**Example:** Route input 1 to output 33:
```
GET /get_json_cmd.php?cmd=o2o&prm=0,32
Response: [0,2,2,3,4,5,...,0,...] (index 32 = 0 means output 33 ← input 1)
```

### `o2ox` — TOGGLE Route (Legacy, Avoid)

Toggles a crosspoint — if the route is already set, it **disconnects** it.

```
GET /get_json_cmd.php?cmd=o2ox&prm={input0Based},{output0Based}
```

**Danger:** Do NOT use for scheduled or automated routing. If the route is already set, `o2ox` will disconnect it, causing brief audio/video dropout. Use `o2o` instead.

### `o2s` — Set Display State Only

Updates the Wolf Pack web UI display without switching the HDMI crossbar.

```
GET /get_json_cmd.php?cmd=o2s&prm={input0Based},{output0Based}
```

**Warning:** Does NOT actually route anything. Only changes what the web interface shows.

### `o2n` — Disconnect Single Output

Disconnects a single output (sets it to no input).

```
GET /get_json_cmd.php?cmd=o2n&prm={output0Based}
```

### `o2a` — Route One Input to ALL Outputs

Routes a single input to every output on the matrix.

```
GET /get_json_cmd.php?cmd=o2a&prm={input0Based}
```

**Danger:** This overwrites ALL existing routes. Use with extreme caution.

### `a2a` — Route All Inputs 1:1

Sets inputs 0→output 0, 1→output 1, 2→output 2, etc.

```
GET /get_json_cmd.php?cmd=a2a
```

**Danger:** Overwrites ALL existing routes.

### `a2n` — Disconnect ALL Outputs

Disconnects every output on the matrix.

```
GET /get_json_cmd.php?cmd=a2n
```

**Danger:** Disconnects everything. All outputs go dark.

## Scene Management

### Save Scene

```
GET /get_json_cmd.php?cmd=save&prm={sceneId}
```
Scene IDs: 1–40. Scene 0 is the live/current state (read-only).

### Load Scene

```
GET /get_json_cmd.php?cmd=load&prm={sceneId}
```
Restores all routes from the saved scene.

## Read-Only Endpoints

### Get Current Routing State

```
GET /get_json_scene.php?id=0
```

**Response:** JSON array. Array index = 0-based output, value = 0-based input. `65535` = disconnected.

No authentication required for this endpoint.

### Get Saved Scene

```
GET /get_json_scene.php?id={sceneId}
```

### Get Temperature

```
GET /get_json_temp.php
```

Returns board temperature data.

### Get Configuration

```
GET /get_json_config.php
```

Returns matrix configuration (model, firmware version, input/output count, etc.).

## Command Summary Table

| Command | Action | Idempotent | Danger Level |
|---------|--------|------------|--------------|
| `o2o`   | SET single route | Yes | Safe |
| `o2ox`  | TOGGLE single route | No | Medium — can disconnect |
| `o2s`   | Display-only update | Yes | None (no hardware effect) |
| `o2n`   | Disconnect one output | Yes | Low |
| `o2a`   | One input → ALL outputs | Yes | High — overwrites all |
| `a2a`   | 1:1 mapping all | Yes | High — overwrites all |
| `a2n`   | Disconnect ALL | Yes | High — everything goes dark |
| `save`  | Save scene | Yes | None |
| `load`  | Load scene | Yes | High — overwrites all routes |

## Routing Map Format

The routing map returned by commands and `get_json_scene.php` is a JSON array:

```json
[0, 1, 2, 3, 4, 5, ..., 65535, ...]
```

- **Array index** = 0-based output number
- **Value** = 0-based input number routed to that output
- **65535** = output is disconnected (no input)

For a 36x36 matrix, the array has 36 entries. For an 8x8, 8 entries.

## Protocol Notes

- **TCP port 5000** — Switches the HDMI crossbar. Format: `{input1Based}X{output1Based}.\r\n`. Response: `OK.`. No auth. Uses 1-based indices.
- **HTTP port 80** — Provides routing map verification via `o2o` (idempotent SET). Uses 0-based indices.
- **Recommended strategy:** TCP to switch hardware + HTTP `o2o` to verify routing map.
- **UDP port 4000** — Untested, avoid.
- **Previous note (now corrected):** TCP was previously documented as not switching routes. Re-testing in March 2026 confirmed TCP DOES switch the HDMI crossbar. The earlier conclusion was incorrect.
- The `send` command (`GET /get_json_cmd.php?cmd=send&prm={hex}`) can send raw hex commands for advanced control (e.g., Multi-View cards).

## Source

- HDTVSupply Wolf Pack firmware V1.5.1
- Confirmed behavior via packet capture and testing (see git commits `9cb3032`, `c501894`)
- Manufacturer: https://www.hdtvsupply.com/
