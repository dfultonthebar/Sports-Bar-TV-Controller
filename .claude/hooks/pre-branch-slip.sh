#!/bin/bash
# PreToolUse Bash — enforce "software to main first" rule. Block `git commit`
# of software files (apps/web/src/**, packages/**, scripts/**, CLAUDE.md,
# docs/**) when current branch is location/*. Software must go to main first;
# location branches only carry per-location data (apps/web/data/*.json, .env).

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Match a real `git commit` (not commit-tree, not commit-graph). Allow `--amend`.
echo "$cmd" | grep -qE '(^|[[:space:];&|`(])git[[:space:]]+commit($|[[:space:]])' || exit 0

REPO=/home/ubuntu/Sports-Bar-TV-Controller
branch=$(git -C "$REPO" branch --show-current 2>/dev/null) || exit 0
case "$branch" in
  location/*) ;;     # offending branch family — keep checking
  *) exit 0 ;;       # main or anything else — allow
esac

# Get staged files. Empty staging area = nothing to enforce.
staged=$(git -C "$REPO" diff --cached --name-only 2>/dev/null) || exit 0
[ -z "$staged" ] && exit 0

# Anything in software paths?
offenders=$(echo "$staged" | grep -E '^(apps/web/src/|packages/|scripts/|CLAUDE\.md$|docs/)' | head -20)
[ -z "$offenders" ] && exit 0

offender_list=$(echo "$offenders" | sed 's/^/  - /')
msg="Committing software files on a location branch ($branch) violates the 'software to main first' rule.

Offending staged file(s):
$offender_list

Fix:
  git stash                    # park these changes
  git checkout main
  git stash pop
  git add <files> && git commit
  git push origin main
  git checkout $branch
  git merge origin/main

Location branches only carry per-location data (apps/web/data/*.json) — never software. See feedback_commit_strategy memory + Standing Rule (CLAUDE.md)."

jq -n --arg msg "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $msg
  }
}'
exit 0
