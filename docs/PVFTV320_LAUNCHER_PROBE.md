# PVFTV-320 Launcher Probe — real findings (Lucky's Cube 1, 2026-05-09)

This doc replaces the educated guesses in the v2.2.0 LauncherNavigator
design with verified data from a live probe of Lucky's Cube 1
(192.168.10.42, AFTR model, PVFTV-320.0001-L firebat).

Reproduce: `bash /tmp/probe-pvftv320-launcher.sh <CUBE_IP>` (script in
git history of the v2.33.4 work). XML dumps land in `/tmp/luckys-probe/`.

---

## Activity

```
com.amazon.tv.launcher/com.amazon.tv.launcher.ui.HomeActivity_vNext
```

This is what the leanback-launcher resolver returns for `com.amazon.firebat`
(via `cmd package resolve-activity --brief -c LEANBACK_LAUNCHER`). On
PVFTV-320, firebat IS the launcher — there is no separate Prime Video
activity to navigate into.

---

## Top nav (NEW 2026 layout — different from older PVFTV-215)

The top nav strip has THREE tabs (not five as on older builds):

| Position | content-desc | Purpose |
|---|---|---|
| 1 | `Home` | Launcher home (default) |
| 2 | `Find` | Search |
| 3 | `Live` | **Live aggregated content — Prime Video Live + others** |

Note: **there is NO "Sports" tab** in the 2026 PVFTV-320 launcher. The
"Movies" and "TV shows" tabs from older builds have been merged. **The
"Live" tab is where live sports content is aggregated**, drawing from
Prime Video, NFL on Prime, Live TV providers, etc.

Implication for v2.2.0: target the "Live" tab, not a non-existent
"Sports" tab.

---

## Verified resource IDs (com.amazon.tv.launcher:id/...)

These are the IDs actually present in the PVFTV-320 launcher tree:

| Resource ID | Purpose |
|---|---|
| `fragment_horizontal_nav` | Top nav row (Home / Find / Live) |
| `menu_apps_gridview` | Apps grid (Prime Video, Netflix, etc. tiles) |
| `featured_item_rotator` | Hero carousel (rotates promotional content) |
| `featured_item_rotator_view_compose` | Compose-rendered hero card |
| `grid_layout` | Per-row content layouts |
| `container_list` | Vertical scroll container |
| `nav_bar_app_overflow` | "More apps" overflow chip |
| `nav_bar_settings` | Settings gear |
| `nav_container` | Top nav container parent |
| `image_icon_badge` | Per-app badge overlay |
| `layout_jarvis_badged_view_slim` | App icon + badge wrapper |
| `default_layer` | Background layer (ignore) |

These should be the v2.2.0 LauncherNavigator's primary selectors.
Text/contentDescription is the fallback.

---

## What's NOT in the tree (and why blind DPAD is wrong)

The probe did 3 UPs (to escape hero) + 3 RIGHTs (to walk top nav). Final
state: foreground became
`com.amazon.shoptv.firetv.client/com.amazon.shoptv.ui.dp.DetailActivity`
— a Tubi/shop detail page.

**Conclusion:** "3 RIGHTs from launcher home" does NOT land on Prime
Video. Walking blindly through DPAD events lands on whichever tile
happens to be in that screen position, which depends on:
- Recently-used apps re-ordering
- Hero rotator state
- Sponsored-content placement

**v2.2.0 must FIND the Prime Video tile by content-desc match in the
`menu_apps_gridview`, not assume position.**

---

## Sample content-desc values seen on launcher home

(Not exhaustive; varies with hero rotator state)

| content-desc | Type |
|---|---|
| `Home` | nav tab |
| `Find` | nav tab |
| `Live` | nav tab |
| `Prime Video` | app tile in apps grid |
| `Tubi: Watch Free Movies & TV Shows` | app tile |
| `Lakeside Mysteries on MHz Networks. Play now on Prime Video. Subscription Required. TV-14.` | hero carousel content |
| (...) | other apps not captured in this probe |

