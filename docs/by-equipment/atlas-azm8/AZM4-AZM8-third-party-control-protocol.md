# AtlasIED Atmosphere AZM4 / AZM8 — Third-Party Control Protocol

**Source:** https://www.atlasied.com/ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf
**Document:** Instruction Manual for Third Party Control
**Revision:** ATS006993 RevB, 4/22 (©2022 Atlas Sound LP)
**Applies to:** AZM4, AZM8 (and by extension AZMP4, AZMP8, AZM4-D, AZM8-D, AZMP4-D, AZMP8-D, AZMP8-DW — same firmware platform per release notes)

---

## 1. Introduction

The Atmosphere AZM4/AZM8 can be controlled by a third party using TCP communication along with UDP for metering. Third party parameter names are **dynamically assigned** during configuration of the AZM4/AZM8.

> Refer to the **Third Party Control Message Table** in the User Interface under
> **Settings → Third Party Control → Message Table** for a message formatting diagram and a listing of all active third-party parameter names. Messages can also be constructed in the **Message Builder Tab** on the Third Party Control page.

**Note:** It is recommended that programming of third-party controllers is completed **after** configuration of the AZM4/AZM8 system is finalized. Removing (and possibly adding) Zones, Sources, Mixes, Groups, Messages, etc. from the setup has the potential to **reassign third party parameter names**.

---

## 2. TCP / UDP Overview

| Direction | Port | Protocol | Purpose |
|---|---|---|---|
| Bidirectional | **5321 / TCP** | TCP | Modifying parameter values, subscribing, unsubscribing. Subscription updates for all parameters **aside from meters** are sent back over this TCP port. |
| AZM → client | **3131 / UDP** | UDP | AZM4/AZM8 sends subscription updates **for meters** on this port. |

- When the TCP connection is terminated by the client or AZM4/AZM8, **all subscriptions for the disconnected client will be lost** and resubscribing in the next session will be required to receive updates for any parameters of interest.
- Inactivity on an open TCP or UDP port may eventually cause the connection to be terminated by the AZM4/AZM8. To avoid this, it is advised to **send a keep-alive message at least once every 5 minutes**. Responses to the keep-alive message are delivered via both TCP and UDP.

**Keep-alive message example:**

```json
{"jsonrpc":"2.0","method":"get","params":{"param":"KeepAlive","fmt":"str"}}
{"jsonrpc":"2.0","method":"getResp","params":[{"param":"KeepAlive","str":"OK"}]}     // TCP Response
{"jsonrpc":"2.0","method":"getResp","params":[{"param":"KeepAlive","str":"OK"}]}     // UDP Response
```

---

## 3. Message Types and Syntax

**All messages sent to the AZM4/AZM8 must be newline delimited**, i.e., `\n` as the last character of the message.

| Method (client → AZM) | Purpose |
|---|---|
| `set` | Set the value of a parameter |
| `bmp` | Bump (increment/decrement) a parameter by a relative value |
| `sub` | Subscribe to a parameter — receive `update` messages when it changes |
| `unsub` | Unsubscribe from a parameter |
| `get` | Get the current value once (no subscription) |

| Method (AZM → client) | Purpose |
|---|---|
| `update` | Subscription value change push |
| `getResp` | Response to a `get` query |
| `error` | Error response |

### 3.1 Set, Bump, Update, Get-Response
Messages that use the `set`, `bmp`, `update`, and `getResp` methods share the same format and have interchangeable parts.

### 3.2 Subscribe, Unsubscribe, Get
Messages that use the `sub`, `unsub`, and `get` methods share the same format and have interchangeable parts. The `get` method can be used to find the current value of a parameter at the instance in time when the message is sent; however, it is recommended that parameters are **subscribed** in order to maintain synchronization.

### 3.3 Multiple Parameters in a Single Message (Arrays)

Multiple parameters can be included in any message by building an array for `params` using square brackets.

