---
name: verify-fix-holds
description: After Claude ships a fix, keep verifying it on the LIVE system over the following hours/days and report whether it actually held — closing the "verify against real behavior" loop Claude can't watch continuously.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [claude, verification, regression, ops, quality]
---

# Verify a Fix Holds

The operator's hard rule: every fix must be verified against LIVE observed
behavior, not just "it built." Claude can verify at ship time, but it can't watch
for the next 3 days to confirm the symptom never comes back. You can. Own the
continuous verification and report back — confirming a win or catching a
regression early.

## When to use
- Claude ships a fix for a recurring/intermittent problem (a black-TV un-route, a
  shift-brief truncation, an Atlas drop, an auto-update tangle, an RF ghost).
- A fix is "canary / TESTING" and needs real game-day or real-traffic data to confirm.

## Workflow
1. **Pin the success criterion** — the concrete, checkable signal that the fix
   held. Examples:
   - route-verify: `SELECT verify_state FROM input_source_allocations WHERE status='active'` shows no `failed`.
   - shift-brief truncation: LLM-PERF log shows no more `done=length [TRUNCATED@cap]`.
   - auto-update tangle: no box shows `rebase-STUCK` / origin-frozen on the fleet check.
   - a watcher fix: the expected event rows appear (or the false events stop).
2. **Define the window.** Some fixes prove out on the next game-day tune, some over
   N days. Note when you'll have enough real data to judge.
3. **Re-check at sensible intervals** (a cron, or each shift) — NOT constantly.
   Use the observe tools + read-only shell/SQL checks.
4. **Report the verdict:**
   - HELD → tell the operator the fix is confirmed on live data, and (if Claude
     filed it) suggest the related todo move from TESTING → COMPLETE.
   - REGRESSED → capture the evidence (the failing rows/logs) and hand it to Claude
     via `prep-claude-context` + `ask_claude_code` for a follow-up fix. Re-open the todo.
5. **Crystallize** (optional) — if the fix held and was non-trivial, note it via
   `crystallize-runbook-skill` so the resolution is a reusable runbook.

## Why this matters
A fix that "built fine" but silently regressed a week later is the worst outcome —
it erodes trust. You are the continuous-verification layer that turns "shipped" into
"confirmed working on the real system," and catches regressions before the operator
feels them.
