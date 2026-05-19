# Lutron Telnet Integration Protocol (RadioRA 2, Homeworks QS)

**Source URLs:**
- https://assets.lutron.com/a/documents/040249.pdf (Lutron Integration Protocol — Application Note 040249; binary PDF, content reconstructed from public summaries in HA integration source + open-source clients)
- https://github.com/thecynic/pylutron (RadioRA 2 Python client — primary public reference for the telnet protocol)
- https://en.wikipedia.org/wiki/Lutron_Electronics_Company

**Fetched:** 2026-05-18 (PDF binary not parseable by WebFetch — protocol commands captured from reverse-engineered open-source clients that interoperate with real RadioRA 2 / Homeworks QS hardware)

---

## What This Is

The original Lutron integration protocol, predating LEAP. ASCII commands over **telnet (TCP port 23)** to the system's main repeater/processor. Still the only integration path for:

- **RadioRA 2** — main repeater RR-MAIN-REP-WH or RRK-MAIN-REP-WH
- **Homeworks QS** — network bridge QSE-CI-NWK-E

(Newer systems — Caseta, RA3, QSX — use LEAP on TLS 8081 instead. See `lutron-leap-protocol.md`.)

## Transport

| Parameter | Value |
|-----------|-------|
| Port | **23/TCP (telnet)** |
| Encoding | ASCII, `\r\n` line terminator |
| Auth | Username/password prompt at connect (defaults `lutron` / `integration`) |
| Encryption | **None** — cleartext, LAN-only |

Connection flow:

```
> telnet 192.168.1.50 23
login: lutron
password: integration
GNET>           ← prompt indicates ready
```

After login the prompt is `GNET>` (RadioRA 2) or similar. Commands are typed/sent followed by `\r\n`.

## Command Syntax

```
<OP><RESOURCE>,<ID>,<ACTION>,<PARAM1>,<PARAM2>,...
```

### Operations

| Prefix | Meaning |
|--------|---------|
| `#` | **Execute** (set/control) |
| `?` | **Query** (read current value) |
| `~` | **Monitor / unsolicited update** (sent FROM the repeater when state changes) |

### Resources

| Resource | Targets |
|----------|---------|
| `OUTPUT` | Dimmers, switches, fan controls, shades (anything that drives a load) |
| `DEVICE` | Keypads, Pico remotes, sensors (anything that produces input) |
| `MONITORING` | Enable/disable event monitoring for various event types |
| `SHADEGRP` | Shade groups |
| `SYSTEM` | System-level (time, mode) |

## OUTPUT Commands

### Action codes

| Action | Meaning |
|--------|---------|
| 1 | Set level (param: 0-100) |
| 2 | Raise (start) |
| 3 | Lower (start) |
| 4 | Stop (raise/lower) |

### Examples

```
#OUTPUT,5,1,75            Set output 5 to 75%
#OUTPUT,5,1,0             Turn output 5 off
#OUTPUT,5,1,100           Turn output 5 to 100%
#OUTPUT,5,1,50,3          Set output 5 to 50% over 3 seconds (fade time)
#OUTPUT,5,2               Start raising output 5
#OUTPUT,5,4               Stop the raise/lower
?OUTPUT,5,1               Query level of output 5
```

Response to `?OUTPUT,5,1`:

```
~OUTPUT,5,1,75.00
```

Unsolicited updates use the same `~OUTPUT,...` format whenever the load level changes (whether from integration, keypad press, or app).

## DEVICE Commands (Keypads, Picos)

```
#DEVICE,<integration-id>,<component-number>,<action>
```

### Action codes for keypad/Pico buttons

| Action | Meaning |
|--------|---------|
| 3 | Press |
| 4 | Release |
| 5 | Hold |
| 6 | Multi-tap |

### Example: trigger a keypad scene

```
#DEVICE,1,3,3            Press button 3 on keypad 1
#DEVICE,1,3,4            Release button 3 on keypad 1
```

(Pico remotes are typically input-only — you subscribe to their events via `~DEVICE,...` notifications and never send `#DEVICE` to them.)

### Subscribing to button events

```
#MONITORING,5,1          Enable button monitoring
```

Then incoming events look like:

```
~DEVICE,14,2,3           Device 14 (Pico), button 2, action 3 (press)
~DEVICE,14,2,4           Device 14 (Pico), button 2, action 4 (release)
```

## Integration IDs

Every device, output, and component has a numeric **Integration ID** assigned in the **Lutron Integration Report** — a PDF or XML exported from the Lutron programming software (RadioRA 2 Essentials/Inclusive or Homeworks QS Designer). Without the report, the IDs are opaque.

The integration report is the **canonical name→ID mapping** and must be kept in sync with any custom integration code. Re-export and re-import on every database change in the Lutron programming software.

## Common Pitfalls

1. **Cleartext telnet.** Anyone on the LAN can read every command and even sniff the login password. Keep the lighting network on a segregated VLAN.
2. **Connection limit.** RA2 main repeaters historically allowed **5 simultaneous telnet sessions** (some firmware caps at 3). Each integration counts as one — connection leaks block all future control.
3. **No connection-keepalive in the protocol.** Send a harmless `?SYSTEM,1` every 60s to keep the session alive and detect dropped sockets.
4. **Default credentials.** `lutron`/`integration` is set at the factory and rarely changed. This is fine on a segregated VLAN but should not be relied on for security.
5. **No discovery.** The repeater won't tell you what outputs/devices exist — you MUST have the Integration Report.
6. **Fade time is OPTIONAL fifth parameter.** `#OUTPUT,5,1,75` is instant; `#OUTPUT,5,1,75,3` fades over 3 seconds. Forgetting the fade param leads to jarring instant transitions.
7. **Level is 0-100, NOT 0-255.** Same as LEAP — Lutron handles the dimmer curve internally.

## LEAP vs Telnet — Pick Based on Hardware

| If your hardware is... | Use... |
|------------------------|--------|
| Caseta Smart Bridge / Pro | LEAP (TLS 8081) |
| RA2 Select repeater | LEAP (TLS 8081) |
| RadioRA 2 main repeater | **Telnet (port 23)** |
| RadioRA 3 processor | LEAP (TLS 8081) |
| Homeworks QS (NWK-E) | **Telnet (port 23)** |
| Homeworks QSX processor | LEAP (TLS 8081) |

The two protocols are **mutually exclusive** — there is no Lutron hardware that exposes both. Identify the model first, then pick the protocol.

## References

- pylutron (RadioRA 2 client): https://github.com/thecynic/pylutron
- Home Assistant `lutron` integration (telnet): https://github.com/home-assistant/core/tree/dev/homeassistant/components/lutron
- Modern LEAP path: `docs/by-equipment/lutron/lutron-leap-protocol.md`
