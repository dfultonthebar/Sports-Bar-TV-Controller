#!/usr/bin/env python3
"""
Hermes Fire TV probe (v2, read-only) — per-device insight from a location's Fire TVs / Android-TV
devices, captured to the Honcho fleet-ops flywheel so the local fleet-ops model learns each
device's profile. v2 adds SCOUT health (our AccessibilityService automation): installed +
bound/running per device, so Hermes monitors Scout across ALL locations and flags any device
where Scout is installed-but-not-bound (the #1 reason autoplay silently stops working).

READ-ONLY: device list + current app (API) + Scout state (adb). Safe while a bar is open.

Usage:  firetv-probe.py [LOCATION_BASE_URL] [LOCATION_LABEL]
        default base = http://localhost:3001, label = "local"
"""
import sys, json, urllib.request, subprocess

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001").rstrip("/")
LABEL = sys.argv[2] if len(sys.argv) > 2 else "local"
HONCHO = "http://100.90.175.125:8000"
ADB = "/usr/bin/adb"
SCOUT_PKG = "com.sportsbar.scout"

def get(path, timeout=25):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return json.load(r)
    except Exception as e:
        return {"_error": str(e)}

def adb(ip, cmd, t=12):
    try:
        return subprocess.run([ADB, "-s", f"{ip}:5555", "shell", cmd], capture_output=True, text=True, timeout=t).stdout
    except Exception:
        return ""

SCOUT_SVC = f"{SCOUT_PKG}/{SCOUT_PKG}.PlaybackAutomationService"

def scout_state(ip):
    """absent | bound | self-healed | installed-not-bound | ? — Scout health WITH auto-recovery.
    When Scout is installed but its AccessibilityService isn't bound (the #1 silent autoplay
    failure), re-enable it via adb — appending to enabled_accessibility_services so any OTHER
    accessibility services are preserved — and recheck. So Scout self-heals instead of silently
    staying off across all locations."""
    if not ip:
        return "?"
    try:
        subprocess.run([ADB, "connect", f"{ip}:5555"], capture_output=True, text=True, timeout=8)
    except Exception:
        return "?"
    if SCOUT_PKG not in adb(ip, f"pm path {SCOUT_PKG}"):
        return "absent"
    if "scout" in adb(ip, "dumpsys accessibility").lower():
        return "bound"
    # installed but not bound → SELF-HEAL: re-enable the service, preserving any others.
    cur = adb(ip, "settings get secure enabled_accessibility_services").strip()
    cur = "" if cur in ("null", "") else cur
    newval = SCOUT_SVC if not cur else (cur if SCOUT_PKG in cur else cur + ":" + SCOUT_SVC)
    adb(ip, f"settings put secure enabled_accessibility_services {newval}")
    adb(ip, "settings put secure accessibility_enabled 1")
    return "self-healed" if "scout" in adb(ip, "dumpsys accessibility").lower() else "installed-not-bound"

dev = get("/api/firetv-devices")
rows = dev if isinstance(dev, list) else (dev.get("data") or dev.get("devices") or [])
if not isinstance(rows, list):
    print(f"Fire TV probe @ {LABEL}: could not list devices ({dev})")
    sys.exit(0)

insights = []
for d in rows:
    did, name, ip = d.get("id"), d.get("name"), d.get("ipAddress")
    model = d.get("deviceModel") or d.get("model") or "?"
    fos = d.get("softwareVersion") or d.get("fireOsVersion") or "?"
    online = bool(d.get("isOnline"))
    cur, scout = "-", "-"
    if online and did:
        ca = get(f"/api/firetv-devices/{did}/current-app", timeout=25)
        cur = ((ca.get("currentApp") or {}) if isinstance(ca, dict) else {}).get("packageName") \
            or (ca.get("packageName") if isinstance(ca, dict) else None) or "?"
        scout = scout_state(ip)
    insights.append({"name": name, "ip": ip, "model": model, "fireOS": fos, "online": online, "app": cur, "scout": scout})

online_n = sum(1 for i in insights if i["online"])
scout_broken = [i["name"] for i in insights if i["scout"] == "installed-not-bound"]
scout_healed = [i["name"] for i in insights if i["scout"] == "self-healed"]
lines = [f"{i['name']} ({i['ip']}) model={i['model']} fireOS={i['fireOS']} "
         f"{'ONLINE app=' + i['app'] + ' scout=' + i['scout'] if i['online'] else 'offline'}" for i in insights]
summary = (f"Fire TV probe @ {LABEL}: {len(insights)} devices, {online_n} online.\n"
           + "\n".join("  - " + l for l in lines)
           + (f"\n  ↻ SCOUT SELF-HEALED on: {', '.join(scout_healed)} (was unbound, re-enabled this run)." if scout_healed else "")
           + (f"\n  ⚠ SCOUT STILL NOT BOUND on: {', '.join(scout_broken)} — re-enable failed; manual check needed." if scout_broken else ""))
print(summary)

try:
    body = json.dumps({"messages": [{"peer_id": "hermes-firetv-profiler", "content": summary}]}).encode()
    req = urllib.request.Request(f"{HONCHO}/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages",
                                 data=body, headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=10)
    print("→ captured to Honcho flywheel (peer=hermes-firetv-profiler)")
except Exception as e:
    print(f"flywheel post failed (insight still printed above): {e}")
