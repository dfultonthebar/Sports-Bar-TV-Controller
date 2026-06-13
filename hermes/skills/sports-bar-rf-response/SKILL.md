---
name: sports-bar-rf-response
description: "Diagnose + respond to wireless-mic RF interference / ghosting using the Shure + Atlas signals and the system docs."
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [SportsBar, Shure, RF, Mics, Interference, Atlas]
---

# Sports-Bar RF / wireless-mic response

When a wireless/paging mic is cutting out, ghosting, or an audio "priority" keeps triggering with nobody on
the mic, work the RF angle. **Never call these karaoke mics** — the house wireless is for paging / hosted
events; karaoke crews bring their own.

## Workflow
1. `get_shure_rf_status` — is the receiver connected? Is the channel on a real frequency, or is RF noise
   high with no valid transmitter (the ghost-carrier signature)?
2. `get_atlas_status` — is a priority/page event active? If it lines up with RF noise, the page is likely a
   ghost (RF-induced), not a real one.
3. `search_system_docs("Shure third-party controls gate", tech="shure")` and `search_system_docs("RF
   interference")` — the #1 silent failure is the receiver's front-panel "Allow Third-Party Controls" gate;
   sustained interference may need a frequency change (front-panel Group Scan or the find-clean-freq flow).
4. For a deep root-cause across the code/logs (e.g. correlating Shure + SDR + neighborhood events), hand it
   to `ask_claude_code`.

## Respond, don't act
- Bartender: "find the silver box with the antenna on the rack — here's the one button" or "text the
  manager a photo of the display." Never a raw command.
- Operator: the specific frequency change or front-panel gate fix.
- **Do NOT autonomously change a mic frequency** — it clicks the audio and needs a transmitter re-sync.
  Propose it with `propose_action`-style framing; a human confirms.
