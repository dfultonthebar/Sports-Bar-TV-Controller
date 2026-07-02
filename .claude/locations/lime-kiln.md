# Lime Kiln Hardware Reference

**Branch:** `location/lime-kiln`
**Status:** Active — 7th fleet box, fresh v3.1.0 subiquity-autoinstall ISO install (2026-06-10)
**Tailscale:** `lime-kiln-sports-bar-controller` / `100.89.6.80`

DB is the source of truth — see CLAUDE.md §6 (Device Data Migration) and `apps/web/src/lib/device-db.ts`. Values below mirror the DB as a quick reference; if they drift, trust the DB.

## Matrix — Wolf Pack (in progress, 2026-07-02)

- **Model:** FM36 (as reported by the operator on-site — confirm against the model label the next time someone is physically at the box; other fleet locations use `WP-8X8`/`WP-16X16`/`WP-36X36` naming, "FM36" may be a variant/shorthand for this unit).
- **IP:** `192.168.5.102`
- **Audio outputs: 33–36** — matches the multi-card pattern used elsewhere in the fleet (compare Holmgren's outputs 37-40 being audio-only, per CLAUDE.md Gotcha #4). This means Lime Kiln is **NOT** a single-card `outputOffset=0` layout like Leg Lamp/Lucky's — it needs real `outputOffset`/`audioOutputCount` values once the matrix is fully wired and entered into `MatrixConfiguration`.
- **Not yet configured in the DB** as of this writing — the IP/model/output range above are what the operator reported having physically brought up; the app-side `MatrixConfiguration` row, input/output mapping, and `MATRIX_SINGLE_CARD` env flag still need to be set before routing will work. **Do not assume `outputOffset=0`** — per CLAUDE.md Gotcha #4, guessing wrong here causes silent misrouting to the wrong physical TVs.
- **Next step when ready:** confirm full input/output count and physical wiring layout with the operator, then set `MatrixConfiguration` (model, outputOffset, audioOutputCount) and update the table in CLAUDE.md Gotcha #4's per-location reference.

## Per-location operational facts

| Field | Value | Source |
|---|---|---|
| Hardware | Intel Iris Xe (Raptor Lake-P) iGPU, 31 GB RAM, 8 GB swap, 931 GB NVMe | project_lime_kiln memory |
| OS | Ubuntu 24.04.4 LTS, UEFI | project_lime_kiln memory |
| LOCATION_ID | `49717730-ae64-4920-8bce-22be4c3d18e2` | project_lime_kiln memory |
| Admin PIN | 7819 | project_lime_kiln memory (operator-set 2026-06-10, rotate later) |
| Staff PIN | 1234 | project_lime_kiln memory |
| Channel presets | 107 seeded from Holmgren Way (Green Bay market), cable=36 directv=71, ch308="Bally Sports Wisconsin+" | project_lime_kiln memory |
| Auto-update schedule | `0 4 * * *` (04:00 CDT, DB `schedule_cron` fallback — not in `fleet-schedule.json`) | project_lime_kiln memory |
| systemd TimeoutStartSec | 45min (fixed 2026-07-02, v2.95.5) | this session |

## Recent operational history

- **2026-07-01: power outage.** Box went offline, hub showed `critical`/stale. Recovered on its own once power/network returned — see `project_lime_kiln` memory for the full note.
- **2026-07-01/02: was stuck on v2.93.0 for 3+ consecutive nights** due to the fleet-wide systemd `TimeoutStartSec` bug (v2.95.5 fix) — the cron-jitter sleep routinely exceeded the old 15-minute timeout and got silently killed. Fixed + verified live: real cron-triggered update completed successfully in 147s (2026-07-02).

## Source / Display / Audio Devices

> Populate from the live DB the next time work is being done at this location:
>
> ```bash
> sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
> .headers on
> .mode column
> SELECT name, ipAddress, port FROM FireTVDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM DirecTVDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM IRDevice ORDER BY name;
> SELECT '---' as separator;
> SELECT name, ipAddress, port FROM AudioProcessor;
> SQL
> ```

## Pulling Latest Updates

Prefer `bash scripts/auto-update.sh --triggered-by=manual_cli` — handles the conflict resolution, schema push, cache bust, PM2 restart, and verify gate automatically.

## Cross-References

- CLAUDE.md §4 — Matrix Config Per-Location Values (CRITICAL — outputOffset)
- CLAUDE.md §6 — Device Data Migration (JSON → DB)
- `docs/EQUIPMENT_SETUP_PLAYBOOK.md` §2 (Wolf Pack) + §1 (new-location bootstrap)
- `docs/FLEET_STATUS.md` — current OS/version/iGPU status
- `scripts/verify-install.sh` — the install gate
- `.claude/locations/leg-lamp.md`, `.claude/locations/lucky-s-1313.md` — single-card comparison locations
