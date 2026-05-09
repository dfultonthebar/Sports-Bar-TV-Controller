# Fleet Standardization Process

**Question from user 2026-05-09:** "are all the dependencies and software the same on lucky's as the other locations... we need to come up with a process to make sure everything is the same on all locations hardware versions firmware versions all dependencies os's version for all hardware and software"

**Answer: NO, there is real drift.** This doc captures the drift found 2026-05-09 + the process to keep it from regrowing.

---

## Drift findings — 2026-05-09 audit

Captured via `scripts/fleet-audit.sh --all` (see that script for the data-collection contract). Results:

### What's uniform across the fleet ✓

| Component | Value |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| Kernel | 6.8.0-111-generic |
| sqlite3 | 3.45.1 |
| Sports-Bar-TV-Controller | v2.33.4 |
| Scout APK | 2.1.6-launcher-watched (all 16 reachable Cubes) |

### Where drift exists ⚠️

**Host toolchain — REAL DRIFT:**

| Host | Node | npm | PM2 | Java |
|---|---|---|---|---|
| **Holmgren** (this host, our reference) | v22.22.0 | 11.11.0 | 6.0.14 | OpenJDK 17.0.18 |
| **Graystone** | v20.20.2 | 10.8.2 | 6.0.13 | OpenJDK 17.0.18 |
| **Lucky's 1313** | v20.20.0 | 10.8.2 | 6.0.14 | **OpenJDK 21.0.10** ⚠️ |
| **Stoneyard Appleton** | v20.20.2 | 10.8.2 | 6.0.14 | OpenJDK 17.0.18 |
| **Stoneyard Greenville** | v22.22.2 | 10.9.7 | 6.0.14 | OpenJDK 17.0.18 |
| **Leg Lamp** | (not in non-interactive PATH) | (same) | (same) | (same) |

Concerns:
- **Java 21 on Lucky's** — Scout APK builds need JDK 17 (Gradle 8.0 compatibility per CLAUDE.md). If anyone tries to build the APK on Lucky's host without `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`, the build fails with "Unsupported class file major version 65". `scripts/install-scout-accessibility.sh` auto-pins JAVA_HOME, so this hasn't bitten yet, but it's a footgun.
- **Node 20 vs 22** — minor behavioral drift possible (especially around timer scheduling, fs promises). No KNOWN bug attributable, but the inconsistency is a smell.
- **npm 10 vs 11** — npm 11 changes lockfile format slightly. If a location commits a regenerated lockfile from npm 11 on a Node-20 box's PR, the install on a Node-20 box can throw warnings.
- **Leg Lamp PATH** — toolchain may exist but isn't in non-interactive shell PATH. Either it's fine (PM2 launched at boot finds it via systemd unit) OR it's broken and we just haven't noticed.

**Cube hardware / firmware — SIGNIFICANT DRIFT:**

| Location | Cube model | firebat versions present |
|---|---|---|
| Holmgren | mixed (failing-replacement units) | PVFTV-215.5200-L, PVFTV-215.6073-L |
| Graystone | AFTGAZL (3rd gen) | PVFTV-214.0054-L (uniform across 4 Cubes) |
| Lucky's 1313 | **AFTR (2nd gen)** | **PVFTV-320.0001-L** on Cubes 1+2, **PVFTV-215.6073-L** on Cubes 3+4 |
| Stoneyard Appleton | AFTGAZL | PVFTV-**104.0379-L** (very old!), PVFTV-115.6073-L, PVFTV-213.1015-L |
| Stoneyard Greenville | AFTGAZL | PVFTV-**107.0175-L** (very old!), PVFTV-214.0054-L, PVFTV-213.1015-L |
| Leg Lamp | (no Cubes) | n/a |

**This is a major problem.** firebat (Prime Video on Fire TV) spans 8 different versions across the fleet (104, 107, 115, 213, 214, 215, 320). Each version has different UI layout, different leanback launcher activity, different behavior. The walker tries to handle this dynamically but per-version brittleness is the root cause of the v2.33.4 PVFTV-320 launcher-hosted issue.

