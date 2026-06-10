# Hook Coverage Map

This doc maps every Standing Rule + named Gotcha to its enforcing mechanism, so we can see at a glance what's **mechanically enforced** vs. what's **honor-system** vs. what's a known **gap**.

**Read this when:**
- Considering whether to add a new policy/rule (does an existing hook already cover it?).
- Auditing why a rule got violated (was it just honor-system, or did the hook fail?).
- Planning the next phase of the self-monitoring architecture (where are the 🟡 → ✅ wins?).

**Status legend**

| | Meaning |
|---|---|
| ✅ | Mechanically enforced — a hook, watcher, or verify-install layer blocks/detects violations |
| 🟡 | Honor-system / nudge — documented in CLAUDE.md / memory; relies on me reading + applying |
| ❌ | Known gap — rule exists but nothing detects violations; usually a Phase 2+ target |

**Enforcer categories**

| Category | Where it fires |
|---|---|
| `claude-code/<name>` | `.claude/hooks/` — Claude Code lifecycle hook (fires only when Claude is driving) |
| `git/<name>` | `.githooks/` — real git hook (fires for any committer / pusher; bypassable via `--no-verify`) |
| `verify-install/<layer>` | `scripts/verify-install.sh` — runs at the end of every auto-update |
| `watcher/<name>` | Long-running background process (Atlas, SDR, Shure, scheduler) |
| `doc-only` | Prose in CLAUDE.md / memory / docs — relies on Claude reading + applying it |

---

## Standing Rules (CLAUDE.md)

| # | Rule (short) | Enforcer | Status |
|---|---|---|---|
| 1 | Read docs before work, update docs after | doc-only | 🟡 |
| 2 | Commit + push after verified work | doc-only | 🟡 |
| 3 | Never break working features during cleanup | doc-only + verify-install (post-merge) | 🟡 |
| 4 | Force-rebuild when Turbo cache lies | doc-only | 🟡 |
| 5 | "Remember" → update CLAUDE.md too | doc-only | 🟡 |
| 6 | Always use `scripts/auto-update.sh` | doc-only | 🟡 |
| 7 | Sync memory ↔ CLAUDE.md bidirectionally | doc-only | 🟡 |
| 8 | Read + contribute to VERSION_SETUP_GUIDE every release | **`git/pre-push`** (v2.55.20) | ✅ |
| 9 | CLAUDE.md is `main`-only | **`claude-code/pre-branch-slip`** (v2.55.19) | ✅ |
| 10 | Everything stays on latest version | doc-only + weekly `npm outdated` ritual | 🟡 |
| 11 | Every fix/doc → RAG re-scan | **`claude-code/post-rag-rescan`** (v2.55.19) | ✅ |

---

## Common Gotchas (CLAUDE.md §Common Gotchas)

| # | Gotcha (short) | Enforcer | Status |
|---|---|---|---|
| 1 | Body Stream Already Consumed (`request.json()` after `validateRequestBody`) | doc-only | 🟡 |
| 2 | PM2 Restart vs Delete+Start (env var changes need delete+start) | doc-only | 🟡 |
| 3 | Production DB Path canonical at `/home/ubuntu/sports-bar-data/production.db` | drizzle.config + doc | 🟡 |
| 4 | Matrix Config Per-Location Values (`outputOffset` per layout) | doc + `verify-install/matrix_config` (single-card only) | ✅ |
| 5 | Device Data: DB is Source of Truth (JSON is seed-only) | doc-only | 🟡 |
| 6 | `drizzle-kit push` Fails Silently on pre-existing indexes | **resolved**: migrate flow + `verify-install/schema_completeness` | ✅ |
| 7 | Location Data Files Blanked on Merge from main | **`claude-code/post-data-blanking`** (v2.55.19) | ✅ |
| 8 | BartenderLayout Must Include Rooms | doc + `seed-from-json` + **`verify-install/bartender_layout_rooms`** (v2.55.25) | ✅ |
| 9 | Prime Video Launcher-Hosted on Fire TV Cubes (`com.amazon.firebat`) | resolved in code + doc | ✅ |
| 10 | Next.js Per-Bundle Singletons need `globalThis` hoisting | doc-only (caught via memory) | 🟡 |
| 11 | Auto-update Silently Stalls (lock + linger + NVM PATH + ollama perms) | lock self-deadlock fix (v2.55.17) + **`verify-install/linger_enabled`** + **`verify-install/autoupdate_timer_fresh`** + **`verify-install/node_symlink_present`** (v2.55.25) | ✅ |
| 12 | llama3.1:8b Paraphrases Short Verbatim Text | doc + server-built-verbatim pattern | 🟡 |
| 13 | Karaoke at Bars Uses BYO Mics (never "karaoke mic" framing) | doc + Terminology Conventions in CLAUDE.md | ✅ |
| 14 | ISO grub.cfg cmdline must be QUOTED, not backslash-escaped | doc-only | 🟡 |
| 15 | autoinstall `geoip: true` hangs the install | doc-only | 🟡 |
| 16 | autoinstall `shutdown: poweroff` not `reboot` | doc-only | 🟡 |
| 17 | ISO build install Node 22 + PM2 in `late-commands` | doc-only | 🟡 |
| 18 | ISO smoke test Proxmox DHCP arp lag — poll ≥15 min | doc-only | 🟡 |
| 19 | PXE `sanboot` is dead-end for Ubuntu; boot kernel+initrd over HTTP | resolved in code (`configure-netboot-menu.sh`) + doc | ✅ |

