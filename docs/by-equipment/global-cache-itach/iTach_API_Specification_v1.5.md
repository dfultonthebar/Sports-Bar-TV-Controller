# Global Caché iTach API Specification

**Source:** Global Caché Inc., "iTach API Specification", Version 1.5
**Source URL:** https://www.globalcache.com/files/docs/API-iTach.pdf
**PN:** 100415-01 ver. 1.5
**Effective:** August 25, 2011
**Captured:** 2026-05-18

This is the **canonical reference** for the `@sports-bar/ir-control` package and any code that opens a TCP socket to a Global Caché iTach IP2IR for cable-box / TV / receiver control.

---

## 1. Hardware Family

The iTach is modular — each unit consists of a module-0 (network + power) module plus optional function modules. Models:

| Model string | Module-0 | Module-1 |
|---|---|---|
| `iTachIP2IR` | Ethernet | 3 IR |
| `iTachWF2IR` | WiFi | 3 IR |
| `iTachIP2SL` | Ethernet | 1 Serial |
| `iTachWF2SL` | WiFi | 1 Serial |
| `iTachIP2CC` | Ethernet | 3 Relay |
| `iTachWF2CC` | WiFi | 3 Relay |

The Sports-Bar Project uses **iTachIP2IR** (Ethernet to 3 IR connectors) for all cable-box / DirecTV / AVR / generic-IR device control.

### Connector addressing

Format: `<module>:<connector>` (e.g. `1:1`, `1:2`, `1:3`).

- **Module** is the physical position in the chassis. The network/power module is module 0. Function modules are numbered left-to-right starting at module 1.
- **Connector** is the connector's position within the module, numbered 1, 2, 3 left to right.
- IR and CC modules accept module numbers 1-3 (IR) or 1-5 (CC) for **GC-100 backward compatibility** — but the physical module is always at 1 in iTach IP2IR units.

**IR Blaster mode** is only available on the **third IR connector** (`*:3`). Attempts to configure other connectors as blasters return an error.

---

## 2. Network

- **IP discovery:** iTach broadcasts a UDP beacon to multicast `239.255.250.250` on port `9131`. Beacon is sent on power up and at random 10-60 second intervals. Beacon content:
  ```
  AMXB<-UUID=GlobalCache_000C1E024239><-SDKClass=Utility>
  <-Make=GlobalCache><-Model=iTachIP2IR><-Revision=710-1001-05>
  <-Pkg_Level=GCPK001><-Config-URL=http://192.168.1.100.><-PCB_PN=025-0026-06>
  <-Status=Ready>
  ```
  UUID embeds the MAC address.

- **Default WiFi adhoc:** `http://169.254.1.70`
- **TCP/IP default:** DHCP

---

## 3. Command Protocol

**Connection:** Open a TCP socket on port **4998**.
**Encoding:** ASCII text, comma-delimited fields, **terminated by carriage return (`\r`, `0x0D`)**.
**Case-sensitive.**

**Serial data** (for IP2SL units) is on port **4999** (module-1 serial), 5000 (module-2 serial), and so on. The Sports-Bar project does not use the SL variant — these notes are present for completeness.

---

## 4. General Commands

### `getdevices` — Enumerate modules

```
→ getdevices\r
← device,0,0 ETHERNET\r
← device,1,3 IR\r
← endlistdevices\r
```

`<moduletype>` values: `WIFI`, `ETHERNET`, `3 RELAY`, `3 IR`, `1 SERIAL`.

### `getversion` — Firmware version

```
→ getversion\r
← <textversionstring>\r
```

Or per-module:
```
→ getversion,1\r
← version,1,<textversionstring>\r
```

### `get_NET` — Network settings

```
→ get_NET,0:1\r
← NET,0:1,<configlock>,<ipsettings>,<ipaddress>,<subnet>,<gateway>\r
```

Where:
- `<configlock>` — `LOCKED` | `UNLOCKED`
- `<ipsettings>` — `DHCP` | `STATIC`

### `unknowncommand` — Generic error response

```
← unknowncommand,<errorcode>\r
```

Sent when the iTach can't parse a command, or when the command is incompatible with the connector's current configuration (e.g. `sendir` to a digital-input connector).

---

## 5. IR Commands

