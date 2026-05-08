# Fleet Status

**Last updated:** 2026-05-08 (Watch-button-broken-on-Amazon fix shipped v2.32.91 — walker silently skipped Prime Video for ~6 weeks because available_networks "Amazon Prime Video" never matched the rule keyed "Prime Video"; sendKey 3s timeout aborted autoplay sequences. Both fixed. Full fleet at v2.32.91.)

A snapshot of where each location stands. Update this file after every fleet-wide change so future operators (and Claude) have a single place to see the truth.

---

## Per-location summary

| Location | Branch | OS | Software ver | Bartender proxy | AI Suggest backend | iGPU acceleration | Notes |
|---|---|---|---|---|---|---|---|
| holmgren-way | `location/holmgren-way` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | Reference deployment; first to receive drift-recovery fix |
| graystone | `location/graystone` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| greenville | `location/stoneyard-greenville` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | OS upgraded 2026-05-08; AI Suggest 119s on iGPU. |
| leglamp | `location/leg-lamp` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| lucky-s-1313 | `location/lucky-s-1313` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | |
| stoneyard-appleton | `location/stoneyard-appleton` | noble (24.04) | **v2.32.91** | Nginx | IPEX-LLM Ollama (Iris Xe) | ✅ active | AI Suggest 67.3s on iGPU (fleet best) |

**Aggregate health (2026-05-08 18:00 UTC):**
- 6/6: bartender remote on Nginx ✓
- 6/6: noble (24.04) + 6.8.0-111 kernel ✓
- 6/6: latest software (v2.32.90) ✓ — verified PASS 7/7 across all heartbeats
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

**v2.32.89** — Walker `uiautomator dump` no longer hits the 3s ADB-shell timeout. Root cause: `packages/firecube/src/adb-client.ts:executeShellCommand` had a hardcoded 3000ms timeout. UIautomator dumping the Fire TV launcher home screen (with its full rail-tile + carousel tree) reliably exceeds 3s on a busy device — the timeout fires, `adb shell -T` exits with no stdout, the walker reads xml.length=0 and surfaces "empty dump". Fix: thread an optional `timeoutMs` (500-30000ms) through `executeShellCommand` → `/api/firetv-devices/send-command` POST schema → walker; walker passes 10000ms on `uiautomator dump` only. All other call sites keep the snappy 3s default. Verified live on Holmgren Cube 3: pre-fix walks produced 0 catalog rows; post-fix walk produced 12 ESPN rows with 0 errors.

**v2.32.90** — Walker rules: document Hulu / YouTube TV / Fox Sports as non-walkable. Fleet probe via SSH surveyed sports-relevant streaming apps installed across all 6 boxes; the 3 highest-value candidates not yet walked were probed for accessibility. Result: none walkable (Hulu paywall on logged-out Cubes; YouTube TV Cobalt runtime accessibility-blind; Fox Sports videogo stub redirect). Three explicit `APP_WALK_RULES` entries added with `usesWebView: true` so future probes don't repeat the dead-end work. Each carries the empirical probe result inline.

**v2.32.91** — Watch button works for Amazon Fire TV games again (operator-reported). TWO interlocking bugs together prevented the bartender remote's Watch button from doing anything for any Prime Video game:

1. **Walker silently skipped Prime Video for ~6 weeks.** `APP_WALK_RULES` was keyed `'Prime Video'` but `input_sources.available_networks` at most locations stores `'Amazon Prime Video'`. Pre-fix used exact-string match (`availableNetworks.filter((n) => APP_WALK_RULES[n])`); never matched. Walker silently skipped every Prime Video walk on every Cube → zero Prime Video tiles in `firetv_streaming_catalog` → zero Prime Video games in the bartender's per-input channel guide → zero Watch buttons for Prime Video content. Fix: alias-aware resolution via `findStreamingAppByDisplayName(network) → catalogId → APP_WALK_RULES[ruleKey where rule.catalogId matches]`. Direct key match still wins as fast path. Verified live at Holmgren: walks attempted jumped 4 → 10, totalTilesUploaded 14 → 30, channel-guide for Cube 3 went from 0 Prime Video games to 8.

