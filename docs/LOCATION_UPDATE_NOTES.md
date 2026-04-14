# Location Update Notes

**Purpose:** This file is the per-release "what you need to know before you
update" changelog for location deployments. It is read by Claude Code during
auto-update Checkpoint A as required context, so whatever is documented here
will be factored into the GO/CAUTION/STOP decision on every location's
update run.

**Format:** newest entries at the top. Each entry documents a single push to
`main` (or a coherent group of related pushes) with:

- **Date + tip SHA** — for cross-reference with `git log`
- **What changed** — one-line summary of the user-visible changes
- **What could break at a location** — honest risk assessment per location
- **Manual steps required** — anything the auto-updater CAN'T do automatically
- **Rollback notes** — if this update proves bad, how to back out
- **Affected files** — so Claude can correlate with the incoming diff

**How to add an entry:**

```bash
bash scripts/add-update-note.sh
```

or manually prepend a new section below the "Current entries" marker.

**How Claude uses it:**

Checkpoint A reads the top 3-5 entries of this file (the most recent pushes
since the location last updated). If any entry's "What could break" section
mentions a risk that matches the incoming diff, Claude will flag it as
CAUTION or STOP with a direct citation. This is the mechanism by which
location-specific risks are surfaced BEFORE the merge touches disk.

**Cutoff:** entries older than 30 days can be pruned. This is a living
decision log, not a permanent archive. Git history is the archive.

---

## Current entries

### 2026-04-14 — `ee9c63c0` — CAUTION: location-data reconciliation bug + install fixes

**Risk:** CAUTION — one corrective data commit already applied to
location/stoneyard-greenville; NO action needed on other location
branches UNLESS an operator does a naive `git merge main` instead of
running `scripts/auto-update.sh`.

**What happened at Stoneyard (for context so you know what to watch for):**

During the 2026-04-14 main-vs-location reconciliation session, I
branched a `reconcile-main` branch FROM `location/stoneyard-greenville`'s
tip, blanked the location-data files on it (tv-layout.json,
wolfpack-devices.json, channel-presets-*.json), and force-pushed
that as `main`. Later, when `main` was merged back into
`location/stoneyard-greenville` via a plain `git merge main` that did
NOT use the auto-update script's LOCATION_PATHS_OURS conflict
resolver, git saw the blanking as a clean tree change (no conflict to
trip on) and the location branch's real hardware data got wiped:

  tv-layout.json           3843 → 61 bytes (20 TV zones erased)
  wolfpack-devices.json     407 → 15 bytes (chassis config erased)
  channel-presets-cable.json   17745 → 15 bytes (62 presets erased)
  channel-presets-directv.json 15487 → 15 bytes (54 presets erased)

Visible symptom: the bartender remote Video tab and /layout-editor
page showed an empty TV map because the layout API reads
tv-layout.json directly at request time.

Fixed on Stoneyard by commit 54463a72 which restored all four files
from 5fb25f19 (the commit immediately before reconcile). This commit
is on location/stoneyard-greenville ONLY — never cherry-picked to
main, and will never be because it contains Stoneyard-specific
hardware data.

**What this means for the other 3 locations (graystone, holmgren-way,
lucky-s-1313):**

- **You were NOT affected.** I audited all three branches on 2026-04-14:
  none of them have the reconcile commit (7f13fbe7) in their ancestry,
  and all three still have their real tv-layout.json / directv-devices
  / firetv-devices data intact.

- **But when you pull tonight's main for the first time, be careful.**
  Main now has empty templates for tv-layout.json (61 bytes),
  wolfpack-devices.json (15 bytes), channel-presets-cable.json (15
  bytes), and channel-presets-directv.json (15 bytes). A naive
  `git merge main` from a shell will overwrite your location's real
  data the same way it happened to Stoneyard.

- **The correct merge path** is to let `scripts/auto-update.sh` handle
  it. That script has LOCATION_PATHS_OURS logic that runs
  `git checkout --ours <path>` on every location-data file in the
  merge conflict set, then `git add` + `git commit --no-edit` to
  finalize. It preserves the location's real data and takes main's
  software changes.

- **If you must merge manually**, do this instead of a plain
  `git merge main`:

  ```
  git merge origin/main --no-commit --no-ff
  for f in apps/web/data/tv-layout.json \
           apps/web/data/directv-devices.json \
           apps/web/data/firetv-devices.json \
           apps/web/data/device-subscriptions.json \
           apps/web/data/wolfpack-devices.json \
           apps/web/data/channel-presets-cable.json \
           apps/web/data/channel-presets-directv.json; do
    if [ -f "$f" ]; then git checkout HEAD -- "$f"; git add "$f"; fi
  done
  git commit --no-edit
  ```

  This explicitly restores each location-data file from your branch's
  HEAD after the merge, guaranteeing main's empty templates never
  land on your tree.

