#!/usr/bin/env python3
"""
scan-directv-channels.py — monthly DirecTV channel-health audit (RELIABLE method).

Runs ON a box that has DirecTV receivers. Reads the box's directv ChannelPresets
+ DirecTVDevice IPs from production.db, probes each preset's channel against the
receivers, and reports:
  - COLLISIONS  (>1 preset on the same channel number — DB-level, always reliable)
  - DEAD        (channel returns a clean "Channel does not exist." across retries)

CRITICAL (learned 2026-06-30): DirecTV SHEF receivers TIME OUT under concurrent
probing. A naive parallel scan of ONE receiver false-flags valid channels (ESPN/
NFL/USA) as dead. So we DISTRIBUTE probes one-per-receiver across ALL boxes
(<=1 concurrent request per receiver) + retry, and only a clean "does not exist"
counts as DEAD — HTTPError/timeout = INCONCLUSIVE (never deleted/flagged).

No-op (exit 0) on a box with no DirecTV devices. Read-only: never edits presets;
it REPORTS so a human (or Hermes) can act. Output is concise when clean so a
monthly cron only makes noise when something actually drifted.
"""
import sqlite3, json, urllib.request, time, threading, collections, sys, os

DB = os.environ.get("PROD_DB", "/home/ubuntu/sports-bar-data/production.db")

def main():
    try:
        con = sqlite3.connect(DB); cur = con.cursor()
        ips = [r[0] for r in cur.execute("SELECT ipAddress FROM DirecTVDevice ORDER BY ipAddress").fetchall()]
        presets = cur.execute("SELECT name, channelNumber FROM ChannelPreset WHERE deviceType='directv'").fetchall()
        con.close()
    except Exception as e:
        print(f"DTV-SCAN: DB read failed: {e}"); return 0
    host = os.uname().nodename
    if not ips:
        print(f"DTV-SCAN [{host}]: no DirecTV devices — nothing to scan."); return 0

    chans = sorted({c for _, c in presets})
    result = {}
    def probe_one(ip, ch):
        major, minor = ch, None
        for sep in ('-', '.'):
            if sep in ch:
                major, minor = ch.split(sep, 1); break
        q = f"http://{ip}:8080/tv/getProgInfo?major={major}" + (f"&minor={minor}" if minor else "")
        r = urllib.request.urlopen(q, timeout=12)
        return json.loads(r.read().decode()).get("status", {}).get("msg", "?")
    def worker(ip, my):
        for ch in my:
            state = "INCONCLUSIVE"
            for _ in range(3):
                try:
                    msg = probe_one(ip, ch)
                    state = "OK" if msg == "OK." else ("DEAD" if "does not exist" in msg.lower() else "INCONCLUSIVE")
                    if state in ("OK", "DEAD"): break
                except Exception:
                    time.sleep(0.5)
            result[ch] = state
    buckets = {ip: [] for ip in ips}
    for i, ch in enumerate(chans):
        buckets[ips[i % len(ips)]].append(ch)
    threads = [threading.Thread(target=worker, args=(ip, buckets[ip])) for ip in ips]
    for t in threads: t.start()
    for t in threads: t.join()

    bych = collections.defaultdict(list)
    for n, c in presets: bych[c].append(n)
    collisions = {c: v for c, v in bych.items() if len(v) > 1}
    dead = [(c, bych[c]) for c in chans if result.get(c) == "DEAD"]

    issues = bool(collisions) or bool(dead)
    tag = "⚠ ISSUES" if issues else "✓ clean"
    print(f"DTV-SCAN [{host}] {tag}: {len(presets)} directv presets, {len(ips)} receivers, "
          f"{len(collisions)} collision(s), {len(dead)} confirmed-dead.")
    if dead:
        print("  CONFIRMED-DEAD (channel no longer exists — fix/remove these presets):")
        for c, names in sorted(dead): print(f"    {c}: {', '.join(names)}")
    if collisions:
        print("  COLLISIONS (multiple presets on one channel):")
        for c, names in sorted(collisions.items()): print(f"    {c}: {', '.join(names)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
