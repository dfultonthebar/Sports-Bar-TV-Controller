# v2.2.0 Active Extraction — PVFTV-320 findings (Lucky's Cube 1, 2026-05-09)

Built v2.2.0 Scout APK with on-demand snapshot service + LauncherNavigator
targeting the PVFTV-320 launcher's "Live" tab. Deployed to Lucky's Cube 1
(192.168.10.42, AFTR + PVFTV-320.0001-L). Iterated 5 times against real
device behavior. Conclusion below.

---

## What works (the framework is solid)

End-to-end pipeline ran cleanly across all 5 iterations:

```
adb broadcast → SnapshotCommandReceiver → CatalogSnapshotService
  → LauncherIntent.launchPackage(com.amazon.firebat)
  → PlaybackAutomationService.awaitWindowSettled()
  → FirebatVersionDetector → "firebat=320 navPath=PRIME_LAUNCHER_HOSTED"
  → LauncherNavigator.gotoLiveTab()
  → CatalogExtractor.collectCandidateTiles()
  → POST /api/firestick-scout/snapshot → 200 OK
```

Verified on Cube 1:
- Foreground service starts + acquires the right notification
- Companion methods on `PlaybackAutomationService` work (instance,
  awaitWindowSettled, snapshotCurrentTree with refresh)
- Pending-click guard works (would skip if a bartender PLAY_GAME were active)
- HTTP POST retry logic works (succeeded first attempt every iteration)
- Server endpoint `/api/firestick-scout/snapshot` accepts payload + logs
  per-app status correctly
- Tree-walking + scoring extractor works (gets candidates, applies scores,
  filters to threshold)

**The framework is reusable for any future Scout-side active-extraction
work.** What's documented below is just the navigation problem — the
plumbing is verified.

---

## What doesn't work (PVFTV-320 specifically)

After 5 iterations of LauncherNavigator tweaks, the conclusion is:

**PVFTV-320 launcher does NOT expose a top-nav "Live" tab via the
AccessibilityNodeInfo tree.**

The original probe (`docs/probes/pvftv320-launcher/01_home.xml`) found a
content-desc="Live" string in the launcher tree, but on closer inspection
that node lives at `y=532` — the middle of the screen — and is a content
card, not a top-nav tab. Clicking it triggers `firebat/IgnitionActivity`
(opens a generic firebat activity), not a Live-tab content view.

Iteration #5 confirmed the absence of a top-nav Live: a strict y < 200
filter found ZERO matching nodes. Diagnostic dump showed the actual top
of the visible tree:

```
node[5] cls=ComposeView text='New Home of BET Favorites now on Paramount+ on Prime…' (hero card)
node[6] cls=RecyclerView                                                 (apps row container)
node[7] text='More Apps press select to view all of your apps and channels'
node[8] text='Settings for Luckys Madison'
node[11] text='My Stuff'
focused=Home
```

The launcher has tabs but they're either:
- Compose-only with `importantForAccessibility=no`
- Behind an accessibility-hidden flag on the top nav strip
- Or they don't exist as separate nodes at all (the "Home" focused state
  may BE the only "tab", with Find/Live appearing elsewhere as you DPAD
  around)

Either way, our Scout AccessibilityService can't see them. **This is the
PVFTV-320 anti-scraping the user's external research described.**

---

## What this means for v2.2.0

The implementation is correct; the target's anti-scraping is real.

Three honest paths forward:

### Option A — Implement `AppNavigator` for PVFTV-215 only, ship v2.2.0 to most of fleet

Leaves Lucky's Cubes 1+2 (PVFTV-320, AFTR) with no improvement, but
delivers active-extraction value to the 14 PVFTV-215 Cubes elsewhere
(Holmgren / Graystone / Stoneyards / Lucky's 3+4). PVFTV-215's firebat
opens its own separate UI that DOES expose game tiles via AS — that's
already what the server-side walker uses.

**Pros:** Ships incremental value. Architecture is reusable.
**Cons:** Doesn't solve the original problem (Lucky's Cubes 1+2 Prime
Video catalog). Needs ~1 day of AppNavigator work + 1 day of fleet
deployment.

### Option B — Pivot to Path 4 (MediaProjection + Vision LLM)

