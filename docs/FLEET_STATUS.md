# Fleet Status

**Last updated:** 2026-05-08 (NFHS bartender title fix v2.32.88 — Varsity vs JV games of the same matchup are now visually distinguishable; full fleet at v2.32.88, all 6 boxes verified PASS 7/7)

A snapshot of where each location stands. Update this file after every fleet-wide change so future operators (and Claude) have a single place to see the truth.

---

## Per-location summary

| Location | Branch | OS | Software ver | Bartender proxy | AI Suggest backend | iGPU acceleration | Notes |
|---|---|---|---|---|---|---|---|
| holmgren-way | `location/holmgren-way` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | Reference deployment; first to receive drift-recovery fix |
| graystone | `location/graystone` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| greenville | `location/stoneyard-greenville` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | OS upgraded 2026-05-08; AI Suggest 119s on iGPU. |
| leglamp | `location/leg-lamp` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| lucky-s-1313 | `location/lucky-s-1313` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| stoneyard-appleton | `location/stoneyard-appleton` | noble (24.04) | **v2.32.88** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | AI Suggest 67.3s on iGPU (fleet best) |

**Aggregate health (2026-05-08 18:00 UTC):**
- 6/6: bartender remote on Nginx ✓
- 6/6: noble (24.04) + 6.8.0-111 kernel ✓
- 6/6: latest software (v2.32.88) ✓
- 6/6: iGPU acceleration active ✓
- 6/6: drift-recovery sidecar bootstrapped at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json` ✓

**AI Suggest cold-run timings on iGPU (llama3.1:8b):** appleton 67s (fleet best) · greenville 119s · graystone 170s · holmgren ~100s · leglamp ~100s · lucky-s ~100s. Variance correlates with thermals + concurrent load, not procedure.

**Drift-recovery (v2.32.81 + v2.32.82):** auto-update.sh now detects when a box has been left on `main` (rather than its `location/*` branch) by an interactive Claude or operator session, and switches back automatically using the canonical branch name from a sidecar heartbeat at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json`. The sidecar is self-maintaining — every successful run refreshes it. Pre-fix, a drifted box's cron silently no-op'd every night ("origin/main already merged into HEAD" because origin/main IS HEAD on a main checkout) and the location went stale. Holmgren hit this on 2026-05-07/08 and missed v2.32.76-.80 for ~10h before a manual fleet-status check caught it. See `docs/VERSION_SETUP_GUIDE.md` for the full v2.32.81/.82 entries.

---

## Hardware inventory

| Location | CPU | iGPU | RAM | Notable | Replacement queue |
|---|---|---|---|---|---|
| holmgren-way | i9-13900HK | Iris Xe | 32 GB | – | Fire TVs at 10.11.3.48 + .49 (failing — see `project_holmgren_firecube_replacement.md`) |
| graystone | i5-1340P | Iris Xe (a7a0) | 16 GB | Smaller box | – |
| greenville | i9-13900HK | Iris Xe (a7a0) | 32 GB | – | – |
| leglamp | i9-13900HK | Iris Xe | 32 GB | – | – |
| lucky-s-1313 | i9-13900HK | Iris Xe | 32 GB | Audio via dbx ZonePRO 1260m @ 192.168.10.50 | – |
| stoneyard-appleton | i9-13900HK | Iris Xe (a7a0) | 32 GB | – | – |

Audio processor and matrix details live in each location's `.claude/locations/<branch>.md` file.

---

## What shipped 2026-05-08

**v2.32.84** — Prime Video Watch button → autoplay PlayerActivity (5-DPAD search→DOWN→CENTER→CENTER sequence). Verified live on Cube 3 (state=3 PLAYING).

**v2.32.85** — ESPN autoplay (LEANBACK_LAUNCHER + DPAD_DOWN→CENTER) + Schedule deep-link pipe end-to-end (new `deep_link` column on `input_source_allocations`; bartender-schedule POST captures, scheduler-service forwards, channel-presets/tune executes). Verified live on Cube 3.

**v2.32.86** — NFHS catalog cleanup. Cleared the broken `nfhs://event/` deepLinkFormat (the `com.playon.nfhslive` package registers no external scheme) and set `deepLinkSupport: false`. NFHS Watch still opens the app — falls through to launcher-only path. Per-Cube one-time operator action: sign in via TV remote.

**v2.32.87** — Watch button input-label instant update. `/api/streaming/launch` mirrors the launched app's friendly name into `inputCurrentChannels` immediately after launch (was previously waiting for the 5-min `/api/firetv-devices/[id]/current-app` poll). Verified live: <1s vs the previous 5min.

**v2.32.88** — NFHS bartender title shows sport label. Pulaski vs West De Pere had two real games (Varsity Girls Soccer + JV Girls Soccer, 2h apart) that rendered with identical titles in the bartender remote. Channel-guide route was already populating `sport` on NFHS programs; the GameListing TS interface in `EnhancedChannelGuideBartenderRemote.tsx` simply didn't declare the field. Fix: add `sport?: string` and append ` — ${game.sport}` to the title when present. Verified live via the channel-guide POST endpoint: two distinct rows now carry `sport='Junior Varsity Girls Soccer'` / `sport='varsity Girls Soccer'`.

**v2.32.81** — auto-update branch-drift recovery — detects when a box is on `main` instead of its `location/*` branch and switches back via the heartbeat file. Single defensive guard, normal-path code unchanged.

**v2.32.82** — drift-recovery sidecar — first live test of v2.32.81 revealed the heartbeat file is per-branch (tracked on `location/*`, missing on `main`), so it disappears exactly when drift-recovery needs it. Fix: also write the heartbeat to a sidecar at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json` (gitignored, persists across branch switches). Drift-recovery reads sidecar first, falls back to repo-local. Self-maintaining — every successful run refreshes the sidecar.

Verified live on Holmgren: drift simulated → switched to `location/holmgren-way` → merged main → built → restarted PM2 → verify-install 7/7 PASS → pushed → SUCCESS in 105s. Then triggered the other 5 boxes via parallel SSH; all 5 landed at v2.32.82 with sidecars populated, no Anthropic API rate-limit collisions (single-host coordinated trigger, not cron herd).

---

## What shipped 2026-05-07

15 versions in roughly 6 hours. All on `main`, all merged into every location branch.

### Bartender / UX fixes (v2.32.55 – v2.32.58)

- **v2.32.55** — Wolf Pack `sendHTTPCommand` pre-check ignores 0xFFFF session-init sentinel (fixes TV 1 toggle-off when bartender opens Video tab)
- **v2.32.56** — `queryWolfpackRouteState` retry backoff (600ms → 1.2s → 2.4s) eliminates residual TV 1 flicker
- **v2.32.57** — Fleet standardization on **Nginx bartender proxy** + **IPEX-LLM Iris Xe Ollama**. Two new setup scripts: `scripts/setup-bartender-nginx.sh`, `scripts/setup-iris-ollama.sh`
- **v2.32.58** — Bug-fix bundle: stale guide auto-refresh, Fire TV deepLink wiring, Shift Brief 403 fix (`/api/ai/` allow-list), WI RSN preset naming clarification

### AI / data fixes (v2.32.59 – v2.32.65)

- **v2.32.59** — System Admin GPU meter wired to `intel_gpu_top` for Intel Iris Xe
- **v2.32.60** — Checkpoint C ignores `non-fatal` false-positive (was matching `[AI-SUGGEST] builder failed (non-fatal):` and rolling back deploys)
- **v2.32.61** — GPU memory metric falls back to `size` when `size_vram=0` (IPEX-LLM SYCL reports 0 VRAM despite using iGPU)
- **v2.32.62** — Tightened in-progress filter: AI Suggest + channel guide now require `estimated_end > now` (no more NFL Draft from 11 days ago surfacing)
- **v2.32.63** — Walker extracts game start times from ESPN + Prime Video tile text → bartender remote shows real times instead of "On demand"
- **v2.32.64** — qwen2.5:14b switch (reverted in v2.32.65)
- **v2.32.65** — Reverted to llama3.1:8b; model is env-overridable via `OLLAMA_MODEL`

### iGPU enablement saga (v2.32.66 – v2.32.70)

- **v2.32.66** — GPU meter falls back to frequency-based usage on Iris Xe (engine busy% always 0 there via i915 perf interface)
- **v2.32.67** — `setup-iris-ollama.sh` installs Intel level-zero userspace if missing; modprobes i915/xe if `/dev/dri/` empty
- **v2.32.68** — Broadened Intel chip detection regex (matches unnamed `Device a7a0` PCI entries)
- **v2.32.69** — Group-add for ubuntu user moved BEFORE the clinfo gate; extended Intel package list (`intel-igc-cm`, `libdrm-intel1`, `libigdfcl1`, `libigdgmm12`); reinstall `intel-opencl-icd` if `libigdrcl.so` missing post-install
- **v2.32.70** — Per-Ubuntu-codename Intel apt repo line (jammy vs noble); docs catch-up for v2.32.65–v2.32.70

---

## Outstanding work

1. ~~OS upgrade for the 3 jammy locations~~ — **Done 2026-05-07/08**. Full fleet now on noble + iGPU + kernel 6.8.0-111. Status tracker at the bottom of `docs/OS_UPGRADE_RUNBOOK.md` has all three completed rows.

1a. ~~Auto-update silent-no-op when a box drifts to `main`~~ — **Done 2026-05-08**. Holmgren sat on `main` for ~10h before a manual fleet-status check caught it (missed v2.32.76-.80). Root cause: cron sees "origin/main already merged into HEAD" and silently exits. Fix shipped in v2.32.81 (drift-recovery block in `scripts/auto-update.sh`) + v2.32.82 (sidecar at `/home/ubuntu/sports-bar-data/.auto-update-last-success.json` so the canonical-branch signal survives branch switches). Verified live; full fleet at v2.32.82.

2. **Per-event Fire TV deep links** *(next priority — operator-flagged 2026-05-07)* — v2.32.58 wired the `deepLink` field through to the Watch button, but the walker (v2.32.63) only captures titles + times, not per-event URLs. Result: hitting "Watch" on an Amazon Prime Video game opens the app but not the specific game. Investigation paths to consider: (a) ESPN's public scoreboard API to construct deep links from `homeTeam + awayTeam + start_time`; (b) capture the focused-tile URL via `dumpsys activity` while the walker is on a game card (Prime Video may already expose an `aiv-com://com.amazon.avod/?titleId=…` scheme); (c) extend the per-app rules + extractor pattern in `packages/scheduler/src/firetv-catalog-walker.ts` to grab a per-tile URL field. Pairs with #3.

3. **More streaming-app walker rules** — Walker (`packages/scheduler/src/firetv-catalog-walker.ts`) only has Prime Video extractor rules today. Netflix, ESPN+, Hulu, Disney+, Max, Peacock, YouTube TV all need their own per-app rules to surface live games on the channel guide. Each app has its own UIautomator layout — same scaffolding, app-specific selectors. Order of operations: pair with #2 above (once a per-tile URL field is harvested for Prime Video, the same path multiplies across apps).

4. ~~`scripts/auto-update.sh` heartbeat refresh on no-op runs~~ — **Done v2.32.80**. New `refresh_heartbeat_os_only()` helper called on the no-op exit path; only patches the `os.*` block (leaves verifyInstall / configChecksums / dbRowCounts intact since those weren't re-checked). Idempotent — commits + pushes only when the OS values actually changed.

5. ~~Fleet dashboard manual-refresh button~~ — **Already done** (verified 2026-05-08 during the v2.32.88 sweep). The Refresh button has been live at `apps/web/src/app/fleet/page.tsx:132-139` since v2.32.72 (`feat(fleet-dashboard): show OS codename + kernel per location`); it calls `load(true)` which fetches `/api/fleet/status?refresh=1` and shows a spinner while refreshing. The outstanding-item entry was stale.

6. **Why was Holmgren's kernel on 6.8.0-100 while peers self-updated?** — Pre-fix today, holmgren-way was running `6.8.0-100-generic` while leglamp + lucky-s were on `-110` and the freshly-upgraded jammy boxes on `-111`. Suggests `unattended-upgrades` either isn't running or isn't pulling the kernel metapackage on Holmgren. Worth a check before we drift again — `systemctl status unattended-upgrades`, `/var/log/unattended-upgrades/`, and `dpkg --get-selections | grep linux-generic` to see which kernel meta is installed. If the metapackage is `linux-image-6.8.0-100` literal vs `linux-generic`, Apt won't pull newer kernels via security updates.

7. **qwen2.5:14b on iGPU** — IPEX-LLM Ollama 0.16.2's SYCL backend doesn't accelerate the qwen2 family. Holmgren tested empirically; falls back to CPU. Bigger reasoning models on iGPU need either a newer IPEX-LLM build or a different family with SYCL coverage (`phi4:14b`, `gemma2:27b`). Speculative — try only when there's spare time to test.

8. **Holmgren Fire TV swap** — Cubes at 10.11.3.48 + .49 are throwing ADB errors and are on the operator's hardware-replacement list. Don't debug as code; ignore those errors in PM2 logs (per `project_holmgren_firecube_replacement.md` memory).

---

## How to use this file

- After every fleet rollout, update the per-location table to reflect new versions / states.
- New outstanding work items go in the Outstanding section as they're discovered.
- Completed items move to the "What shipped" section grouped by version.
- Hardware inventory updates when boxes are swapped or moved.
- This file is the single source of truth for fleet operational status — defer to git history for code, but don't make operators dig through 100 commits to figure out what's where.

When in doubt about a specific location, also check:
- `.claude/locations/<branch>.md` — per-location hardware reference
- `docs/VERSION_SETUP_GUIDE.md` — required manual setup steps per version
- `docs/LOCATION_UPDATE_NOTES.md` — auto-update checkpoint risk notes per release