2. **3s sendKey timeout aborted autoplay sequences.** Same root cause class as v2.32.89's `uiautomator dump` fix but on the `sendKey` path. DPAD events during Prime Video's `SearchResultsActivity` rendering and ESPN's content-row hydration timed out at exactly 3000ms because `adb shell -T` was waiting for system_server ack while the framework was pinned. Autoplay aborted, `/api/streaming/launch` returned `success:false`, bartender saw "Failed to launch". Fix: optional `timeoutMs` on `sendKey`; both `launchPrimeVideoToContent` and `launchEspnToLiveContent` pass 8000ms on every DPAD event. Verified live: pre-fix 500 → post-fix 200 in ~11s with Cube advancing into Prime Video.

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

2. ~~Per-event Fire TV deep links~~ — **Investigated 2026-05-08; user-facing pain solved another way. CLOSED with corrected reasoning.**

   **Operator pain ("Watch button opens the app but not the specific game") was solved by today's autoplay** (v2.32.84/.85): Watch performs a search-and-DPAD-navigate sequence that lands on PlayerActivity playing the right game. End-user benefit is delivered.

   **What blocks the architectural-cleanliness variant** (replace search-bounce with a per-event URL):

   - **ESPN: Comrade-gated.** Live probe on Cube 2: `pm dump com.espn.gtv` shows `sportscenter://x-callback-url/<anything>` is a catch-all that always lands on `StartupActivity` → home tab. `logcat` reveals `ComradeActionHandler: Capabilities{PLAY=...mIntentDataExtraName='null'...}` — ESPN's per-event routing on Fire TV is mediated by Amazon's universal-search catalog (Comrade), which routes via registered content IDs only Amazon assigns to partners. Third parties cannot construct event-specific URLs.

   - **Prime Video: deep-link path EXISTS, but ASIN capture is non-trivial.** Re-probe 2026-05-08 found `pm dump com.amazon.firebat` registers many BROWSABLE intent filters including `amzn://avod/playback?asin=<X>`. Empirically firing that URL routed through `DeepLinkRoutingActivity` and triggered the playback subsystem (`PlaybackSupportEvaluator`, `PlaybackDownloadManager` initialized in logcat). The `firebat://*` schemes are also registered but `not exported` (Android security gate blocks cross-app use). So the right intent format is known. **The blocker is ASIN capture.** Walker uiautomator XML mining is dead (only text/content-desc exposed; ASINs never in resource-id). The tiles on the Fire TV home screen are launcher-hosted, and tile-click intents don't fire URI-style intents catchable in logcat (launcher uses Binder IPC to its own services). A walker rewrite to DPAD onto each tile + capture destination intent + parse ASIN would be ~100 lines of risky code with uncertain reliability across launcher versions, AND deliver zero additional operator-visible benefit over today's search-and-DPAD-autoplay. Both paths end on PlayerActivity for the right game.

   **Conclusion:** today's autoplay IS the practical ceiling. The architectural improvement is real but its cost-benefit is firmly negative.

   **Path of last resort if a future operator demands it:** maintain a per-location lookup table of `(league_or_show_name → stable_amzn_asin)` for the small set of Prime Video sports content actually shown. Then walker emits `amzn://avod/playback?asin=<X>` from the table rather than `https://watch.amazon.com/search?phrase=<title>`. Friction: per-location maintenance, weekly re-validation as ASINs rotate. Not recommended absent specific demand.

