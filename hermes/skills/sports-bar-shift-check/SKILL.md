---
name: sports-bar-shift-check
description: "On-demand pre-shift readiness audit: chain the observe tools into a clear go / needs-attention summary for the bar."
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [SportsBar, Shift, Audit, Readiness, Health]
---

# Sports-Bar shift-readiness check

When asked "are we good for the shift?", "pre-game check", "is everything ready?", run a quick audit by
chaining the observe tools, then give one clear readiness line + the specifics. (This is the interactive,
deeper cousin of the automated 7:45 AM morning brief.)

## Workflow
1. `get_system_health` — overall + any device that's offline or has issues. The Epson projector and any
   Atmosphere TV are chronically off when powered down — note them only if asked, don't raise alarm.
2. `get_shure_rf_status` — wireless/paging mics connected + on a clean frequency.
3. `get_atlas_status` — no priority/page event stuck active; no recent unexplained audio drops.
4. `get_firetv_status` — streaming devices online (and which matrix input each feeds).
5. `list_open_todos` — surface any HIGH/CRITICAL open items the operator should know before the rush.

## Output
Lead with **✅ Ready** or **⚠️ N thing(s) to check**, then the specifics. Bartender register: identify
hardware by look + location ("the silver box with the antenna on the top rack"), not model names. If
something's wrong, give the one action or who to call — never a raw command or endpoint.
