# DirecTV SHEF (Set-top box HTTP Exported Functionality) API

**Canonical spec:** DIRECTV SHEF Command Set, DTV-MD-0359 (Rev. 1.3.C)
**Companion file:** `DIRECTV_INTEGRATION.pdf` (in this directory) — sales/integration overview
**Source URLs:**
- Spec mirror: <https://github.com/mikecarlton/directv-control/blob/master/DTV-MD-0359-DIRECTV_SHEF_Command_Set-V1.3.C.pdf>
- JS wrapper docs: <https://whitlockjc.github.io/directv-remote-api/>
- Community notes: <https://wiki.mythtv.org/wiki/Controlling_DirecTV_Set_Top_Box_(STB)_via_Network>
- ControlWorks driver help: <https://store.controlworks.com/product_resources/documentation/DIRECTV_IP_(ControlWorks)_v1.5_Help.pdf>

This document is the canonical text-form reference for the protocol we wrap in `@sports-bar/directv`.

---

## Transport

- **Protocol:** HTTP/1.1, no auth
- **Port:** **TCP 8080** on the Genie HR/HS receiver (gateway). Mini Genie clients (C41/C61) are addressed THROUGH the gateway via the `clientAddr` query parameter — they do not run their own HTTP server on the LAN.
- **Method:** GET for every endpoint (query string only — no POST bodies)
- **Response:** JSON object, content-type `application/json`. Every response carries a `status` block.

### Enabling
The receiver must have **Whole-Home / External Device Access** enabled:
`Menu → Settings & Help → Settings → Whole-Home → External Device → Allow` (older boxes: `Menu → System Setup → Whole-Home → External Device`).
If disabled, port 8080 either closes or replies with `403 FORBIDDEN`.

### Whole-home target selection (`clientAddr`)
Every endpoint accepts an optional `clientAddr` query parameter:

| Value | Target |
|---|---|
| omitted, or `0` | The gateway/server receiver itself |
| 12-char uppercase hex MAC of a client (no colons), e.g. `0017FB1234AB` | That mini Genie client |

`/info/getLocations` enumerates the legal `clientAddr` values for a system.

---

## Common `status` block

Every response includes:

```json
"status": {
  "code": 200,
  "commandResult": 0,
  "msg": "OK.",
  "query": "/the/path?with=params"
}
```

| `status.code` | Meaning |
|---|---|
| 200 | OK |
| 400 | Bad request (missing or malformed query parameter) |
| 403 | Forbidden — External Device Access disabled, OR the receiver is currently in standby/screensaver and the command is one that requires the screen on |
| 404 | Endpoint not found, or `clientAddr` doesn't match a known client |
| 500 | Internal STB error |

`commandResult` is a SHEF-internal status separate from HTTP. `0` means success; non-zero indicates the command was accepted by HTTP but the box rejected it (e.g. tuning to an unsubscribed channel returns `200` HTTP but non-zero `commandResult`).

---

## Endpoints

### `GET /info/getVersion`

Returns receiver software/version and current STB clock.

**Parameters:** none (clientAddr optional)

**Response:**
```json
{
  "accessCardId": "0021-1234-5678",
  "receiverId": "0288 7745 2103",
  "stbSoftwareVersion": "0x4ed70",
  "systemTime": 1700000000,
  "version": "1.2",
  "status": { "code": 200, "msg": "OK.", "query": "/info/getVersion" }
}
```

### `GET /info/getOptions`

Self-describes the SHEF version's available endpoints + parameter set on this firmware. Useful for capability probing across model years.

**Response:** JSON object listing every supported command and its accepted query keys. Shape is firmware-dependent.

### `GET /info/getLocations`

Enumerates known client receivers (the Genie gateway plus every mini Genie). The MAC values returned here are the legal values for `clientAddr` on other endpoints.

**Parameters:**
- `type` (optional, integer) — `1` = clients with video output (typical); higher values include audio-only/server entries.

**Response:**
```json
{
  "locations": [
    { "clientAddr": "0",            "locationName": "Living Room" },
    { "clientAddr": "0017FB1234AB", "locationName": "Bar TV 4"     }
  ],
  "status": { "code": 200, "msg": "OK.", "query": "/info/getLocations" }
}
```

### `GET /info/mode`

Returns power state of the target receiver.

**Response:**
```json
{ "mode": 0, "status": { "code": 200, "msg": "OK." } }
```
`mode`: `0` = active, `1` = standby.

### `GET /tv/getTuned`

Returns what the target receiver is currently watching.