- **After any merge, verify** that the TV map still renders on the
  bartender remote Video tab AND that `apps/web/data/tv-layout.json`
  is >500 bytes. If either check fails, restore from your branch
  history the same way I restored Stoneyard:

  ```
  git log --oneline -- apps/web/data/tv-layout.json
  git show <last-good-commit>:apps/web/data/tv-layout.json \
    > apps/web/data/tv-layout.json
  git add apps/web/data/tv-layout.json
  git commit -m "data: restore tv-layout.json after merge"
  ```

**Other install fixes bundled in tonight's main** (safe to pull, no
action required beyond using the correct merge path above):

- `8445e47f` LG TVs now work with bartender All On/All Off (bulk-power
  route was missing `case 'lg':`)
- `ac58e3e4` ecosystem.config.js adds bartender-proxy as a second PM2
  app, verify-install.sh treats empty ChannelPreset as WARN not FAIL,
  runbook fixed to use `pm2 delete && pm2 start` instead of
  `pm2 restart --update-env` for env reload

**Manual steps required:** For each location pulling main for the
first time:
1. Use `scripts/auto-update.sh` (recommended) or the manual checkout
   loop above — NOT a plain `git merge main`.
2. After the merge, verify `apps/web/data/tv-layout.json` is >500
   bytes and the bartender remote Video tab shows the TV map.
3. If the bartender proxy on port 3002 wasn't running before,
   `pm2 delete bartender-proxy 2>/dev/null || true; pm2 start
   ecosystem.config.js` will pick up the new second app.

**Rollback notes:** If a location pulls main and the layout disappears,
the fix is `git show HEAD~1:apps/web/data/tv-layout.json >
apps/web/data/tv-layout.json && git add ... && git commit`. The old
data lives in git history — it's never permanently lost.

**Affected files:**

- `apps/web/data/tv-layout.json` (per-location, never to main)
- `apps/web/data/wolfpack-devices.json` (per-location)
- `apps/web/data/channel-presets-cable.json` (per-location)
- `apps/web/data/channel-presets-directv.json` (per-location)

---

### 2026-04-14 — `8445e47f` — Bartender All On/All Off now works for LG TVs (was silently failing)

**Risk:** MEDIUM — bug fix for a user-facing bartender action that had
been broken for any location with LG brand TVs.

**What changed:**

`/api/tv-control/bulk-power` (the endpoint the bartender remote's
"All On" / "All Off" buttons hit) previously had no `case 'lg':` in
its `controlDevicePower()` brand switch. LG TVs fell through to the
default branch which returned `${brand} not supported for bulk power`,
so every LG TV silently failed and the bartender saw no effect on the
wall.

The single-TV route at /api/tv-control/[deviceId]/power already had
a controlLGPower handler; this commit adds the same pattern to the
bulk route. LGTVClient.powerOn() uses Wake-on-LAN via the device's
MAC address (idempotent), LGTVClient.powerOff() uses WebSocket SSAP
to send `ssap://system/turnOff`.

Discovered on Stoneyard Greenville which has 19 LG TVs + 1 Samsung.
The Samsung power commands were working; the 19 LG TVs were the
visible problem.

**What could break at a location:**

- **None** — purely additive bug fix. Locations with LG TVs gain a
  working All On / All Off. Locations without LG TVs see zero change
  (the new case is brand-scoped).
- If a location has LG TVs but no MAC address in the DB row, the
  powerOn call will fail with "WOL failed: MAC required". Fix:
  populate networkTVDevices.macAddress for each LG TV row via the
  Device Config UI or the TV network discovery scan.

**Manual steps required:** None — next auto-update picks it up, or
re-run the build manually. Locations should verify MAC addresses are
populated for their LG TV rows before expecting "All On" to work —
WoL requires MAC.

**Rollback notes:** `git revert 8445e47f` (but you probably don't
want to — reverting restores the broken state where LG TVs silently
fail every bulk power command).

**Affected files:**

- `apps/web/src/app/api/tv-control/bulk-power/route.ts` — added LG case to
  controlDevicePower() switch + added LGTVClient to imports

---

### 2026-04-14 — `6f0a43d9` — 🎉 First successful end-to-end auto-update run (history id=14, 127s, pass)

**Risk:** none (milestone entry, not a code change)

**What changed:**

