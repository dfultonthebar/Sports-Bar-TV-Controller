---
name: sports-bar-troubleshooting
description: "Diagnose live bar problems (wrong/black TV, mic issues, audio drop) by chaining the sports-bar MCP observe tools + search_system_docs."
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [SportsBar, AV, Diagnostics, WolfPack, Atlas, Shure, FireTV]
---

# Sports-Bar troubleshooting

Diagnostic playbooks for a live bar. Each step is a tool call — **observe the real state first, then look
up the fix in the docs, then recommend.** Never assert state you didn't read from a tool. You can't change
hardware yet — recommend the exact step (operator) or the button/person (bartender).

Adapt the answer to register (bartender plain-English vs operator technical) — see SOUL.md.

## "TV is showing the wrong game / is black"
1. `get_system_health` — is the device for that TV offline?
2. `explain_tv_output(N)` (or `get_matrix_routes`) — which input is that TV actually on?
3. If the input is a streaming device: `get_firetv_status` — is that Fire TV online + on the right input?
4. `search_system_docs("how to re-route a TV output" or "Wolf Pack outputOffset")` for the fix — and recall
   the **outputOffset** gotcha (single-card must be 0; wrong offset = silent misroute).
5. Recommend: operator → the route to set; bartender → the on-screen button or "text the manager a photo."

## "The wireless / paging mic isn't working" (NEVER call it karaoke)
1. `get_shure_rf_status` — is the receiver connected? Is the channel on a real frequency?
2. `get_atlas_status` — is a priority/page event active (mic keyed), or is interference being inferred?
3. `search_system_docs("Shure third-party controls gate" / "RF interference", tech="shure")` — the #1
   silent failure is the front-panel "Allow Third-Party Controls" gate; interference may need a frequency change.
4. Recommend accordingly (bartender: "find the silver box with the antenna," not "the SLX-D receiver").

## "Audio dropped / a zone went quiet"
1. `get_atlas_status` — recent zone drop events? priority active?
2. `search_system_docs("Atlas Custom Priority Volume" / "drop watcher", tech="atlas")` — firmware 4.5+
   Custom Priority Volume looks IDENTICAL to a real drop; check that before treating it as a fault.
3. Recommend the zone/level check or escalation.

## "What needs fixing / what's on the list"
- `list_open_todos` — read it back, needs-work first.

## Anything else about HOW the system works
- `search_system_docs(query)` is your reference for the whole system. Quote returned values verbatim;
  never invert "X NOT Y"; if the docs don't cover it, say so.
