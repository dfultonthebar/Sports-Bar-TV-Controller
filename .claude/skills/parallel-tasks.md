---
description: Dispatch the next N pending tasks as parallel worktree agents. Each agent runs in isolation, commits to its own branch, and the main thread sequentially merges the results.
---

# parallel-tasks

Run multiple pending tasks in parallel using isolated git worktrees.

## When to invoke

- Multiple pending tasks that are INDEPENDENT (no inter-task dependencies)
- Each task is well-scoped enough that one agent can complete it in ~60 min
- The operator wants to clear the backlog without serially walking each one

## How it works

1. Call `TaskList` to see all pending tasks
2. Pick the top N (default 3, max 6) that are:
   - status='pending'
   - no owner field set
   - description doesn't say "blocked by" or "wait for"
3. For each chosen task, spawn a `claude` subagent via the `Agent` tool with:
   - `isolation: "worktree"` (each gets its own git worktree)
   - `run_in_background: true` (all dispatch in parallel — one `<tool_use>` block with N `Agent` calls)
   - Prompt includes the task subject + description + a clear scope statement
   - Constraint: under 60 min wall-clock, under 80k tokens
   - Each must bump `package.json` to a unique version number and add a VERSION_SETUP_GUIDE.md entry
   - Each must COMMIT but NOT push
4. Wait for the task notifications as each agent completes (Claude is notified automatically — no polling)
5. Once all N complete, sequentially merge each worktree branch into main, resolving package.json + VERSION_SETUP_GUIDE.md conflicts (take theirs for package.json, keep both blocks in the docs)
6. Bump package.json to a final version that supersedes them all, push to main

## Version number conventions

Before dispatching N agents, plan the version numbers. If current `main` is at v2.55.X, assign:
- Agent 1 → vX+1
- Agent 2 → vX+2
- Agent 3 → vX+3

This avoids the package.json merge conflict resolving the wrong way (each agent bumps from the same base, you want to preserve ordering).

## Things to avoid

- Don't dispatch agents on overlapping files unless you've broken the work cleanly along file boundaries
- Don't dispatch tasks that require operator input — they'll stall
- Don't dispatch tasks that affect database schema simultaneously — the second agent's migration generation will conflict (sequence them)
- Don't dispatch more than 6 in parallel — context switching cost + worktree overhead

## What to communicate to the operator

When dispatching:
- "Spawning N agents in parallel: <task subjects>"
- "Each in an isolated worktree, will return notifications as they finish"

When agents return:
- "Agent #X done — vX.Y.Z committed on worktree, ready to merge"

When all done:
- Sequential merge results + final main commit + push

## Concrete example invocation (in a single message)

```
Agent({description: "Task #N — short subject", subagent_type: "claude",
       isolation: "worktree", run_in_background: true,
       prompt: "..."})
Agent({description: "Task #M — short subject", subagent_type: "claude",
       isolation: "worktree", run_in_background: true,
       prompt: "..."})
Agent({description: "Task #P — short subject", subagent_type: "claude",
       isolation: "worktree", run_in_background: true,
       prompt: "..."})
```

All three Agent calls in ONE tool-use block so they actually dispatch in parallel.

## Verification recipe after merging

```bash
# All merges land cleanly:
git log --oneline -10
grep version package.json

# Build is clean:
npm run build 2>&1 | tail -3

# verify-install still passes (in case agents touched it):
bash scripts/verify-install.sh --quiet
```