**PVFTV-320 specifically (Lucky's Cubes 1+2)** has additional anti-scraping per user research 2026-05-09:
> "App hardening & obfuscation: Newer Prime Video builds use more aggressive code protection, encrypted data storage, and runtime checks. This complicates ADB-based extraction, dumpsys scraping. Anti-scraping measures: Amazon has been tightening the Prime Video app over time. Later versions reduce exposed activities, limit intent filters for deep links, and make internal content metadata harder to access."

So: as Cubes auto-update to PVFTV-320+, our walker breaks for them. The technical limit is real, not a bug we can fix with code.

**Cube-side config — UNIFORM (good)** after 2026-05-09 fleet-wide application of `scripts/configure-firetv-cube.sh`:
- screen_off_timeout=2147460000 (~25 days) on all 16 reachable Cubes ✓
- screensaver_enabled=0 on all ✓
- stay_on_while_plugged_in=7 on all ✓
- Scout APK v2.1.6 on all 16 ✓
- AccessibilityService bound on all 16 ✓

---

## Reference baseline (the standard)

We pick **Holmgren Way** as the reference baseline. Reason: it's the dev/test host where new versions land first, then propagate via auto-update to other locations. Operator chooses Holmgren as the reference because that's where this team works directly + tests changes.

Reference (as of 2026-05-09):

| Component | Reference value |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| Kernel | 6.8.0-111-generic |
| Node | v22.22.0 |
| npm | 11.11.0 |
| PM2 | 6.0.14 |
| Java | OpenJDK 17.0.18 |
| sqlite3 | 3.45.1 |
| adb | (whatever ships with Ubuntu's `android-tools-adb`) |
| Sports-Bar-TV-Controller | latest origin/main (auto-updated) |
| Scout APK | latest committed `firestick-scout/app/build.gradle` versionName |

---

## The process — three layers

### Layer 1 — Continuous audit (already shipped)

`scripts/fleet-audit.sh` runs read-only across all 6 fleet hosts via Tailscale + sshpass. Captures every drift-prone field. Outputs to `/tmp/fleet-audit/<host>.txt` per host.

**Cadence:** weekly. Suggested operator workflow:
1. From any host with sshpass + Tailscale (typically Holmgren), run `bash scripts/fleet-audit.sh --all`.
2. Review the "Quick drift summary" output at the bottom.
3. Any field where hosts disagree → triage per Layer 2 below.

A scheduled cloud agent already exists (`trig_01DrGjX38M9MeQPnMGexon9n` — "Weekly fleet health sweep" at Friday 12:00) but it only checks git/version state, not toolchain. Consider extending it to wrap fleet-audit.sh once auto-update is reliable enough to deploy the script everywhere.

### Layer 2 — Alignment (the action half)

When drift is found, the action depends on which component drifted:

| Component | Alignment recipe |
|---|---|
| OS / kernel | Run the documented `docs/OS_UPGRADE_RUNBOOK.md` per host. Schedule during off-hours. |
| Node | `bash scripts/align-node-version.sh` (NEW — see below). Installs Node 22.22.0 via the existing nodesource repo or `nvm`. |
| npm | Comes with Node — aligning Node aligns npm. |
| PM2 | `npm i -g pm2@6.0.14`. PM2 install is non-disruptive (existing processes keep running). |
| Java | `sudo apt install openjdk-17-jdk-headless` + remove openjdk-21 if drift to 21 happened (Lucky's). Set system default via `sudo update-alternatives --config java`. |
| sqlite3 | Comes with the OS — aligning the OS aligns sqlite3. |
| **Sports-Bar-TV-Controller** | Auto-update handles this. If a location is behind, run `bash scripts/auto-update.sh --triggered-by=manual_cli` on it. |
| **Scout APK** | `bash scripts/install-scout-accessibility.sh` per location. Idempotent. Per CLAUDE.md it auto-pins JDK 17 + does pm uninstall on signature mismatch. |
| **firebat (Prime Video on Fire TV)** | **CANNOT be aligned via ADB** — Amazon controls OTAs. The Cube auto-updates when Amazon decides. To force: in TV's Settings → My Fire TV → About → Check for Updates. Some operators disable auto-OTA via `pm disable com.amazon.tv.systemupdate` + `settings put global ota_disable_automatic_update 1` to KEEP older firebat. Disabling has tradeoffs (security patches also blocked) — discuss with operator before applying. |
| **Cube screensaver/sleep** | `bash scripts/configure-firetv-cube.sh <ip>` per Cube. Idempotent. |

### Layer 3 — Drift prevention (process, not script)

Process-level rules that prevent drift from regrowing:

1. **Operator commits to a ref version when bumping the toolchain.** When upgrading Node/npm/PM2/Java on the dev box, document the new ref in this doc + run the alignment recipe across the fleet within 1 week.

2. **Scout APK rebuild ALWAYS happens on Holmgren first** (the ref toolchain), then deployed via `scripts/install-scout-accessibility.sh` to other locations. NEVER build on Lucky's (Java 21) until Lucky's is realigned to JDK 17.

3. **Auto-update verifies toolchain at install time.** Future enhancement: have `scripts/auto-update.sh` warn if the local node/npm/pm2/java versions don't match the documented refs in this file. Right now it doesn't check — that's a future PR.

4. **Cube hardware purchases standardize on AFTGAZL (3rd gen)** going forward. Lucky's AFTR Cubes work but firebat updates to PVFTV-320 unpredictably and our walker can't navigate the new launcher. Phase out AFTR over time as Cubes naturally fail and need replacement.

5. **firebat OTA management.** For new sites, the operator chooses up-front:
   - **Allow OTAs** (Amazon's default): Cubes stay current with security patches; walker compatibility breaks unpredictably. Accept the trade-off.
   - **Disable OTAs**: Cubes pin to current firebat; walker rules stay stable longer but Cubes don't get security patches. Acceptable for closed networks.

   Document the choice per location in `.claude/locations/<branch>.md`.

---

## The hard truth about firebat / PVFTV-320

Your research is correct: PVFTV-320 (and beyond) has more anti-scraping than older firebat. Specifically:
- Reduced exposed activities (we saw `IgnitionActivity` on Lucky's 1+2 routes through the launcher, not into Prime Video proper)
- Limited deep-link intent filters (the v2.33.4 `https://watch.amazon.com/sports` deep-link approach didn't escape the launcher)
- Encrypted/protected metadata (no usable cache/file-system pull)

**Implication for our walker:** on PVFTV-320 Cubes, the walker WILL fail to extract Prime Video tiles regardless of how many code paths we add. This is not a bug-fix-away problem.

**Realistic mitigation per `docs/SCOUT_APK_ENHANCEMENT_PROPOSAL.md` Path 4** (MediaProjection + Vision LLM): on-device screen capture + cloud OCR. Bypasses accessibility entirely. ~2-week MVP project.

In the meantime: Lucky's Cubes 1+2 won't have Prime Video tiles in the bartender catalog. Other 14 Cubes do.

---

## Quick-start: re-aligning a drifted location

```bash
# Step 1 — Audit:
bash scripts/fleet-audit.sh --all
# Read the "Quick drift summary" output. Identify drifted fields.

# Step 2 — For each drifted host, ssh in via Tailscale and run the recipe
# from the table in Layer 2 above. E.g. for Lucky's Java drift:
sshpass -e ssh ubuntu@luckys1313 \
  'sudo apt install -y openjdk-17-jdk-headless && \
   sudo update-alternatives --set java /usr/lib/jvm/java-17-openjdk-amd64/bin/java'

# Step 3 — Re-audit to confirm:
bash scripts/fleet-audit.sh --all | grep "^── java" -A6
# All 6 hosts should show OpenJDK 17.0.18.
```

---

## Open questions for next session

1. **Should we ship `scripts/align-node-version.sh`** that auto-aligns Node + npm to the ref version across the fleet? Risk: forced Node upgrade on a running PM2 service is intrusive. Reward: drift stops.
2. **Should auto-update.sh add a toolchain-version warning step?** "Your Node is v20.20.0, ref is v22.22.0 — please align." Soft warning, doesn't block. Costs 0 in correctness, gains continuous visibility.
3. **AFTR Cube replacement schedule.** Lucky's has 4 AFTR Cubes; 2 are on PVFTV-320 (walker-blind), 2 are on PVFTV-215 (works). Do we replace the PVFTV-320 ones with AFTGAZL units now? Cost vs operator pain.
4. **firebat OTA disable.** Should we disable OTAs fleet-wide to lock in current firebat versions and not regress? See Layer 3 process rule #5.

These are operator decisions, not engineering decisions. Engineering can execute either way once chosen.