This is a marker entry for the first green auto-update run from
Stoneyard Greenville, produced by the auto-update orchestrator
itself (not an operator-typed commit). The merge commit
`6f0a43d9 chore: auto-update merge 2026-04-14-11-42` is the
output artifact of the orchestrator successfully flowing through
every phase of the pipeline.

Full 127-second run breakdown (history row id=14):
- preflight + fetch: <1s
- **checkpoint_a**: DECISION GO in 17s
- backup (DB snapshot + rollback tag): <1s
- merge with LOCATION_PATHS_OURS conflict auto-resolve: <1s
- version_check: <1s
- **npm ci --include=dev**: 10s, turbo present
- **checkpoint_b**: DECISION GO in 55s
- build (turbo cached): <1s
- **pm2_restart**: 20s, script detached via `setsid --fork` and
  survived the Next.js restart (PID still alive, PPID=1)
- verify-install.sh: PASS 6/6 in 2s
- **checkpoint_c**: DECISION GO in 22s (prompt now trusts
  verify-install output and treats sandbox denials as GO)
- finalize: <1s → history row transitioned from in_progress to pass

Every bug uncovered during tonight's 13 prior test runs is fixed
in the code paths exercised by this run:

1. `NODE_ENV=development npm ci --include=dev` (run id=8) — turbo
   installs despite PM2's NODE_ENV=production environment.
2. API route spawns via `setsid --fork` (runs id=10 and id=12) —
   auto-update.sh starts with PPID=1 in its own session/pgid and
   cannot be killed by `pm2 restart sports-bar-tv-controller`.
3. bash-level `exec setsid -f` as belt-and-suspenders for direct
   shell invocation paths.
4. Checkpoint A prompt trusts LOCATION_PATHS_OURS auto-resolve
   (run id=11 would have been rolled back by the old prompt's
   false-positive STOP on data-file modifications in the diff).
5. Checkpoint C prompt treats sandbox denials as GO instead of
   STOP, trusts verify-install.sh JSON output as authoritative
   (runs id=11 and id=13 rolled back at this step under the old
   prompt despite verify-install PASS 6/6).

**What could break at a location:**

- **None** — this entry is a milestone marker, not a code change.

**Manual steps required:** None.

**Rollback notes:** Not applicable.

**Affected files:** None (the merge commit itself is a content
no-op since location and main have the same tree — all the bug
fixes had already been cherry-picked to both branches before the
run started).

---

### 2026-04-14 — `8c148ce8` — auto-update: force NODE_ENV=development for npm ci

**Risk:** HIGH (this was a blocker for every auto-update run before this fix)

**What changed:**

Both `scripts/auto-update.sh` and `scripts/rollback.sh` now run
`NODE_ENV=development npm ci --include=dev` instead of plain `npm ci`.

The plain version inherited PM2's `NODE_ENV=production` and silently
skipped devDependencies, dropping `turbo` from node_modules. The next
`npm run build` then died with `sh: 1: turbo: not found` and triggered
an unnecessary rollback. First discovered on the first real end-to-end
auto-update attempt tonight (history id=8, rolled back at 23:02:34).

**What could break at a location:**

- **None** — the fix makes auto-update WORK where previously it was
  broken. Locations that have never successfully run auto-update
  before this commit will now be able to. Locations that already
  happen to have turbo installed (because they built outside the
  auto-update flow) will be unaffected.
- If a location is extremely disk-constrained, forcing devDependencies
  to install adds ~100 MB to node_modules. Not an issue for any
  current Sports Bar TV Controller deployment.

**Manual steps required:** None. The fix is in the script itself —
next run picks it up automatically.

**Rollback notes:** `git revert 8c148ce8`. But you probably don't
want to — reverting restores the broken state.

**Affected files:**

- `scripts/auto-update.sh` (npm_ci step)
- `scripts/rollback.sh` (npm ci step)

---

### 2026-04-14 — `726b766e` — Sign-out button uses POST fetch instead of GET link

**Risk:** low

**What changed:**

Clicking "sign out" on the System Admin auth banner returned HTTP 405
because it was a plain `<a href="/api/auth/logout">` (GET) but the
logout route only exports POST. Changed to a `<button>` with an
onClick handler that fetches POST with credentials, then redirects
to `/login`.

**What could break at a location:**

- **None** — purely a client-side UI fix in one component. No API
  contract change, no schema change, no new files.

**Manual steps required:** None.

**Rollback notes:** `git revert 726b766e`.

**Affected files:**

- `apps/web/src/app/system-admin/page.tsx` (AuthStatusBanner sign-out handler)

---

### 2026-04-14 — `7cd30e3d` — Per-commit update notes + version badge on System Admin

