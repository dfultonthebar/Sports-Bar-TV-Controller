# Fleet Status

**Last updated:** 2026-05-07 (end of the v2.32.55–v2.32.70 rollout day)

A snapshot of where each location stands. Update this file after every fleet-wide change so future operators (and Claude) have a single place to see the truth.

---

## Per-location summary

| Location | Branch | OS | Software ver | Bartender proxy | AI Suggest backend | iGPU acceleration | Notes |
|---|---|---|---|---|---|---|---|
| holmgren-way | `location/holmgren-way` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | Reference deployment |
| graystone | `location/graystone` | jammy (22.04) | v2.32.69 | Nginx | upstream Ollama (CPU) | ❌ skipped | `/dev/dri/` empty — kernel module not bound. OS upgrade should fix. |
| greenville | `location/stoneyard-greenville` | jammy (22.04) | v2.32.69 | Nginx | upstream Ollama (CPU) | ❌ apt blocked | Intel apt repo dep mismatch on jammy. v2.32.70 fixes via per-codename repo line. |
| leglamp | `location/leg-lamp` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | First fleet iGPU success today |
| lucky-s-1313 | `location/lucky-s-1313` | noble (24.04) | v2.32.69 | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| stoneyard-appleton | `location/stoneyard-appleton` | jammy (22.04) | v2.32.69 | Nginx | upstream Ollama (CPU) | ⏳ pending v2.32.70 | Should activate after re-running setup-iris-ollama.sh post-v2.32.70 merge |

**Aggregate health (5 of 6 venues working as designed; 1 needs OS upgrade for full iGPU):**
- 6/6: bartender remote on Nginx ✓
- 6/6: latest software (v2.32.69+) ✓
- 6/6: AI Suggest, channel guide, walker, GPU widget all functional ✓
- 3/6: iGPU acceleration active (holmgren, leglamp, luckys)
- 2/6: iGPU pending v2.32.70 setup-iris-ollama.sh re-run (greenville, appleton)
- 1/6: iGPU blocked on kernel/OS work (graystone)

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

1. **graystone iGPU enablement** — `/dev/dri/` empty even after Intel userspace install. Needs operator-side `sudo modprobe i915` + `dmesg | grep i915` investigation. May need BIOS check (integrated graphics enabled?) or kernel update. The OS upgrade in `docs/OS_UPGRADE_RUNBOOK.md` should fix this since the noble kernel binds i915 properly out of the box.

2. **greenville + appleton iGPU enablement** — Once v2.32.70's per-codename Intel apt repo lands at these jammy locations (auto-update on next cron, or manual run), re-running `bash scripts/setup-iris-ollama.sh` should bring iGPU online without an OS upgrade. They are 22.04 boxes that the new script line targets correctly.

3. **OS upgrade plan for the 3 jammy locations** — `docs/OS_UPGRADE_RUNBOOK.md` is the runbook. Recommended order: graystone → appleton → greenville. Schedule one location per week during slow hours.

4. **Per-event Fire TV deep links** — v2.32.58 wired the `deepLink` field through to the Watch button, but the walker (v2.32.63) only captures titles + times, not per-event URLs. ESPN's eventId isn't in uiautomator dumps; would need an integration with ESPN's public scoreboard API to construct deep links from titles. Deferred — separate work item.

5. **qwen2.5:14b on iGPU** — IPEX-LLM Ollama 0.16.2's SYCL backend doesn't accelerate the qwen2 family. Holmgren tested empirically; falls back to CPU. Bigger reasoning models on iGPU need either a newer IPEX-LLM build or a different family with SYCL coverage (`phi4:14b`, `gemma2:27b`). Speculative — try only when there's spare time to test.

6. **Holmgren Fire TV swap** — Cubes at 10.11.3.48 + .49 are throwing ADB errors and are on the operator's hardware-replacement list. Don't debug as code; ignore those errors in PM2 logs (per `project_holmgren_firecube_replacement.md` memory).

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
