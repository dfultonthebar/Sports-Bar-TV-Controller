#!/bin/bash
# Stop hook — when the main conversation turn ends, look at the pending
# task list. If there are >= MIN_PARALLEL_TASKS unblocked + unowned
# pending tasks, surface a `/parallel-tasks` skill suggestion via
# systemMessage so the operator (or Claude's next turn) can choose to
# dispatch them.
#
# This is a SOFT suggestion — it does NOT actually spawn agents
# (Stop hooks can't reliably do that from the harness side). What it
# does is keep the parallel-tasks pattern top-of-mind by surfacing
# the suggestion at every Stop boundary when the queue justifies it.
#
# Threshold: only surface when there are ≥ 2 actionable pending tasks
# AND the user hasn't already seen this suggestion in the last hour.
#
# Cooldown: /tmp/sports-bar-parallel-suggest.last (touch-file). Skip if
# touched within COOLDOWN_SECS.

set -u

COOLDOWN_SECS=3600          # 1 hour between suggestions
MIN_PARALLEL_TASKS=2        # only surface when at least 2 actionable
COOLDOWN_FILE=/tmp/sports-bar-parallel-suggest.last

# Cooldown check
if [ -f "$COOLDOWN_FILE" ]; then
    age=$(( $(date +%s) - $(date -r "$COOLDOWN_FILE" +%s) ))
    if [ "$age" -lt "$COOLDOWN_SECS" ]; then
        exit 0
    fi
fi

# Read pending tasks from .claude/tasks/<session>/ (Claude Code task DB)
# Newer Claude harnesses expose the task list via the TaskList tool but
# we can't call tools from a hook. Instead read the local-file state.
TASK_DB_DIR="/home/ubuntu/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/tasks"
if [ ! -d "$TASK_DB_DIR" ]; then
    # Older Claude versions may store tasks elsewhere; try a couple of
    # known paths before giving up silently.
    for alt in "$HOME/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/tasks" "$HOME/.local/state/claude/tasks"; do
        if [ -d "$alt" ]; then
            TASK_DB_DIR="$alt"
            break
        fi
    done
fi

# Even if we can't find the task DB, fall back to counting recent
# TaskCreate hook fires from a sidecar. The PostToolUse TaskCreate hook
# already writes to /tmp/sports-bar-task-research/ — count unverified
# task ids there as a proxy for "pending tasks the operator hasn't
# closed yet."
PENDING_COUNT=0
PENDING_IDS=""

if [ -d "$TASK_DB_DIR" ]; then
    # Each task in newer Claude is a JSON file. Look for status=pending
    # and no owner.
    PENDING_IDS=$(grep -l '"status":"pending"' "$TASK_DB_DIR"/*.json 2>/dev/null \
        | xargs -I{} jq -r 'select(.owner == null or .owner == "") | .id' {} 2>/dev/null \
        | sort -u | head -20)
    PENDING_COUNT=$(echo "$PENDING_IDS" | grep -c . || echo "0")
fi

# Fallback proxy if no task DB found: look at TaskCreate dossier files
# minus any that match a "completed" pattern in recent transcript files.
# This is a heuristic.
if [ "$PENDING_COUNT" -eq 0 ] && [ -d /tmp/sports-bar-task-research ]; then
    PENDING_COUNT=$(ls /tmp/sports-bar-task-research/*.md 2>/dev/null | wc -l)
fi

if [ "$PENDING_COUNT" -lt "$MIN_PARALLEL_TASKS" ]; then
    exit 0
fi

# Mark cooldown so we don't re-fire on every Stop.
touch "$COOLDOWN_FILE"

# Emit a systemMessage that Claude (next turn) and the operator both see.
jq -n --argjson count "$PENDING_COUNT" '{
  systemMessage: ("[parallel-tasks] " + ($count | tostring) +
    " actionable pending tasks detected. To dispatch them in parallel: ask Claude to run `/parallel-tasks` (or say \"work on the next 2-3 tasks in parallel\"). Each runs in an isolated git worktree; failures roll back without touching main.")
}'
exit 0