**Risk:** low

**What changed:**

- New `docs/LOCATION_UPDATE_NOTES.md` — per-commit changelog that
  Claude reads at Checkpoint A to factor risk into the decision.
- New `scripts/add-update-note.sh` — interactive helper to prepend
  entries to the notes file.
- Updated `scripts/prompts/checkpoint-a.txt` with Step 1.5 that
  requires Claude to read the notes entry for every pending commit.
- New `GET /api/system/version` endpoint returning package.json
  version, git branch, commit SHA + date, build date, uptime.
- New `<VersionBadge />` component at top of `/system-admin` that
  polls `/api/system/version` every 60s and shows the current
  running version.

**What could break at a location:**

- **None** — purely additive. New endpoint, new component, new docs,
  updated prompt. No existing runtime paths touched.

**Manual steps required:** None.

**Rollback notes:** `git revert 7cd30e3d`.

**Affected files:**

- `docs/LOCATION_UPDATE_NOTES.md` (new)
- `scripts/add-update-note.sh` (new, executable)
- `scripts/prompts/checkpoint-a.txt` (Step 1.5 added)
- `apps/web/src/app/api/system/version/route.ts` (new)
- `apps/web/src/app/system-admin/page.tsx` (VersionBadge component added)

---

### 2026-04-14 — `5380f7e7` — New-location bootstrap kit + doc + CLAUDE.md update

**What changed:**

- Added `scripts/bootstrap-new-location.sh` — idempotent helper for
  per-location auth bootstrap (creates `Location` row, seeds
  `AuthPin` STAFF/ADMIN rows, writes `LOCATION_ID` to `.env`,
  optionally creates the location git branch).
- Added `docs/NEW_LOCATION_SETUP.md` — full cold-start runbook from
  fresh Ubuntu host to auto-update enabled.
- Updated `CLAUDE.md` Multi-Location Deployment section with the
  corrected file list (including `channel-presets-*.json`), auth
  bootstrap subsection, and a warning about the reconciliation
  history.

**What could break at a location:**

- **Low risk** — purely additive (new script + new doc + CLAUDE.md
  documentation update). No existing files removed, no runtime code
  changes, no schema migrations.
- Existing locations that run the auto-update will get these as new
  files. None of the new files is imported or executed at runtime by
  the app; they are operator tooling only.

**Manual steps required:** None.

**Rollback notes:** `git revert 5380f7e7` or, if rolling main back
further, `git push origin main-archive-20260414:main --force-with-lease`.

**Affected files:**

- `scripts/bootstrap-new-location.sh` (new, executable)
- `docs/NEW_LOCATION_SETUP.md` (new)
- `CLAUDE.md` (Multi-Location Deployment section modified)

---

### 2026-04-14 — `7f13fbe7` — Reconcile main with location software state

**What changed:**

This is the catastrophic-scale reconciliation that brought `main`
back in sync with `location/stoneyard-greenville` after months of
drift. 81 files, 12K+ line changes.

For locations that were on a pre-reconcile `main` (i.e., anything
before this commit): the auto-update will pull in months of v2.4.x
evolution in a single merge. For locations that were branched from
`location/stoneyard-greenville` itself: this is a near-no-op because
they already had the v2.4.x work.

Specifically, the commit:

1. Replaced `main`'s tree with `location/stoneyard-greenville`'s
   software tree (all v2.4.0-2.4.9 work: Sports Guide Admin Phases
   A-D, AI Game Plan features, Fire TV streaming panel, Crestron DM
   matrix support, ESPN sync boot hook, scheduler fixes, channel-
   resolver consolidation, auto-update system).
2. Blanked location-data files to empty templates on `main`
   (`tv-layout.json`, `directv-devices.json`, `firetv-devices.json`,
   `device-subscriptions.json`, `wolfpack-devices.json`,
   `channel-presets-cable.json`, `channel-presets-directv.json`).
3. Deleted `apps/web/backup/location-data/` (stale DB backup that
   was accidentally committed).
4. Deleted `apps/web/src/app/api/matrix/config/route.ts.backup2`
   (Prisma-era cruft).
5. Hardened `.gitignore` with `*.apk`, `*.zip`, `*.sqlite`,
   `database_backups/`, `.claude/settings.local.json`, variant
   backup patterns.

**What could break at a location:**

