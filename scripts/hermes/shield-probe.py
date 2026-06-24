#!/usr/bin/env python3
"""
Deep NVIDIA Shield monitor — captures the Shield's full operational state to the Honcho
fleet-ops flywheel so Hermes builds + maintains a "PhD" on the Shield over time. Goes far
beyond the generic firetv-probe: Scout/accessibility binding, HDMI-CEC, stay-awake, ADB
connection health, current foreground app, and streaming-app inventory.

Runs ON the box that has LAN ADB access to the Shield (e.g. the Lime Kiln app box).
Usage: shield-probe.py [SHIELD_IP] [LABEL]   default 192.168.5.134 / lime-kiln-shield
"""
import sys, subprocess, json, urllib.request

IP = sys.argv[1] if len(sys.argv) > 1 else "192.168.5.134"
LABEL = sys.argv[2] if len(sys.argv) > 2 else "lime-kiln-shield"
D = f"{IP}:5555"
ADB = "/usr/bin/adb"
HONCHO = "http://100.90.175.125:8000"
KEY_APPS = {
    "com.espn.score_center": "ESPN", "com.amazon.amazonvideo.livingroom.nvidia": "Prime",
    "com.netflix.ninja": "Netflix", "com.hulu.livingroomplus": "Hulu",
    "com.peacocktv.peacockandroid": "Peacock", "com.cbs.ott": "Paramount+",
    "com.playon.nfhslive.googletv": "NFHS", "com.plexapp.android": "Plex",
    "com.google.android.youtube.tv": "YouTubeTV", "com.sportsbar.scout": "Scout",
}

def sh(cmd, t=15):
    try:
        return subprocess.run([ADB, "-s", D, "shell", cmd], capture_output=True, text=True, timeout=t).stdout.strip()
    except Exception:
        return ""

# ensure connected
try:
    subprocess.run([ADB, "connect", D], capture_output=True, text=True, timeout=12)
except Exception:
    pass
state = subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout
adb_state = "device" if f"{D}\tdevice" in state else ("unauthorized" if f"{D}\tunauthorized" in state else "OFFLINE")

if adb_state != "device":
    summary = f"Shield monitor @ {LABEL} ({IP}): ⚠ ADB {adb_state} — cannot reach. (Shield drops :5555 during playback/sleep; reconnect needed.)"
else:
    model = sh("getprop ro.product.model") + " / " + sh("getprop ro.product.device")
    rel = sh("getprop ro.build.version.release")
    cur = ""
    foc = sh("dumpsys window 2>/dev/null | grep mCurrentFocus | head -1")
    for tok in foc.replace("}", " ").split():
        if "/" in tok and "." in tok:
            cur = tok
    a11y = sh("settings get secure enabled_accessibility_services")
    scout_bound = "yes" if "scout" in sh("dumpsys accessibility 2>/dev/null").lower() else "NO"
    stayon = sh("settings get global stay_on_while_plugged_in")
    wake = "awake" if "Awake" in sh("dumpsys power 2>/dev/null | grep mWakefulness | head -1") else "asleep?"
    cec = "yes" if "hdmi_control" in sh("service list 2>/dev/null | grep hdmi_control") else "no"
    pkgs = sh("pm list packages 2>/dev/null")
    present = [name for p, name in KEY_APPS.items() if p in pkgs]
    missing = [name for p, name in KEY_APPS.items() if p not in pkgs]
    summary = (
        f"Shield monitor @ {LABEL} ({IP}): {model} Android {rel} | ADB ok | "
        f"foreground={cur or '?'} | Scout-bound={scout_bound} (a11y={a11y}) | "
        f"awake={wake} stayon={stayon} | CEC={cec} | "
        f"apps[{len(present)}]={','.join(present)}"
        + (f" | MISSING={','.join(missing)}" if missing else "")
    )

print(summary)
try:
    body = json.dumps({"messages": [{"peer_id": "hermes-shield-monitor", "content": summary}]}).encode()
    req = urllib.request.Request(f"{HONCHO}/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages",
                                 data=body, headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=10)
    print("→ captured to Honcho flywheel (peer=hermes-shield-monitor)")
except Exception as e:
    print(f"flywheel post failed: {e}")
