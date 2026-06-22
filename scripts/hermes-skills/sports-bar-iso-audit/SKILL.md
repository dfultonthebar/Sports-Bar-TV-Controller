---
name: sports-bar-iso-audit
description: "SSH into a freshly-installed sports-bar box, run verify-install.sh, and report every layer PASS/WARN/FAIL with its fix hint — highlighting the production-build and hub-agent layers that caught the Lime Kiln invisible outage."
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [SportsBar, ISO, install, verify, audit, fleet, hub, mcp]
    model_hint: cheap-generalist
---

# Sports-Bar ISO / fresh-install audit

Point this at a target box (Tailscale hostname or IP). It SSHes in, runs the
canonical post-install gate `scripts/verify-install.sh`, and reports every
layer as **PASS / WARN / FAIL** with the one-line fix hint each layer prints.
This is the "did this box actually come up, and can anyone SEE it?" check after
an ISO install or a fresh clone.

Why it exists: the newest box (Lime Kiln) PM2-restart-stormed **5251x** on
*"Could not find a production build in the '.next' directory"* AND was never
registered on the central SBCC hub — so it was down for **two days and nobody
saw it**. Two new verify-install layers close both gaps; this skill makes sure
an operator looks at them on every new box.

## When to use
- Right after an ISO first-boot completes (or after `curl install.sh`).
- After `scripts/auto-update.sh` on a box you're not sure recovered.
- Spot-auditing any fleet box that "looks quiet" on the dashboard.

Not for: live hardware state (use the observe / MCP tools) or deep code
questions (use `sports-bar-investigate`).

## Inputs
- `TARGET` — Tailscale MagicDNS hostname or IP of the box to audit.
  (Don't guess the hostname from the branch slug — naming varies; ask if unsure.)

## Workflow

1. **Run the gate over SSH.** Prefer the machine-readable JSON mode so you get
   per-layer structure, not just a summary line:
   ```bash
   ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@$TARGET \
     'cd /home/ubuntu/Sports-Bar-TV-Controller && bash scripts/verify-install.sh --json'
   ```
   The JSON object is `{ status, passed, total, durationSecs, failed[], layers[] }`
   where each `layers[]` entry is `{ name, passed, detail }`. The `detail` string
   on a failing layer contains the verbatim fix hint (a `Run: ...` command).
   If `--json` fails to parse, fall back to the human form:
   ```bash
   ssh ... 'cd /home/ubuntu/Sports-Bar-TV-Controller && bash scripts/verify-install.sh'
   ```

2. **Classify each layer.** From the JSON: `passed:true` → PASS. For the
   `passed:false` entries, read the `detail`:
   - **FAIL** — `passed:false` and detail has no `WARN:` prefix → real, fix now.
   - **WARN** — detail begins `WARN:` (the layer self-downgraded in --json mode,
     e.g. hub-unreachable, stale-timer, auth-not-bootstrapped). Surface it but
     don't treat it as a hard failure.
   - **PASS** — everything else.

3. **Highlight the two outage-class layers explicitly**, every run, even when
   green — these are the ones that were missing during the Lime Kiln outage:
   - **`production_build_present`** — FAIL means `apps/web/.next/BUILD_ID` is
     missing → PM2 is (or will be) restart-storming on a missing production
     build. Fix hint: `cd /home/ubuntu/Sports-Bar-TV-Controller && rm -rf
     apps/web/.next && npm run build && pm2 restart sports-bar-tv-controller`.
   - **`hub_agent_registered`** — FAIL means the SBCC hub (CT211,
     100.124.165.26) is reachable but has **no online `agent-<slug>`** for this
     box → the box is invisible to the fleet dashboard. Fix hint: deploy the
     per-location central agent on the hub (start its `agent-<slug>` PM2 proc).
     A `WARN` here just means the hub was unreachable from the box — note it,
     re-check later.

4. **Report.** One operator-readable message, server-built verbatim (don't let
   the model paraphrase layer names, counts, or fix commands — Gotcha #12):
   ```
   ISO audit @ <TARGET> — <passed>/<total> layers (<durationSecs>s)

   🔴 FAIL  production_build_present — <detail / fix hint>
   🔴 FAIL  hub_agent_registered    — <detail / fix hint>
   🟡 WARN  auth_bootstrap_complete — <detail>
   🟢 PASS  pm2_online, health_http, schema_completeness, ... (<n> more)

   Spotlight:
     • Production build (BUILD_ID): <PASS/WARN/FAIL — one line>
     • Hub registration (agent-<slug>): <PASS/WARN/FAIL — one line>
   ```
   Collapse the PASS layers into a count + names; show every WARN and FAIL in
   full with its fix command so the operator can copy-paste.

5. **Escalate, don't act.** Read-only audit. Do NOT run the fix commands or
   restart anything yourself. If a FAIL is worth tracking, file it via
   `create_maintenance_todo` so it lands on the System Admin → Todos list. For
   `hub_agent_registered` FAIL specifically, the remediation is a hub-side
   deploy — call that out as a hub action, not a box action.

## Notes
- `verify-install.sh` exit codes map 1:1 to layers (28 =
  production_build_present, 29 = hub_agent_registered, 27 = auth_bootstrap,
  10–25 = the older layers). When you only have the exit code (no JSON), the
  first failing layer's code tells you where to look.
- In `--json` mode several layers intentionally self-downgrade to `WARN`
  (hub unreachable, stale auto-update timer, auth not bootstrapped) so they
  never trigger an auto-update rollback. Interactive mode hard-FAILs them —
  prefer `--json` for a faithful "is this box healthy AND visible" read.
- A brand-new box legitimately WARNs on `auth_bootstrap_complete` until the
  operator runs `location-setup-wizard.sh`. Don't flag that as broken; flag the
  two spotlight layers.

## Install (on the Hermes host, CT 212)
This file is the versioned source in the repo at
`scripts/hermes-skills/sports-bar-iso-audit/SKILL.md`. To install/update it on
the Hermes host:
```bash
mkdir -p ~/.hermes/skills/sports-bar-iso-audit
cp /path/to/repo/scripts/hermes-skills/sports-bar-iso-audit/SKILL.md \
   ~/.hermes/skills/sports-bar-iso-audit/SKILL.md
sudo systemctl restart hermes-gateway   # reload skills — gateway is SYSTEM-scoped
                                        # (NOT `systemctl --user` — that wakes a
                                        #  removed user-unit duplicate into a crash-loop)
```