- **MEDIUM risk** — the diff from a pre-reconcile `main` is enormous.
  The auto-update script's `LOCATION_PATHS_OURS` conflict resolver
  will handle the data files correctly (keeping the location's
  version), but be aware of these specifically:
  - `apps/web/src/lib/hardware-config.ts` — this file currently
    contains Stoneyard's device IPs in code (pre-existing tech debt).
    Locations that have customized this file locally WILL get a
    conflict. Resolution: `git checkout --ours` to keep the local
    version, then follow up by moving the constants to
    `data/hardware.json` as a proper per-location file.
  - `apps/web/data/*.json` — auto-resolved to `--ours` (location
    keeps its data).
  - `package-lock.json` + `package.json` — auto-resolved to
    `--theirs` (main's version; dependency sync).
- The v2.4.0 Sports Guide Admin consolidation deletes several old
  scheduler/sports-guide-config routes. If a location has bookmarked
  URLs, `/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, and
  `/scheduling` now redirect (via Next.js `redirects()`) to the new
  `/sports-guide-admin` page.
- The AuthPin login flow was fixed today — old cookies issued by the
  pre-fix app will still work until they expire (8 hours).

**Manual steps required:**

- Run `npx drizzle-kit push --config drizzle.config.ts` after the
  merge to apply any new DB tables. The v2.4.x work added
  `auto_update_state` and `auto_update_history` (singleton + append-
  only). Safe — they default to empty and gate on application logic.
- If `.env` doesn't have `LOCATION_ID`, set it using the bootstrap
  script or manually from the Location row's `id`.
- If `.env` doesn't have `AUTH_COOKIE_SECURE`, add it as `false`
  (required for HTTP LAN deployments).

**Rollback notes:**

The pre-reconcile state is preserved as `main-archive-20260414` on
origin. If something breaks catastrophically post-merge:

```bash
git fetch origin
git push origin main-archive-20260414:main --force-with-lease
# Then each location:
git checkout location/<name>
git reset --hard origin/location/<name>  # revert local merge
pm2 restart sports-bar-tv-controller --update-env
```

**Affected files:**

- 81 files across the entire tree — too many to list. `git diff --stat
  main-archive-20260414..7f13fbe7` will show the full picture.
- Highest-attention files: `apps/web/src/app/sports-guide-admin/page.tsx`
  (new), all `apps/web/src/components/admin/*.tsx` (new), `.gitignore`,
  all `apps/web/data/*.json` (blanked), `CLAUDE.md`.

---

### 2026-04-14 — `4bb259a8` — checkpoint-a prompt trusts LOCATION_PATHS_OURS

**What changed:**

Rewrote `scripts/prompts/checkpoint-a.txt` (the Claude Code CLI
pre-update review prompt) to know about the auto-updater's
`LOCATION_PATHS_OURS` conflict auto-resolve step. Previously the
prompt treated any modification of a location-data file in the
incoming diff as an automatic STOP, producing false positives on
every run (including the reconciliation commit above, which modifies
the location-data files to blank templates on main).

The rewritten prompt:

- Lists the full `LOCATION_PATHS_OURS` and `LOCATION_PATHS_THEIRS`
  arrays at the top so Claude knows which paths are auto-handled.
- Removes "STOP on location-data modification" from the criteria.
- Refocuses STOP triggers on things the script CAN'T auto-handle:
  non-additive schema migrations, known-breaking dep bumps,
  accidental secrets, deletion of the script itself, auth lockout
  changes.
- Explicitly lists things that should NOT cause a STOP.

**What could break at a location:**

- **None** — this is prompt-only. The script itself is unchanged.
- The only observable difference is that auto-update runs that
  previously failed at Checkpoint A with a false-positive STOP will
  now proceed to the merge+build+verify flow. This is the INTENDED
  behavior.

**Manual steps required:** None.

**Rollback notes:** `git revert 4bb259a8` restores the old prompt.

**Affected files:**

- `scripts/prompts/checkpoint-a.txt` (rewritten)

---

### 2026-04-14 — `9bd78364` — AutoUpdatePanel: save button no longer fights with polling

**What changed:**

Fixed "can't enable or save settings" bug in the Sync tab Auto Update
panel. The 15-second status poll was unconditionally resetting the
user's in-progress draft (`enabledDraft`, `timeDraft`) to the
server's value, wiping any edits before the user could click Save.
Added a `draftTouchedRef` that pauses server-sync on the draft once
the user interacts with the Switch or time picker; cleared after a
successful save.

**What could break at a location:**

- **None** — pure UI state fix in a single component. No API contract
  changes, no schema changes.

**Manual steps required:** None.

**Rollback notes:** `git revert 9bd78364`.

**Affected files:**

- `apps/web/src/components/AutoUpdatePanel.tsx` (modified)

---

## Archive

Older entries (>30 days) are pruned from this file. The authoritative
record is the git history.
