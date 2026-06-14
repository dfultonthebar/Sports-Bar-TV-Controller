---
name: prep-claude-context
description: Before delegating a diagnosis to Claude Code, gather the relevant LIVE system state and hand it over — Claude is read-only and cannot pull live data itself.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [claude, delegation, context, diagnosis, ops]
---

# Prep Claude Context

When you delegate to Claude Code via `ask_claude_code`, remember: **Claude runs
read-only (plan mode) — it can read the codebase but it CANNOT run live commands,
SSH the fleet, or query the running system.** So a bare question makes Claude
guess about live state. Your superpower is that YOU can see the live system.
Gather it first, then hand it over. This makes Claude's analysis grounded and
accurate instead of speculative.

## Workflow

1. **Read the request.** Decide what live state is relevant to the question
   (a black TV → matrix routes + device health; a mic ghost → Shure + Atlas; a
   fleet problem → per-box versions/health/git state; a scheduler bug → recent
   allocations + logs).

2. **Gather it with the tools you have** — but only what's relevant:
   - `get_system_health`, `get_matrix_routes`, `explain_tv_output`,
     `get_shure_rf_status`, `get_atlas_status`, `get_firetv_status`,
     `list_open_todos` (the observe MCP tools).
   - `search_system_docs` for the relevant gotcha/runbook so Claude has the doc context.
   - For fleet/host state, run the read-only shell checks (versions, git status,
     health per box) and capture the output.

3. **Hand it to Claude.** Call `ask_claude_code` with the question PLUS a
   "LIVE STATE (gathered just now)" block containing the data you collected.
   Be specific: name the files/area if you know them, and paste the real numbers
   (route arrays, health JSON, version strings, log excerpts). Tell Claude this
   is live data it can trust.

4. **Relay + act on Claude's answer.** If it's a fix plan, `create_maintenance_todo`
   it. If it needs a live action you can safely do (read-only or a proposed
   change), propose it for operator confirm — never run a destructive op yourself.

## Why this matters
Claude + you are complementary: Claude knows the *code* and can reason deeply but
is blind to *now*; you see *now* but shouldn't reason deeply about code internals.
Pre-gathering closes that gap — Claude stops guessing and starts diagnosing the
real, current system. Always pre-gather before a system-state question.

## Don't
- Don't dump EVERYTHING — only the state relevant to the question (Claude has a
  context budget; irrelevant data dilutes it).
- Don't ask Claude to "go check the live system" — it can't. That's your job.
