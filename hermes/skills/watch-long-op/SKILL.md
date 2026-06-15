---
name: watch-long-op
description: When Claude (or the operator) kicks off a long-running operation, own the monitoring — poll it to completion, verify health, and report the outcome so Claude doesn't have to wait.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [claude, monitoring, ops, auto-update, watch]
---

# Watch a Long Operation

Claude works in bursts and shouldn't sit polling a 15-minute build or a fleet
rollout. You're always-on — so when a long operation starts (an auto-update, a
fleet recovery, a build, a rescan), TAKE OVER the watch, confirm the outcome, and
report it. This frees Claude to do other work and gives the operator a clean
"it's done / it failed" signal.

## When to use
- Claude triggers (or asks you to trigger) an `auto-update.sh` run, a fleet
  rollout, a rebuild, or a RAG rescan.
- The operator starts something long and asks "tell me when it's done."

## Workflow
1. **Identify the completion signal.** Usually: the `auto-update.sh` process exits
   (`pgrep -f scripts/auto-update.sh`), OR a terminal log line appears
   (`SUCCESS:` / `Rollback SUCCESS` / `Push succeeded after merge-reconcile`), OR
   a target version is reached.
2. **Poll patiently** (every ~30s), not aggressively. A multi-minute build is
   normal, not a hang. Note: auto-update.sh re-execs itself when it self-updates,
   so track by process NAME, not PID.
3. **On completion, verify the real outcome** — don't trust "started OK":
   - version reached, `git` clean + on the right branch, `origin-match`,
     health HTTP 200, PM2 online, no rollback in the log.
4. **Report** a tight summary: what finished, final version/health, and explicitly
   whether it SUCCEEDED or FAILED + why. If it failed or rolled back, gather the
   relevant log lines and hand them to Claude via `prep-claude-context` +
   `ask_claude_code` for a fix.
5. **Don't intervene mid-op** unless it's clearly hung (no log growth + process
   gone). A long build is not a failure.

## Why this matters
Claude's time is best spent reasoning + fixing, not babysitting a progress bar.
You are the patient watcher. Hand back only the conclusion: done-and-healthy, or
broken-and-here's-the-evidence.