### `set_IR` — Configure IR connector mode

```
→ set_IR,1:3,LED_LIGHTING\r
```

Modes: `IR` | `SENSOR` | `SENSOR_NOTIFY` | `IR_BLASTER` | `LED_LIGHTING`. `IR_BLASTER` is only valid on `*:3`.

### `get_IR` — Query connector mode

```
→ get_IR,1:1\r
← IR,1:1,<mode>\r
```

### `stopir` — Halt in-progress IR transmission

```
→ stopir,1:1\r
← stopir,1:1\r
```

If another IP connection halts your transmission, BOTH the originator AND the stopper get a `stopir` response. The originator does NOT get a `completeir`.

### `busyIR` — Concurrent-IR collision response

```
← busyIR,<connectoraddress>,<ID>\r
```

Sent when an IR command is dispatched while another IR command is already transmitting on the **same connector**. Different connectors can transmit concurrently without conflict.

---

## 6. `sendir` — IR Transmission (THE big one)

This is the canonical IR-frame format. **Memorize this.**

```
sendir,<connectoraddress>,<ID>,<frequency>,<repeat>,<offset>,<on1>,<off1>,<on2>,<off2>,...,<onN>,<offN>\r
```

| Field | Range | Meaning |
|---|---|---|
| `<connectoraddress>` | `1:1`, `1:2`, `1:3` | IR connector to transmit on |
| `<ID>` | `0`-`65535` | Caller-generated ID; echoed in `completeir` response so caller can match completion to its original request |
| `<frequency>` | `15000`-`500000` Hz | IR carrier frequency in Hz. Typical IR equipment is 35-45 kHz. Some up to 500 kHz. |
| `<repeat>` | `1`-`50` | How many times to send. Values >50 are accepted but clamped to 50. Preamble is sent only once (see `<offset>`). |
| `<offset>` | `1`, `3`, `5`, ..., `383` (always odd) | Index within the pair list to start repeats at — used to skip a preamble. `1` = no preamble (start from `<on1>`). `3` = repeats start from `<on2>` (the first pair is preamble). Must be **odd** because each repeat starts with an `<on>` (which is at an odd position). |
| `<on1>`, `<off1>`, ... | `1`-`65635` | Pulse / no-pulse durations measured in **carrier cycles**, NOT microseconds. Each `<on>` and `<off>` must be ≥80μs equivalent (i.e. ≥ `80μs × freq`). At 48 kHz that means values ≥4. There must be an EQUAL number of on and off values; the burst must end on an off. Max total pairs N ≤ 260 (520 numbers). |

### Carrier-cycle unit math

A value's actual duration in seconds = `value / frequency`.

Example: `<off>` = 24, frequency = 40000 Hz → 24/40000 = 600 μs.

This is why learned IR codes carry their `<frequency>` field — without it the carrier-cycle counts are meaningless.

### Compressed format

The first 15 unique `<on>,<off>` pairs in a `sendir` can be referenced by capital letters A-O. The letters appear **inline** (no commas around them):

```
sendir,1:2,2445,40000,1,1,4,5,4,5,8,9,4,5,8,9,8,9\r
  ↓ equivalent to
sendir,1:2,2445,40000,1,1,4,5A8,9ABB\r
```

Where `A = 4,5` and `B = 8,9` (first two unique pairs after the initial pair).

### `completeir` — Successful-transmission acknowledgement

```
← completeir,1:2,2445\r
```

The `<ID>` echoed is the one supplied in `sendir`. Wait for `completeir` before sending the next `sendir` to the same connector, or you'll get `busyIR`.

### Worked examples (from spec)

```
sendir,1:2,2445,40000,1,1,4,5,6,5\r
→ completeir,1:2,2445\r
```

Two equivalent forms of the same 4-repeat command with a `34,48` preamble:
```
sendir,1:2,4444,34500,1,1,34,48,24,12,24,960,24,12,24,960,24,12,24,960,24,12,24,960\r
sendir,1:2,34,34500,4,3,34,48,24,12,24,960\r
```

The second form is **recommended** — shorter, lets `stopir` actually halt the repeats.

### Smooth-continuous (volume) pattern

