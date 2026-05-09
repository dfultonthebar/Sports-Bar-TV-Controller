# Scout Tree Dump — Diagnostic Capture

**Added in:** Scout APK v2.2.1 (host v2.33.7+)

**Purpose:** Dump the current AccessibilityNodeInfo tree from a Cube's
foreground window to logcat **and** POST it as JSON to the host server.
Used when we need ground-truth node structure (text/desc/viewId/bounds/
flags) before writing reliable Scout AS selectors — most importantly,
the PVFTV-320+ launcher home Sports-tab nav.

## How to capture

### 1. Ensure prerequisites

Scout v2.2.1+ installed on the Cube and AccessibilityService enabled:

```bash
TARGET_IP=10.11.3.50   # adjust per Cube
SVC=com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService

adb -s ${TARGET_IP}:5555 shell "dumpsys package com.sportsbar.scout | grep versionName"
adb -s ${TARGET_IP}:5555 shell "settings put secure enabled_accessibility_services ${SVC}"
adb -s ${TARGET_IP}:5555 shell "settings put secure accessibility_enabled 1"
```

### 2. Bring the target window to foreground

For PVFTV-320 launcher home (the typical case):

```bash
adb -s ${TARGET_IP}:5555 shell "input keyevent 3"   # HOME
sleep 4                                              # let launcher render
```

For an arbitrary app:

```bash
adb -s ${TARGET_IP}:5555 shell "am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n <pkg>/<activity>"
sleep 4
```

### 3. Trigger the dump

```bash
# Dump the launcher home tree
adb -s ${TARGET_IP}:5555 shell "am broadcast \
  -a com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE \
  -n com.sportsbar.scout/.TreeDumpReceiver \
  --es trigger lucky_cube_1_pvftv320"

# OR dump whatever's currently foreground:
adb -s ${TARGET_IP}:5555 shell "am broadcast \
  -a com.sportsbar.scout.ACTION_DUMP_AS_TREE \
  -n com.sportsbar.scout/.TreeDumpReceiver \
  --es trigger after_sports_click"
```

The `--es trigger <label>` extra is optional but useful — it appears
in the dump JSON's `trigger` field and in the saved filename so you
can keep multiple captures separated.

### 4. Get the result

**Logcat output** (immediate, every dump logs an INTERESTING summary):

```bash
adb -s ${TARGET_IP}:5555 logcat -d -s TreeDumper:* TreeDumpReceiver:* | tail -80
```

You'll see a summary like:

```
TreeDumper: dumpTree: trigger=lucky_cube_1_pvftv320 root=com.amazon.tv.launcher nodes=412
TreeDumper: [INTERESTING] [TN] idx=14 cls=ComposeView id=top_nav_home text='Home' bounds=120,54,247,118 click=true focus=true sel=true
TreeDumper: [INTERESTING] [TN] idx=22 cls=ComposeView id=top_nav_sports text='Sports' bounds=540,54,665,118 click=true focus=true sel=false
...
TreeDumpReceiver: Tree dump POST ok (200) → http://10.11.3.100:3001/api/firestick-scout/tree-dump (bytes=51234 nodes=412)
```

**Server-side JSON file** (full tree, persisted to disk):

```bash
# On the host:
ls -lh /home/ubuntu/Sports-Bar-TV-Controller/apps/web/data/tree-dumps/
# or via API:
curl -s http://localhost:3001/api/firestick-scout/tree-dump | jq
```

Files are named:
```
<takenAtUnix>_<deviceId>_<rootPackage>_<trigger>.json
e.g.  1715250000_firetv_1741700000005_luckys1_com.amazon.tv.launcher_lucky_cube_1_pvftv320.json
```

## What's in the dump

Top-level fields:

| field | description |
|---|---|
| `scoutVersion` | Scout APK version that wrote the dump |
| `deviceId` | Scout's deviceId (resolved server-side via IP→FireTVDevice lookup if Scout sent `fire-tv-unknown`) |
| `resolvedDeviceId` | The canonical deviceId after IP resolution |
| `takenAtUnix` | Capture timestamp (Cube clock) |
| `trigger` | The label passed via `--es trigger`, or the action name |
| `rootPackage` | Foreground package at the time of dump |
| `rootClassName` | Activity class |
| `screenSize` | Pixel dimensions of the active window |
| `nodeCount` | Total nodes traversed (DFS, capped at 4000) |
| `nodes` | Array of node objects |

Each `node` object:

| field | description |
|---|---|
| `idx` / `parentIdx` | Position in DFS, link to parent |
| `depth` | Depth in tree (0 = root) |
| `package` / `className` / `viewId` | Standard accessibility node identity |
| `text` / `desc` | Visible text + content-description |
| `bounds` | `left,top,right,bottom` in screen pixels |
| `isClickable` / `isFocusable` / `isFocused` / `isSelected` / `isCheckable` / `isChecked` / `isEnabled` / `isVisible` / `isAccessibilityFocused` / `isLongClickable` / `isScrollable` | Accessibility flags |
| `childCount` | Number of children |

## Use case: writing PVFTV-320 launcher home selectors

1. Boot a Lucky's PVFTV-320 Cube (1 or 2). Verify Scout v2.2.1+ + AS enabled.
2. Press HOME, wait 4s for launcher to render.
3. Trigger `ACTION_DUMP_LAUNCHER_TREE` with `--es trigger lucky_cube_1_home`.
4. Pull the JSON from `apps/web/data/tree-dumps/`.
5. Paste it into the next session — Claude writes selectors from real data.
6. Then: bring up the Sports tab manually (DPAD UP, RIGHT, CENTER) and dump again with `--es trigger lucky_cube_1_sports_tab` so we can compare and find what differs.

The diff between "home tab selected" and "sports tab selected" tells us
exactly which `viewId`/text pattern the navigator should target and
which selected-state we should verify against.

## Privacy / scope

`TreeDumpReceiver` snapshots ONLY the current foreground window, and
ONLY for packages declared in `playback_automation_service_config.xml`'s
`packageNames` filter (ESPN / NFHS / firebat / launcher). Switching to
a different app (e.g. Settings) before dumping returns "no_root_in_active_window"
because the AS doesn't receive events from un-listed packages.

The dump is PII-safe: it captures launcher chrome and tile labels, no
account info, no playback content.