3. **More streaming-app walker rules** *(scoped down 2026-05-08 — most originally-listed apps are non-walkable)* — Probed across the fleet: Hulu (paywall-gated when logged out), YouTube TV (Cobalt runtime — accessibility-blind), Fox Sports videogo (stub redirect to FOX One), Apple TV+ (accessibility-blind native), fuboTV / Peacock (WebView), Netflix (no live sports anyway). All documented in `firetv-catalog-walker.ts` with `usesWebView: true` flag + reason comments. **Productive remainder:** (a) probe Hulu on a logged-in Cube once an operator signs in — it MAY become walkable; (b) probe `com.fox.foxone` (the actual content APK behind the Fox Sports stub) at locations that have it installed; (c) probe NFL App, NBA App, MLB.TV, NBC Sports if a sports-bar operator subscribes. Each is a one-Cube probe; build extractors only for the ones that prove walkable. **Don't speculatively add walker rules without a probe.**

4. ~~`scripts/auto-update.sh` heartbeat refresh on no-op runs~~ — **Done v2.32.80**. New `refresh_heartbeat_os_only()` helper called on the no-op exit path; only patches the `os.*` block (leaves verifyInstall / configChecksums / dbRowCounts intact since those weren't re-checked). Idempotent — commits + pushes only when the OS values actually changed.

5. ~~Fleet dashboard manual-refresh button~~ — **Already done** (verified 2026-05-08 during the v2.32.88 sweep). The Refresh button has been live at `apps/web/src/app/fleet/page.tsx:132-139` since v2.32.72 (`feat(fleet-dashboard): show OS codename + kernel per location`); it calls `load(true)` which fetches `/api/fleet/status?refresh=1` and shows a spinner while refreshing. The outstanding-item entry was stale.

6. ~~Why was Holmgren's kernel on 6.8.0-100 while peers self-updated?~~ — **Diagnosed 2026-05-08.** Holmgren is now running `6.8.0-111-generic` (matches fleet); the legacy `linux-image-6.8.0-100-generic` package is still installed-marked-automatic and would be cleaned by `sudo apt autoremove` (cosmetic, not blocking anything). Mechanism: `/etc/apt/apt.conf.d/50unattended-upgrades` allows ONLY `noble` + `noble-security` (and ESM); the `${distro_id}:${distro_codename}-updates` line is commented out (Ubuntu's standard server posture). Most kernel security CVEs are published to BOTH `-updates` and `-security` within hours, but during the gap window an updated kernel can be in `-updates` only — Holmgren stayed on -100 through that window. Service was healthy throughout (`systemctl status unattended-upgrades` shows daily security pulls, e.g. libwebkit2gtk on 2026-05-07). No action required; config change to enable `-updates` is optional and not recommended given drift-recovery (v2.32.81/.82) now self-heals the auto-update side, and apt drift on a single kernel point release is acceptable on server-class hardware.

7. ~~qwen2.5:14b on iGPU~~ — **Re-tested 2026-05-08; previous claim was wrong. CLOSED.** qwen2.5:14b DOES accelerate on the current IPEX-LLM Ollama build at Holmgren. Empirical evidence: `intel_gpu_top` peaked at **99.6% Render/3D engine busy** during a representative AI-Suggest-style prompt. Generation rate **6.1 tok/s** (147-token response in 24.0s; prompt eval 34.0 tok/s). Same prompt on llama3.1:8b: **10.2 tok/s** (128-token in 12.5s). qwen2.5:14b is 67% slower per token but the model file is also 84% larger (9.5GB vs 5.3GB) — total wall-clock for a real AI Suggest call is ~150-180s on qwen2.5:14b vs ~100s on llama3.1:8b. Both run on the iGPU; the `ollama ps` `size_vram=0GB` reporting is a separate known IPEX-LLM/SYCL quirk (system reports VRAM as zero despite using the iGPU — see v2.32.61 fix in System Admin GPU meter). **Recommendation:** keep llama3.1:8b as default (faster); operators can opt into qwen2.5:14b for higher-quality scheduling suggestions via `OLLAMA_MODEL=qwen2.5:14b` (env-overridable since v2.32.65). Did not benchmark phi4:14b or gemma2:27b — qwen2 viability eliminates the need to hunt for an alternative family with SYCL coverage.

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
