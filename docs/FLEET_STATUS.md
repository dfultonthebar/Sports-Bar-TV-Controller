# Fleet Status

**Last updated:** 2026-05-08 (greenville OS upgrade complete — full fleet now on noble + iGPU; 6/6 parity)

A snapshot of where each location stands. Update this file after every fleet-wide change so future operators (and Claude) have a single place to see the truth.

---

## Per-location summary

| Location | Branch | OS | Software ver | Bartender proxy | AI Suggest backend | iGPU acceleration | Notes |
|---|---|---|---|---|---|---|---|
| holmgren-way | `location/holmgren-way` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | Reference deployment |
| graystone | `location/graystone` | jammy (22.04) | v2.32.69 | Nginx | upstream Ollama (CPU) | ⏳ awaiting OS upgrade | `/dev/dri/` empty + jammy apt issues. Plan: jammy → noble per `OS_UPGRADE_RUNBOOK.md`. |
| greenville | `location/stoneyard-greenville` | noble (24.04) | v2.32.75 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | OS upgraded 2026-05-08; AI Suggest 119s on iGPU. |
| leglamp | `location/leg-lamp` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | First fleet iGPU success today |
| lucky-s-1313 | `location/lucky-s-1313` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| stoneyard-appleton | `location/stoneyard-appleton` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | OS upgraded 2026-05-08; AI Suggest 67.3s on iGPU (fastest in fleet so far) |

**Decision (2026-05-07):** rather than work around the jammy Intel apt repo limitations and the kernel-module-not-bound case at graystone, the three jammy locations will be brought up to noble via `docs/OS_UPGRADE_RUNBOOK.md`. Cleaner long-term — the noble path is the only one that's actually been proven stable across the fleet (Holmgren / leglamp / luckys all working on noble), and the OS upgrade also extends LTS support from April 2027 to April 2029. Until each location is upgraded, AI Suggest runs on CPU there (slower, ~200-300s per call, but Nginx 300s timeout accommodates it; bartender experience is functional, not great).

**Aggregate health (after greenville upgrade 2026-05-08 — full fleet parity):**
- 6/6: bartender remote on Nginx ✓
- 6/6: noble (24.04) + 6.8 kernel ✓
- 6/6: latest software (v2.32.69+) ✓
- 6/6: iGPU acceleration active (`using Intel GPU` in `journalctl -u ollama-ipex` everywhere) ✓
- 6/6: AI Suggest, channel guide, walker, GPU widget all functional ✓

**AI Suggest cold-run timings on iGPU (llama3.1:8b):** appleton 67s (fleet best) · greenville 119s · graystone 170s · holmgren ~100s · leglamp ~100s · lucky-s ~100s. Variance correlates with thermals + concurrent load, not procedure.

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

## What shipped today (2026-05-07)

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

2. **Per-event Fire TV deep links** *(next priority — operator-flagged 2026-05-07)* — v2.32.58 wired the `deepLink` field through to the Watch button, but the walker (v2.32.63) only captures titles + times, not per-event URLs. Result: hitting "Watch" on an Amazon Prime Video game opens the app but not the specific game. Investigation paths to consider: (a) ESPN's public scoreboard API to construct deep links from `homeTeam + awayTeam + start_time`; (b) capture the focused-tile URL via `dumpsys activity` while the walker is on a game card (Prime Video may already expose an `aiv-com://com.amazon.avod/?titleId=…` scheme); (c) extend the per-app rules + extractor pattern in `packages/scheduler/src/firetv-catalog-walker.ts` to grab a per-tile URL field. Pairs with #3.

3. **More streaming-app walker rules** — Walker (`packages/scheduler/src/firetv-catalog-walker.ts`) only has Prime Video extractor rules today. Netflix, ESPN+, Hulu, Disney+, Max, Peacock, YouTube TV all need their own per-app rules to surface live games on the channel guide. Each app has its own UIautomator layout — same scaffolding, app-specific selectors. Order of operations: pair with #2 above (once a per-tile URL field is harvested for Prime Video, the same path multiplies across apps).

4. **`scripts/auto-update.sh` should refresh heartbeat on no-op runs** — Today's apt dist-upgrade + reboot left the dashboard showing stale OS info (kernel field) until I manually wrote a `/tmp/refresh-heartbeat.sh` helper to push fresh `os.kernel` per box (post-reboot 2026-05-08). The auto-update script currently exits at "no update available" before the heartbeat-write block (~line 596 vs heartbeat write ~line 1255). Fix: move the OS-block heartbeat refresh (just `os.codename / os.version / os.kernel`) BEFORE the no-op exit, or unconditionally write a minimal `os`-only delta if the rest of the heartbeat would be unchanged. Small, low-risk patch.

5. **Fleet dashboard manual-refresh button** — `/api/fleet/status` has a 5-min in-memory cache; `?refresh=1` busts it but the UI doesn't expose this, so an operator looking at `/fleet` can stare at stale data for up to 5 minutes after a fleet-wide change. Add a "Refresh" button that calls `/api/fleet/status?refresh=1` and re-renders. Trivial frontend change.

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