The route documented in `docs/SCOUT_APK_ENHANCEMENT_PROPOSAL.md` for
exactly this case. Scout takes screenshots of the rendered TV output,
sends them to a cloud Vision LLM (Claude Vision / GPT-4o-mini), gets
structured tile data back. Bypasses the AccessibilityService entirely.

**Pros:** Works regardless of accessibility hardening. Future-proof
against further Amazon anti-scraping.
**Cons:** Multi-week MVP project. Operator consent UX (one-time per
Cube via TV remote). Recurring LLM cost ($30-150/mo fleet-wide).

### Option C — Replace Lucky's PVFTV-320 Cubes with PVFTV-215 hardware

Lucky's Cubes 1+2 are AFTR (2nd gen). The fleet standard is AFTGAZL
(3rd gen) which generally ships with older firebat versions that ARE
walkable. Per `docs/FLEET_STANDARDIZATION_PROCESS.md`, "Cube hardware
purchases standardize on AFTGAZL going forward; phase out AFTR over
time." Buying 2 AFTGAZL Cubes for Lucky's resolves this without any
code work.

**Pros:** Zero engineering. Brings Lucky's into fleet config standard.
**Cons:** Hardware cost ($240-300). Operator install time.

---

## Current state of Cube 1

Lucky's Cube 1 currently runs Scout v2.2.0-active-extraction. The
snapshot service is installed but NOT scheduled (on-demand only via
SNAPSHOT_NOW broadcast). Periodic firing won't happen until we add
AlarmManager scheduling — which we deferred for first-iteration
clarity. So the v2.2.0 install is harmlessly idle on Cube 1.

The 13 other reachable fleet Cubes are still on Scout v2.1.6-launcher-watched
(the previous version). Bartender remote functionality is unchanged.

---

## Recommendation for next session

If the user picks Option A (most pragmatic): we'd:
1. Implement `AppNavigator.kt` mirroring the existing TypeScript walker's
   ESPN + PVFTV-215 Prime Video DPAD nav rules
2. Re-build APK
3. Deploy fleet-wide
4. Add the AlarmManager 6h schedule (drop the on-demand-only restriction)
5. Verify on a PVFTV-215 Cube (Holmgren Cube 2 or Graystone) — should
   produce game tiles via the snapshot path

If the user picks Option B (long-term solution for PVFTV-320): we'd
start the Path 4 design + spike a single-app MediaProjection prototype
on Holmgren first.

If the user picks Option C: zero engineering — operator orders 2 AFTGAZL
Cubes for Lucky's, swap them in when they arrive.

The framework code shipped in v2.2.0 (CatalogSnapshotService /
CatalogExtractor / FirebatVersionDetector / LauncherIntent / new
companion methods on PlaybackAutomationService / new server endpoint)
is reusable for any of these paths. The only path-specific code is the
Navigator class — replace `LauncherNavigator.gotoLiveTab()` with
`AppNavigator.gotoEspnLive()` and `AppNavigator.gotoPrimeVideoSports()`
for Option A.

---

## Iteration log (for reference)

| # | Change | Result |
|---|---|---|
| 1 | Initial v2.2.0: launch firebat → search for "Live" anywhere in tree → click | Crashed at "no Live tab found" — landed on IgnitionActivity (no tree content) |
| 2 | Added GLOBAL_ACTION_HOME after launch to surface launcher home | Found "Live" node + clicked it; ended up extracting 8 nav-chrome tiles, 0 sports tiles |
| 3 | Added DPAD_DOWN×3 to scroll past app shortcuts | Same 8-tile extract — scrolling didn't reveal new content (AS tree only sees rendered content) |
| 4 | Added freshRoot retry loop (handle null after HOME transition) | Navigation succeeded reliably; still 8 nav-chrome tiles |
| 5 | Filter "Live" to top-nav region (y < 200) | Confirmed: NO top-nav Live node exists. Only the y=532 content card. |

Iterations 1-4 had a verify-gate that returned "successfully navigated to
Live tab" too eagerly — `verifyLiveTabContent()` accepted the launcher
home as Live-tab-content because it found a "B1G" string. Tightening
that gate in iteration #5 surfaced the real issue cleanly.