```json
{"jsonrpc":"2.0","method":"set","params":[{"param":"ZoneGain_0","pct":50},{"param":"ZoneGain_1","val":-20}]}
{"jsonrpc":"2.0","method":"bmp","params":[{"param":"SourceGain_0","val":-1},{"param":"SourceGain_1","val":2}]}
{"jsonrpc":"2.0","method":"sub","params":[{"param":"SourceMeter_0","fmt":"val"},{"param":"SourceMeter_1","fmt":"val"},{"param":"SourceMeter_2","fmt":"val"},{"param":"SourceMeter_3","fmt":"val"},{"param":"SourceMeter_4","fmt":"val"}]}
{"jsonrpc":"2.0","method":"unsub","params":[{"param":"SourceMeter_3","fmt":"val"},{"param":"SourceMeter_4","fmt":"val"}]}
```

(All examples terminate with `\n`.)

### 3.4 Response when using `id`

Some messages do not generate a response from the third-party server. For example, a message using the `unsub` method or messages that use the `set` and `bmp` when the parameter being modified is not subscribed. However, a response **can be generated if desired by appending an `id` to the end of the message.**

**With `id`:**
```
Sent ->     {"jsonrpc":"2.0","method":"unsub","params":{"param":"GpoPresetName_0","val":"str"},"id":10}
Received -> {"jsonrpc":"2.0","result":"OK","id":10}
```

**Without `id`:**
```
Sent ->     {"jsonrpc":"2.0","method":"unsub","params":{"param":"GpoPresetName_0","val":"str"}}
Nothing Received
```

---

## 4. Parameters with Special Handling

- **Name parameters** (`SourceName`, `ZoneName`, `MixName`, etc.) **cannot be `set` by a third-party client.** Only `sub`, `unsub`, and `get` are valid.
- **`GroupActive`** can be `set` to Activate (Combine) or Deactivate (Uncombine) Zones, equivalent to the Combine buttons in the Groups section of the Zones tab in the GUI. It can also be subscribed to learn the current Combine state.
- **`ZoneActive`** can be subscribed and indicates when a Zone is included in a Group; however, it **cannot be set** by a third-party client.
- **Action parameters** (`PlayMessage`, `RecallScene`, `RecallRoutine`, `RecallGpoPreset`) trigger the associated action when included in a properly formatted `set` or `bmp` message; however, the value of these parameters does not represent the action state. These parameters are not really meant for subscription, but if the parameter is subscribed in a session, an `update` will be received when the parameter is acted upon — receiving an update after the initial subscription indicates the action has been triggered.

---

## 5. Third Party Control Message Table

The **Third Party Control Message Table** in the User Interface (**Settings → Third Party Controller → Message Table**) shows how third-party parameter names correspond to parameters in the AZM4/AZM8's configuration.

To find the name of a third-party parameter:

1. Look in the **Names** column to find the Source, Zone, Group, etc. of interest. (This column shows names that were assigned during the setup of the AZM4/AZM8.)
2. Follow the row over to the parameter attribute of interest (Gain, Mute, etc.).
3. Note the third party param name in the row/column intersection.

**Example:** To send a message to mute the source called "Big Mic" in the AZM4/AZM8, follow the "Big Mic" row (in the Sources section) to the "Mute" column to find the third party param name `SourceMute_2`. Then construct the desired message:

```json
{"jsonrpc":"2.0","method":"set","params":{"param":"SourceMute_2","val":1}}
```

**Note:** The Third Party Message Table is **dynamic** and will update according to the current AZM4/AZM8 settings.

---

## 6. Parameter List

General parameter names (without the underscore and index) are shown with their ranges in the table below. The actual third-party parameter name appends an underscore + zero-based index (e.g. `SourceMute_2`, `ZoneGain_0`, `ZoneSource_3`). The `fmt` field in subscribe/get messages selects `val` (engineering units — dB) or `pct` (0-100 percentage) where both are available, and `str` for string-typed parameters.