---

## Claude Code interactive hooks (`.claude/hooks/`, v2.55.19)

These only fire when Claude is driving the session — not when a human is pushing directly. They're invaluable for me but invisible to anyone else.

| Hook | Catches | Status |
|---|---|---|
| `pre-fleet-ssh-cd` | SSH commands running repo scripts without `cd /home/ubuntu/Sports-Bar-TV-Controller &&` prefix | ✅ |
| `pre-branch-slip` | `git commit` of software files (apps/web/src, packages, scripts, CLAUDE.md, docs) on a `location/*` branch | ✅ |
| `pre-version-bump` | `git push origin main` when commits ahead of origin/main don't include a `package.json` version bump | ✅ |
| `pre-destructive-block` | `npm audit fix --force`, `git reset --hard`, `rm -rf` of repo/data dir, `git push --force` to main | ✅ |
| `post-data-blanking` | After `git checkout main`, warns if `tv-layout.json` just blanked | ✅ |
| `post-rag-rescan` | After commits touching CLAUDE.md/docs/READMEs, auto-fires `rag-rescan-if-needed.sh` | ✅ |
| `claude-verify-edit` | Small-LLM sanity check on every Edit/Write | ✅ |
| `status-line` | Renders `⎇ <branch>  v<X.Y.Z>` so branch-slip is impossible to miss | ✅ |

---

## Git hooks (`.githooks/`, v2.55.20)

These fire for **any** developer pushing the repo — Claude, the operator manually, a future fleet box that's been wired up. They run outside Claude Code and are bypassable with `--no-verify` for genuine emergencies.

| Hook | Catches | Status |
|---|---|---|
| `pre-push` (docs gate, v2.55.20) | Push to `origin main` containing non-trivial code without a docs update (VERSION_SETUP_GUIDE / LOCATION_UPDATE_NOTES / CLAUDE.md / HOOK_COVERAGE) | ✅ |
| `pre-push` (Grok critical-path review, v2.55.27) | Push to `origin main` touching schema / drizzle / auto-update / verify-install / iso / proxmox / instrumentation / next.config / ecosystem.config / the hook itself — runs an independent Grok review for non-obvious failure modes | ✅ |