To do a smooth volume up/down while a button is held:
- Send a **small `<repeat>` count** (e.g. 5) on each button-poll.
- Resend the **identical** command from the **same IP connection** before the previous repeats finish — the iTach resets the repeat counter without restarting the IR command, producing continuous smooth IR.
- When the button is released and no more resend arrives, the IR naturally stops after the last `<repeat>` count finishes — eliminating the need for an explicit `stopir`.
- If the IP connection drops mid-transmission, the IR auto-stops within `<repeat>` cycles — preventing runaway volume.

---

## 7. IR Learning — `get_IRL` / `stop_IRL`

The IR learner is the small hole below and to the right of the power connector.

```
→ get_IRL\r
← IR Learner Enabled\r
```

Once enabled, the iTach captures IR signals at the learner sensor and pushes them back over TCP **as an uncompressed `sendir,...`-format command** (carriage-return terminated) on port 4998. Only the connection that initiated `get_IRL` receives the captured command.

Learner mode is disabled by:
- Sending ANY command (including `stop_IRL` explicitly)
- Sending `stop_IRL`:
  ```
  → stop_IRL\r
  ← IR Learner Disabled\r
  ```

**LED-lighting-configured units cannot learn:**
```
→ get_IRL\r        (on a unit with set_IR ...,LED_LIGHTING)
← IR Learner Unavailable\r
```

**Captured-code format:** The learned signal is delivered as a complete `sendir,1:1,1,<frequency>,1,1,<on1>,<off1>,...\r` string. Store this verbatim in the `IRCommand.irCode` column. At send-time, substitute the leading `1:1` with the actual `<module>:<port>` for the target device — this is what the Sports-Bar `globalCachePortNumber`-substitution code in `apps/web/src/lib/ir-codes-runtime.ts` is doing.

**Capture validation:** A code is complete when it ends with a number (not mid-pair) and has ≥6 fields after `sendir,`. Truncated codes will cause the iTach to return `ERR_2:1,010` (uneven `<on>`/`<off>` count) when later replayed.

---

## 8. Relay Commands (IP2CC only — included for completeness)

### `setstate` — Open/close relay

```
→ setstate,1:1,1\r        (close relay 1)
← state,1:1,1\r
```

`<outputstate>` = `0` (open) or `1` (closed). Relays do **not persist through power cycle** — all default to open on boot.

### `getstate` — Read relay or digital-input state

```
→ getstate,1:1\r
← state,1:1,<inputstate>\r
```

`<inputstate>` = `0` (low / contact-closed) or `1` (high / open / unconnected). Sensor inputs are held high internally so unconnected = `1`.

---

## 9. Serial Commands (IP2SL only)

```
→ set_SERIAL,1:1,<baudrate>,<flowcontrol>,<parity>\r
← SERIAL,1:1,<baudrate>,<flowcontrol>,<parity>\r
```

Baud: `1200`-`115200`. Flow: `FLOW_NONE` | `FLOW_HARDWARE`. Parity: `PARITY_NO` | `PARITY_ODD` | `PARITY_EVEN`.

Serial data itself flows over port **4999** (module-1) / 5000 (module-2) / etc. — completely transparent, no framing, no escaping.

---

## 10. Error Codes — THE FULL TABLE

Errors are returned in the format `ERR_<module>:<connector>,<errcode>` for connector-scoped errors (e.g. `ERR_1:2,010`), or `ERR_<module>:0,<errcode>` for module-scoped errors (e.g. `ERR_0:0,002`).

The 3-digit error code maps to the table below. The Sports-Bar code most commonly sees `ERR_2:1,010` — though note: the leading `2` is the **module address** (which is unusual — the connector lives in module 1 in IP2IR units), suggesting that error came from a unit where the connector was misaddressed OR from a misparsed command. Most production errors at our sites are `1:N,010` from truncated learned codes.