| Parameter | Min Val | Max Val | Min Pct | Max Pct | Sub via TCP | Sub via UDP | Read Only |
|---|---|---|---|---|---|---|---|
| `SourceGain`           | -80 dB | 0 dB  | 0 | 100 | X | | |
| `SourceMeter`          | -80 dB | 0 dB  | 0 | 100 |   | X | X |
| `SourceMute`           | 0      | 1     | 0 | 100 | X | | |
| `SourceName`           | N/A    | N/A   | N/A | N/A | X | | X |
| `MixGain`              | -80 dB | 0 dB  | 0 | 100 | X | | |
| `MixMeter`             | -80 dB | 0 dB  | 0 | 100 |   | X | X |
| `MixMute`              | 0      | 1     | 0 | 10  | X | | |
| `MixName`              | N/A    | N/A   | N/A | N/A | X | | X |
| `ZoneGain`             | -80 dB | 0 dB  | 0 | 100 | X | | |
| `ZoneMeter`            | -80 dB | 0 dB  | 0 | 100 |   | X | X |
| `ZoneMute`             | 0      | 1     | 0 | 100 | X | | |
| `ZoneName`             | N/A    | N/A   | N/A | N/A | X | | X |
| `ZoneSource`           | -1     | Num Sources (use number after underscore in `SourceName`) | N/A | N/A | X | | |
| `ZoneGrouped`          | 0      | 1     | 0 | 100 | X | | X |
| `GroupGain`            | -80 dB | 0 dB  | 0 | 100 | X | | |
| `GroupMeter`           | -80 dB | 0 dB  | 0 | 100 |   | X | X |
| `GroupMute`            | 0      | 1     | 0 | 100 | X | | |
| `GroupName`            | N/A    | N/A   | N/A | N/A | X | | X |
| `GroupSource`          | -1     | Num Sources (use number after underscore in `SourceName`) | N/A | N/A | X | | |
| `GroupActive`          | 0      | 1     | 0 | 100 | X | | |
| `MessageName`          | N/A    | N/A   | N/A | N/A | X | | X |
| `PlayMessage`          | N/A    | N/A   | N/A | N/A | X | | |
| `RoutineName`          | N/A    | N/A   | N/A | N/A | X | | X |
| `RecallRoutine`        | N/A    | N/A   | N/A | N/A | X | | |
| `SceneName`            | N/A    | N/A   | N/A | N/A | X | | X |
| `RecallScene`          | N/A    | N/A   | N/A | N/A | X | | |
| `GpoPresetName`        | N/A    | N/A   | N/A | N/A | X | | X |
| `RecallGpoPreset`      | N/A    | N/A   | N/A | N/A | X | | |
| `BellScheduleName`     | N/A    | N/A   | N/A | N/A | X | | X |
| `TodaysBellSchedule`   | 0      | Num Bell Schedules (use number after underscore in `BellScheduleName`) | N/A | N/A | X | | |
| `LoudNoise`            | 0      | 1     | 0 | 100 | X | | X |
| `GpoState`             | 0      | 1     | 0 | 100 | X | | X |
| `FirmwareVersion`      | N/A    | N/A   | N/A | N/A | X | | X |

Notes:
- All gain / meter values are in **dB** when using `"fmt":"val"`. Range is `-80 .. 0` dB (no positive — `0` is unity, more negative is more attenuation).
- Mute is `0` (unmuted) or `1` (muted).
- `ZoneSource` and `GroupSource` use `-1` for "no source" / "OFF" and otherwise the zero-based index into the configured sources list.
- Meters (`SourceMeter`, `MixMeter`, `ZoneMeter`, `GroupMeter`) are **UDP-pushed** when subscribed. All other parameters update over TCP.
- Read-only parameters (right column X) accept `sub` / `unsub` / `get` but not `set` / `bmp`.

---

## 7. Implementation Notes for This Codebase

(Not from the spec — local cross-reference for Sports Bar TV Controller.)

- Our `packages/atlas` `ExtendedAtlasClient` opens **one persistent TCP socket on 5321** plus **one UDP listener on 3131** per processor. Hoisted to `globalThis` via `atlasClientManager` singleton (CLAUDE.md Gotcha #10) so all Next.js route bundles share the same client.
- Newline-terminate every JSON-RPC frame (`\n`).
- Send keep-alive `< get KeepAlive >` < 5 min to keep TCP / UDP alive (per §2 above).
- Subscribe to `SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` with `"fmt":"val"` to get dB-units pushed over UDP for the meter manager.
- For "priority active" detection there is **no `PriorityActive` parameter** — see CLAUDE.md §7 / memory note `feedback_atlas_azm8_no_priority_param.md`. Infer from `SourceMeter_N` crossing a mic-input threshold + `ZoneSource_N` changing unexpectedly.
- `RecallScene_N` triggers a Scene (e.g. our Scene 1 failsafe-mode recovery for dbx ZonePRO). `set` writes any value — value is ignored, the action fires.