### Install on a new clone

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git config core.hooksPath .githooks
```

One-time, per clone. After that the hook runs on every `git push`. Bypass: `git push --no-verify` (for cases where genuinely no doc applies — record an empty/no-op entry in VERSION_SETUP_GUIDE anyway, that's friction-free).

### Heartbeat

Every `pre-push` fire — whether it allowed or blocked — writes a row to `/tmp/sports-bar-pre-push-hook.log`. Silent absence of rows means the hook **didn't run**, not that everything was fine. (This is the cheap version of pattern #1's self-monitoring discipline applied even to the hooks themselves.)

---

## Watchers (long-running)

| Watcher | What it monitors | Heartbeat | Status |
|---|---|---|---|
| `atlas-drop-watcher` | Zone gain crashes (≥15-point drop landing ≤10) | `event_type='startup'` rows | ✅ |
| `atlas-priority-watcher` | Priority/mic/page/jukebox activity + unexpected source overrides | `event_type='startup'` rows | ✅ |
| `shure-rf-watcher` | UNKNOWN-TX-type carriers on mic channels (ghost RF) + low battery | `event_type='startup'` + heartbeat every 20s while active | ✅ |
| `sdr-watcher` | Wide-band RF carriers above threshold (UHF mic band + TV broadcast) | `event_type='heartbeat'` rows every 30s while active carrier | ✅ |
| `scheduler-service` | Periodic jobs (interference correlator, preemptive strike, RF pattern digest, ESPN sync, neighborhood event scrapers) | `SchedulerLog` row per fire | ✅ |
| **app-level error-watch** | PM2 error log tailing for `[ERROR]` / `UnhandledPromiseRejection` / `FOREIGN KEY constraint` / `ECONNREFUSED` / `ETIMEDOUT` / `Cannot find module` / `TypeError:` / `Exception` | `kind='heartbeat'` row every 300s + `kind='startup'` on service start | ✅ **(Phase 2a, v2.55.23)** |

---

## Outstanding gaps (mapped to phased plan)

| Phase | Adds | Converts these 🟡 → ✅ |
|---|---|---|
| ~~**Phase 2**~~ ✅ **Phase 2a shipped (v2.55.23)** — Autonomous error-watch service | systemd-user unit (`sports-bar-error-watch.service`) tails PM2 error logs against 8 signatures, writes to `error_watch_events` DB table with 30s per-signature dedup + 5-min heartbeat | Faster detection on Gotchas #2 / #11 (would have caught the v2.55.16 FK-DrizzleError spam, the auto-update lock self-deadlock, post-deploy crash loops) within minutes instead of hours. **Phase 2b (TODO):** UI surface for unacknowledged events + admin notification when a never-before-seen signature lands |
| ~~**Phase 3**~~ ✅ **Phase 3 shipped (v2.55.25)** — Liveness assertions tied to fixed bugs | 8 new layers in `verify-install.sh`: `linger_enabled`, `autoupdate_timer_fresh`, `migration_markers_consistent`, `error_watch_alive`, `bartender_layout_rooms`, `atlas_drop_watcher_alive`, `atlas_priority_watcher_alive`, `node_symlink_present`. Each runs in <1 sec; total verify pass is 3 sec on Holmgren | Gotchas #6 / #8 / #11 (3 sub-checks) — turns prose-only safety nets into asserted gates that fail-loud at every auto-update. Holmgren passes 16/16. |
| ~~**Phase 4**~~ ✅ **Phase 4 shipped (v2.55.27), hardened (v2.55.29)** — Auto-grok on critical-path diffs | `scripts/grok-prepush-review.sh` invoked by `.githooks/pre-push` when the push touches 13 critical-path globs. v2.55.29 hardened: (1) printf-from-vars prompt (shell-injection-safe), (2) `VERDICT: CLEAN/FINDING` mandate + multi-format parser (with INCONCLUSIVE fallback that soft-blocks), (3) timeout fails CLOSED for drizzle/schema/auto-update paths, (4) `GROK_PREPUSH_NO_SELF_REVIEW=1` escape for iterating on the hook itself. 120s timeout, per-day SHA cache, auto-injected gotcha hints. Soft block: FINDING requires `--no-verify` or `GROK_PREPUSH_DISABLE=1`. Auto-degrades if `grok` CLI is absent. | Standing Rules 3 + 10 (independent review on the highest-risk changes — schema migrations + auto-update path + ISO build) |
| **Phase 5** — Detect→fix→gate pipeline | Watch service flags a known-trivial signature (typo, lint, dep patch) → Claude worktree-fixes → verify-install → auto-merges; critical path queued for operator | Gotchas #2 / #12 (auto-fix recurring small issues) |
| **Phase 6** — Worktree-by-default for risky operations | `scripts/auto-update.sh` and drizzle migration runs operate from a worktree | Standing Rule 3 (never break the running app) |

---

## How to add a new rule to this map

1. Add the rule to CLAUDE.md (Standing Rules section or Common Gotchas, whichever fits).
2. Decide: is it mechanically enforceable today?
   - **Yes**: implement the enforcer (hook / verify-install layer / watcher) + reference it here as ✅.
   - **No (yet)**: list as 🟡 with `doc-only` and add a row to "Outstanding gaps" if it's worth a future phase.
3. Update this doc in the **same commit** as the rule itself — the `pre-push` hook will block it otherwise, which is the point.
