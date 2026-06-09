#!/bin/bash
# PreToolUse Bash — block SSH commands that run a repo script without
# `cd /home/ubuntu/Sports-Bar-TV-Controller &&` prefix. The remote shell
# starts in /home/ubuntu, NOT in the repo, so `bash scripts/...` will fail
# "No such file or directory". This hit 3× in a single session despite
# the warning in memory (feedback_fleet_rollout_cd_prefix).
# Allow-by-default on any error (we never want a buggy hook to block work).

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# 1. Is this an SSH command? (ssh / sshpass / tailscale ssh / ssh -o ...)
echo "$cmd" | grep -qE '(sshpass\b|tailscale[[:space:]]+ssh\b|(^|[[:space:];&|`(])ssh[[:space:]])' || exit 0

# 2. Does it invoke a repo script (bash …/scripts/* or just bash scripts/*)?
echo "$cmd" | grep -qE 'bash[[:space:]]+([A-Za-z0-9_./-]+/)?scripts/' || exit 0

# 3. Does it already include the cd into the repo?
if echo "$cmd" | grep -qE 'cd[[:space:]]+(/home/ubuntu/)?Sports-Bar-TV-Controller'; then
  exit 0
fi

# Deny with explanatory reason
msg='SSH command runs a repo script without `cd /home/ubuntu/Sports-Bar-TV-Controller &&` prefix.

The remote shell starts in /home/ubuntu, NOT in the repo. `bash scripts/...` will fail with "No such file or directory".

Fix: prepend `cd /home/ubuntu/Sports-Bar-TV-Controller && ` to the SSH payload.

See memory: feedback_fleet_rollout_cd_prefix (this exact trap hit 3× in one session — that is why this hook now exists).'

jq -n --arg msg "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $msg
  }
}'
exit 0
