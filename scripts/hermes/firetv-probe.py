#!/usr/bin/env python3
"""
Hermes Fire TV probe (v1, read-only) — gathers per-device insight from a location's
Fire TVs and captures it to the Honcho fleet-ops flywheel so the local fleet-ops model
learns each device's profile over time.

READ-ONLY: only queries device list + current foreground app. Does NOT launch/change
anything, so it is safe to run while a bar is open. (Active autoplay-timing tests —
which DO change a TV — are a separate off-hours mode, added later.)

Usage:  firetv-probe.py [LOCATION_BASE_URL] [LOCATION_LABEL]
        default base = http://localhost:3001, label = "local"
"""
import sys, json, urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001").rstrip("/")
LABEL = sys.argv[2] if len(sys.argv) > 2 else "local"
HONCHO = "http://100.90.175.125:8000"

def get(path, timeout=25):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return json.load(r)
    except Exception as e:
        return {"_error": str(e)}

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
    cur = "-"
    if online and did:
        ca = get(f"/api/firetv-devices/{did}/current-app", timeout=25)
        cur = ((ca.get("currentApp") or {}) if isinstance(ca, dict) else {}).get("packageName") \
            or (ca.get("packageName") if isinstance(ca, dict) else None) or "?"
    insights.append({"name": name, "ip": ip, "model": model, "fireOS": fos, "online": online, "app": cur})

online_n = sum(1 for i in insights if i["online"])
lines = [f"{i['name']} ({i['ip']}) model={i['model']} fireOS={i['fireOS']} "
         f"{'ONLINE app=' + i['app'] if i['online'] else 'offline'}" for i in insights]
summary = (f"Fire TV probe @ {LABEL}: {len(insights)} devices, {online_n} online.\n"
           + "\n".join("  - " + l for l in lines))
print(summary)

try:
    body = json.dumps({"messages": [{"peer_id": "hermes-firetv-profiler", "content": summary}]}).encode()
    req = urllib.request.Request(f"{HONCHO}/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages",
                                 data=body, headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=10)
    print("→ captured to Honcho flywheel (peer=hermes-firetv-profiler)")
except Exception as e:
    print(f"flywheel post failed (insight still printed above): {e}")