**Response (live TV):**
```json
{
  "callsign": "ESPNHD",
  "date": "20260518",
  "duration": 3600,
  "episodeTitle": "",
  "isOffAir": false,
  "isPclocked": 1,
  "isPpv": false,
  "isRecording": false,
  "isVod": false,
  "major": 206,
  "minor": 65535,
  "offset": 1234,
  "programId": "12345678",
  "rating": "TV-PG",
  "startTime": 1700000000,
  "stationId": 5678,
  "title": "SportsCenter",
  "status": { "code": 200, "msg": "OK." }
}
```

- `major` = channel number visible on screen (e.g. 206)
- `minor` = subchannel; `65535` = no subchannel (standard for DirecTV satellite)
- `callsign` = network identifier (the key field for matching against ESPN broadcast network strings — see `network-channel-resolver.ts`)
- `isOffAir` = `true` only for OTA antenna inputs (irrelevant to bar deployments)

### `GET /tv/tune`

Tunes to a channel.

**Parameters (all on query string):**
| Name | Required | Notes |
|---|---|---|
| `major` | yes | Channel number, e.g. `206` |
| `minor` | no | Subchannel; omit or pass `65535` for satellite |
| `clientAddr` | no | Target a specific client |

`GET /tv/tune?major=206` → channel 206 ESPN on the gateway.

**Response:** standard `status` block. Non-zero `commandResult` for unsubscribed/locked channels.

### `GET /tv/tuneNext` / `GET /tv/tunePrevious`

Channel up / channel down on the target client. No parameters beyond `clientAddr`.

### `GET /remote/processKey`

Simulates an IR remote key press.

**Parameters:**
| Name | Required | Notes |
|---|---|---|
| `key` | yes | Key name (table below) |
| `hold` | no | `keyPress` (default), `keyDown`, `keyUp` |
| `clientAddr` | no | Target a specific client |

**Recognized `key` values (from SHEF spec):**

| Group | Keys |
|---|---|
| Power | `power`, `poweron`, `poweroff` |
| Navigation | `up`, `down`, `left`, `right`, `select`, `back`, `menu`, `exit`, `info`, `guide`, `list`, `active`, `dash`, `enter` |
| Color | `red`, `green`, `yellow`, `blue` |
| Numeric | `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9` |
| Transport | `play`, `pause`, `stop`, `rew`, `replay`, `ffwd`, `advance`, `record` |
| Tune | `chanup`, `chandown`, `prev` |
| Other | `format`, `tvpower`, `tvinput` |

Note: there is **no `volup`/`voldown`/`mute` over SHEF** — DirecTV receivers do not control TV volume themselves (the AVR/TV does). Bar deployments handle audio via the Atlas/dbx/BSS DSP.

### `GET /serial/processCommand`

Sends a raw legacy serial command in hex over the IP transport. Used for commands not exposed elsewhere (legacy parental-control, diagnostic). Avoid in new code — prefer `/tv/tune` and `/remote/processKey`.

**Parameters:**
- `cmd` (required) — hex string with no `0x` prefix, e.g. `FA81` for "get current channel"

**Response:** `{ "data": "<hex_response>", "status": {...} }`

### Other endpoints (less common, listed for completeness)

| Path | Purpose |
|---|---|
| `GET /dvr/getPlayList` | List recordings on the DVR |
| `GET /dvr/getCmdResult` | Get result of an async DVR command |
| `GET /tv/playRecording` | Play a recording by `recordingId` |
| `GET /tv/showVideoCenter` | Open the Smart Search / VOD home |

---

## Behaviour gotchas

1. **Standby/screensaver returns 403 on tune.** When the receiver is in screensaver mode, `/tv/tune` and many `/remote/processKey` calls reply 403. Send `key=poweron` first (it's idempotent — already-on receivers ignore it) and retry the tune after ~500 ms. Our `@sports-bar/directv` package wraps this.
2. **`tunePrevious` is the previous channel ("flip"), not channel-down.** Use `chandown` for sequential channel decrement.
3. **No native event push.** SHEF is poll-only. Channel-change detection is done by `/tv/getTuned` polling.
4. **Multiple HTTP requests in parallel** to the same receiver can confuse it — serialize via the command-queue pattern (see `apps/web/src/lib/directv-device-loader.ts` consumers).
5. **`major` channel range:** 1–9999. Off-air channels (when an antenna is connected) use `major` 1-99 with non-zero `minor`. Satellite uses `minor=65535`.
6. **No HTTPS.** Plain HTTP only; don't add `https://` to the URL.

---

## Reference implementations consulted

- `whitlockjc/directv-remote-api` (Node) — <https://github.com/whitlockjc/directv-remote-api>
- `mikecarlton/directv-control` (Python) — <https://github.com/mikecarlton/directv-control>
- Crestron `DIRECTV_IP` SIMPL module (ControlWorks v1.5)