---

## Updated v2.2.0 LauncherNavigator strategy

```
gotoPrimeVideoSports() →

  Strategy 1: Navigate the "Live" top tab (preferred — broader sports coverage)
    - Find the top nav row: root.findAccessibilityNodeInfosByViewId(
        "com.amazon.tv.launcher:id/fragment_horizontal_nav")
    - Within that row, find the node with content-desc="Live"
    - performAction(ACTION_FOCUS) on it; if not focusable, walk to a
      focusable ancestor and focus that
    - DPAD_CENTER to activate the tab
    - Wait for content render (4-5s — Live tab loads aggregated content
      from multiple providers)
    - Verify: focused tab now has content-desc containing "Live", AND
      the visible tree has at least 1 row with sports keywords (vs/@,
      league names, "Live now")

  Strategy 2 (fallback): Open Prime Video tile + navigate within
    - Find the apps grid: ...findAccessibilityNodeInfosByViewId(
        "com.amazon.tv.launcher:id/menu_apps_gridview")
    - Within it, find node where content-desc equals "Prime Video"
    - Click via clickable ancestor walk
    - Wait 4s for the Prime Video showcase to render
    - Within the showcase, find a "Live" or "Sports" node (showcase
      may have its OWN nav strip with these labels)
    - This path may not exist on PVFTV-320 if firebat truly has no
      separate showcase; would land back on the launcher.
```

**Recommend Strategy 1 for v2.2.0 first cut.** It's simpler (one
navigation, one extract), targets a known-existing tab, and matches the
operator's intent (live sports content per-Cube). If the Live tab's
extracted tiles are mostly news/general-live (not sports), revisit and
add Strategy 2 as a deeper drill.

---

## Recommended next-session task list

1. Implement `LauncherNavigator.kt` Strategy 1 grounded in these
   verified resource IDs + the "Live" tab nav.
2. `CatalogSnapshotService.kt` runs the snapshot on demand via a new
   broadcast `com.sportsbar.scout.SNAPSHOT_NOW` (skip the 6h periodic
   schedule for the first iteration — test via on-demand only).
3. Build APK on Holmgren (JDK 17), install ONLY on Lucky's Cube 1
   (192.168.10.42). DO NOT fleet-roll yet.
4. Manually trigger:
   ```
   adb -s 192.168.10.42:5555 shell "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW \
     -n com.sportsbar.scout/.SnapshotCommandReceiver"
   ```
5. Watch `adb logcat -s LauncherNav:* CatalogSnapshot:*` while it runs.
6. Iterate based on what the probe + actual nav reveals (likely 2-3
   iterations of refinement before navigation lands cleanly).
7. Once Cube 1 produces tiles → install on Cube 2 (also PVFTV-320),
   verify the same code path works.
8. Then PVFTV-215 path on Holmgren Cube 2 (verify regression-safe).
9. Fleet roll only after both PVFTV variants pass on representative
   Cubes.

---

## Why this isn't shipping in this session

Honest scoping: even with the probe data in hand, building + iterating
the LauncherNavigator against real PVFTV-320 launcher behavior is a
multi-iteration loop. Each iteration: edit Kotlin → rebuild APK →
install → trigger snapshot → grep logs → adjust. ~15-30min per cycle,
typically 4-6 cycles before nav lands reliably. That's a focused 2-3h
session of nothing else.

Plus we'd want to gate the implementation on:
- The "Live" tab content actually contains sports (not just news/general).
  Operator's bar likely has Prime NBA / Premier League / NFL — verify
  on Lucky's specifically.
- Whether `findAccessibilityNodeInfosByViewId` works on PVFTV-320
  launcher (some launchers strip viewIds at runtime; we'd fall back
  to text matching).

Better to do this with a clear-headed dedicated session than rush it
at end-of-session. The probe data captured here is the high-value
artifact for that next session.