| Code | Meaning |
|---|---|
| `ERR_01` | Invalid command. Command not found. |
| `ERR_02` | Invalid module address (does not exist). |
| `ERR_03` | Invalid connector address (does not exist). |
| `ERR_04` | Invalid ID value. |
| `ERR_05` | Invalid frequency value. |
| `ERR_06` | Invalid repeat value. |
| `ERR_07` | Invalid offset value. |
| `ERR_08` | Invalid pulse count. |
| `ERR_09` | Invalid pulse data. |
| **`ERR_10`** | **Uneven amount of `<on>`/`<off>` statements.** ⚠ This is the truncated-learned-code error — the captured `sendir` was cut off mid-pair and the iTach can't transmit a partial pair. Re-learn the code. |
| `ERR_11` | No carriage return found. |
| `ERR_12` | Repeat count exceeded. |
| `ERR_13` | IR command sent to input connector. |
| `ERR_14` | Blaster command sent to non-blaster connector. |
| `ERR_15` | No carriage return before buffer full. |
| `ERR_16` | No carriage return. |
| `ERR_17` | Bad command syntax. |
| `ERR_18` | Sensor command sent to non-input connector. |
| `ERR_19` | Repeated IR transmission failure. |
| `ERR_20` | Above designated IR `<on>`/`<off>` pair limit (>260 pairs). |
| `ERR_21` | Symbol odd boundary (compressed-format misalignment). |
| `ERR_22` | Undefined symbol (compressed letter not declared). |
| `ERR_23` | Unknown option. |
| `ERR_24` | Invalid baud rate setting. |
| `ERR_25` | Invalid flow control setting. |
| `ERR_26` | Invalid parity setting. |
| `ERR_27` | Settings are locked. |

### Worked example errors from spec

```
sendir,5:3,3456,23400,1,1,24,48,24,960\r       → ERR_0:0,002    (module 5 doesn't exist)
sendir,1:2,23333,40000,2,3,24,48,24,48,960\r  → ERR_1:2,010    (5 values = uneven on/off count)
sendir,1:3,0,40000,2,2,24,48,24,960\r          → ERR_1:3,007    (offset=2 is even, must be odd)
```

---

## 11. Sensor Notify (UDP push)

If an IR connector is set to `SENSOR_NOTIFY` mode, the iTach broadcasts state changes on UDP port **9132** by default. Configurable from the IR web settings page. Packet content:

```
sensornotify,<connectoraddress>:<inputstate>\r
```

Sent on state change AND on a configurable timer interval (10 seconds default; 0 = state-change-only).

---

## 12. LED Lighting Mode (set_LED_LIGHTING)

The third IR connector can be configured as a 120 Hz PWM LED lighting controller.

```
→ set_LED_LIGHTING,<connectoraddress>,<% intensity>,<linear ramp>\r
← LED_LIGHTING,<connectoraddress>,<current %>,<target %>\r
```

- `<% intensity>` — target lighting level (1-100)
- `<linear ramp>` — speed of change, 0 (instant) to 10 (fastest, ~1 sec full sweep). `1` = ~10 sec full sweep.

`get_LED_LIGHTING` returns both current and target intensity. When the unit isn't currently changing intensity, both fields are equal.

**Dedicated LED modes** (Single Input / Dual Input) wire one or two connectors as physical lighting-control sensors that toggle / dim / brighten via momentary or long-press contact closure — see spec §5.4.4 if you ever need this.

---

## 13. Quick Reference — Producing & Sending a Cable-Box IR Code

```
# 1. Learn (one-time, at setup)
→ get_IRL\r
← IR Learner Enabled\r
# (point physical remote at iTach learner hole, press button)
← sendir,1:1,1,37764,1,1,342,171,21,83,21,83,21,21,...\r
→ stop_IRL\r
← IR Learner Disabled\r
# Store the captured `sendir,1:1,1,37764,1,1,...` string in IRCommand.irCode

# 2. Send (every press)
# Substitute 1:1 with target port (e.g. 1:2):
→ sendir,1:2,42,37764,1,1,342,171,21,83,21,83,21,21,...\r
← completeir,1:2,42\r
```

---

## 14. References

- Global Caché iTach API Specification v1.5, PN 100415-01 — primary spec
- Global Caché home: https://www.globalcache.com
- iHelp utility (discovery tool): https://www.globalcache.com/downloads
- Internal package: `packages/ir-control/`
- Sports-Bar IR runtime: `apps/web/src/lib/ir-codes-runtime.ts` (port substitution)
- Sports-Bar IR learning route: `apps/web/src/app/api/ir/learn/route.ts`
- Project CLAUDE.md §5 (cable-box IR-only stance) and §8 (IR learning flow)
