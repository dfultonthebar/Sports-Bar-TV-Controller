# Shure SLX-D Frequency Scan + Handheld Resync — Runbook

**Audience:** Bar operators + AI Hub (this doc is RAG-indexed so the chat can walk you through it)
**Read time:** 5 minutes
**When to run:** before any event with multiple mics, after any RF complaint (dropouts, static, ghost-mic priority firing), or 30 min before doors / 1 hr before kickoff on game day per Shure's pre-event recommendation.

## Quick orientation — what hardware do we actually have

Our system uses **Shure SLX-D** (digital, current product line). NOT to be confused with **Shure SLX** (analog, discontinued). They share a model-name prefix but the scan + sync procedures are completely different:

| | SLX (analog — NOT us) | SLX-D (digital — what we run) |
|---|---|---|
| Encoder/scan UI | Transmitter-side encoder, "Menu" → "Scan" | **Receiver-side** front panel, "Group Scan" / "Channel Scan" |
| Sync direction | TX sets frequency, RX follows | RX picks frequency, IR-syncs TX |
| Network scan | n/a | **Does NOT exist over the wire** — see "Why not just do it remotely" below |

If you find yourself pressing buttons on the handheld TX to start a scan — you're following SLX (analog) instructions. Stop. Read this doc.

## Pre-flight checks

- [ ] All mic handhelds **POWERED OFF**. If a mic is on, the scan sees your own TX as interference and picks a "clean" channel that isn't actually clean.
- [ ] All other RF noise sources at the location **POWERED ON** — TVs, LED walls, kitchen video monitors, Wi-Fi APs. The clean frequency depends on what's actively broadcasting.
- [ ] Receiver **POWERED ON** and reachable (the receiver does the scan; the TX just receives the result via IR sync).
- [ ] Front-panel "Allow Third-Party Controls" gate **ENABLED** if you want to verify results via `/device-config → Audio → Wireless Mics`. Path: Menu → Advanced → Network → Allow Third-Party Controls → Enable. (This is also the gate our software needs — see `packages/shure-slxd/README.md`.)

## Procedure — Group Scan on receiver 1 (the lead receiver)

This is the **canonical Shure-documented pre-event workflow**. Do not deviate; the order matters.

1. **On the receiver's front panel**, press **Menu**.
2. Navigate to **Utilities → Group Scan** (some firmware: **RF → Group Scan**).
3. Press **Enter** to start. The receiver walks every Group in our frequency band (G58 / 514-558 MHz for the US) and counts how many clear channels each Group has.
4. **Wait** — typical scan takes 30-90 seconds depending on RF noise floor. Display shows a progress bar.
5. When complete, the receiver displays the **best Group** (most clear channels) and asks you to **confirm**.
6. Press **Enter** to accept. Receiver 1 is now set to that Group's **Channel 1**.

## Procedure — Channel Scan on additional receivers (rx 2, 3, ...)

For every additional receiver beyond #1:

1. On the receiver's front panel, press **Menu** → **Utilities → Channel Scan**.
2. **Manually set the Group to match receiver 1** (the previous step). You want all receivers in the **same Group** so the pre-calculated intermod-free spacing applies.
3. Press **Enter** to scan. This is a faster scan — only walks channels within the chosen Group.
4. Accept the suggested clear channel. The receiver assigns itself to that channel.

> **Why same Group, different Channel:** Shure's predefined Groups are calculated to be intermod-free WITHIN the group. Mixing groups across receivers introduces 3rd-order intermod products that fall in-band and cause dropouts you can't see in the scan.

## Procedure — IR Sync the handheld TX to the receiver

After the receiver knows its frequency, you have to push that frequency to the handheld:

1. **Power ON the handheld TX** (just for this step — you'll power it back off after).
2. Open the **TX battery compartment** (the IR sensor lives behind it on most SLX-D handhelds — small black dot on the inside).
3. Hold the **TX's IR window within ~6 inches of the receiver's front-panel IR sensor**. The receiver's IR sensor is the small lens between the channel display and the buttons.
4. On the receiver, press **Sync**.
5. Receiver sends frequency + channel name + encryption key to the TX over IR. **Takes about 1 second.**
6. TX display flashes a confirmation (varies by firmware — usually a quick "OK" or the new frequency appearing).
7. Power the TX off again, close the battery compartment.

Repeat for each handheld.

## Procedure — Verify in software

After all syncs are done:

```bash
# Confirm receiver state from the network side
curl http://localhost:3001/api/shure-rf/status \
  | python3 -m json.tool
```

You should see each channel reporting its new frequency + a `TX_MODEL` value once the handheld is back on the same channel as the receiver. If `TX_MODEL` shows `UNKNOWN` for a channel you just synced, the sync didn't take — repeat the IR sync step.

In the UI: open the bartender remote → Audio tab → look for the cyan **ShureMicStatusPanel** tile. It updates every 3 seconds with battery + RSSI + frequency per channel.

## Why we cannot just do this from the network

The SLX-D firmware (verified 1.4.7.0 on Holmgren receiver 2026-05-18) **does NOT expose Group Scan, Channel Scan, Frequency Scan, or any spectrum sweep command over TCP 2202**. We probed 16 candidate command variants live and all returned `< REP ERR >`. Shure's official "SLX-D Command Strings v2 (2020-G)" spec confirms — no SCAN/SWEEP/SPECTRUM verbs exist as GET/SET/REP. The Shure KB article ["SLX-D Scan function recommended method"](https://service.shure.com/s/article/scan-function-recommended-method) explicitly says front-panel only.

What we DO have as software workarounds:
- **`POST /api/shure-rf/find-clean-freq`** (v2.40.0+) — software-side candidate-frequency picker. Maintains a list of known-good frequencies based on observed SDR carriers + Shure history. Does NOT do a live scan; suggests the next clean frequency from the maintained list.
- **`POST /api/shure-rf/pattern-digest`** — Ollama-driven analysis of the last 30 days of RF events to recommend coordinated frequencies for your specific RF environment.

These are SUPPLEMENTS, not replacements. The receiver's front-panel scan is still the authoritative source on game day.

## Mid-event mitigation playbook (< 60 sec)

If a mic drops during the event:

1. **Battery check FIRST.** Look at the TX battery LED before assuming RF. If the LED is amber/red, swap batteries — that's the fastest fix.
2. **Swap to backup mic** if a paired backup is on standby.
3. **Receiver front panel → Utilities → Channel Scan** → picks the next clear channel in the same Group.
4. **IR Sync TX to the new channel** (battery compartment, hold near receiver IR sensor, press Sync).
5. Resume the event.

Total ~60 seconds if you've practiced it.

## Lambeau / Green Bay-specific gotcha

ENG (Electronic News Gathering) trucks at Packers games run **Part 74 licensed wireless at 250 mW** — that's **5× our Part 15 50 mW**. They are coordinated by the NFL GDC, the coordinated frequency list is NOT public, and they can stomp on any frequency we picked an hour earlier. Mitigation: **rescan-on-kickoff with TVs on**.

If RF interference becomes a recurring problem during home games, the formal path is SBE (Society of Broadcast Engineers) local frequency coordination — they can negotiate a protected window with the GDC.

## Cross-references

- `packages/shure-slxd/README.md` — full SME briefing including protocol-level details
- `CLAUDE.md` §7a — Shure SLX-D architecture + protocol gotchas
- `docs/OPERATIONS_RECOVERY_PLAYBOOK.md` §7 — Shure-specific troubleshooting
- `apps/web/src/lib/shure-rf-watcher.ts` — the RF event watcher
- Shure KB: [SLX-D Scan function recommended method](https://service.shure.com/s/article/scan-function-recommended-method)
- Shure spec: SLX-D Command Strings v2 (2020-G) — internal copy in `docs/by-equipment/shure/`

## Common operator mistakes (the AI Hub should NOT make these)

- **Pressing buttons on the handheld TX to scan.** SLX-D scans on the receiver, not the TX. If the chat tells you to press "Menu" on the TX and use the encoder, it's hallucinating SLX (analog) procedures. STOP and re-read this doc.
- **Forgetting to power OFF mics before scanning.** The scan sees your own TX as the strongest "interference" and picks a clean frequency that's actually crowded.
- **Mixing Groups across receivers.** Causes intermod artifacts. Always same Group, different Channels.
- **Skipping IR Sync.** The receiver knows the new frequency; the TX doesn't until you sync. The dropout you're hearing is the TX still on the old frequency.
- **Trying to scan over the network.** The firmware doesn't support it. Period. There is no curl command, no API endpoint, no WWB6 trick that exposes this on SLX-D. Front panel or bust.
