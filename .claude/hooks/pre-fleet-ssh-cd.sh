#!/bin/bash
# PreToolUse Bash — block SSH commands whose REMOTE payload depends on
# being inside the repo working tree but lacks `cd /home/ubuntu/Sports-Bar-TV-Controller`.
#
# The remote shell starts in /home/ubuntu, NOT in the repo. Commands like
# `git`, `npm`, `cat package.json`, `bash scripts/...` will fail "No such
# file or directory" or "not a git repository".
#
# This bug hit 5× in a single session (v2.55.24 Graystone diagnosis) AFTER
# v2.55.19's first version of this hook shipped — because that version only
# matched `bash scripts/`. Today's failures were `git branch`, `cat
# package.json`, etc. Hook is now broader.
#
# Allow-by-default on any error — a buggy hook must never block legit work.

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# 1. Is this an SSH command? Accept any of:
#    - `sshpass -p ... ssh ...`
#    - `ssh -o ...` / `ssh -i ...` / `ssh -t` (any flag form)
#    - `ssh user@host ...`
#    - `tailscale ssh ...`
is_ssh() {
  echo "$cmd" | grep -qE '\bsshpass\b' && return 0
  echo "$cmd" | grep -qE '\btailscale[[:space:]]+ssh\b' && return 0
  # `ssh -<flag>` or `ssh user@host`
  echo "$cmd" | grep -qE '(^|[[:space:];&|`(])ssh[[:space:]]+(-[a-zA-Z]|[a-zA-Z0-9_-]+@)' && return 0
  return 1
}
is_ssh || exit 0

# 2. Does the REMOTE payload reference cwd-dependent commands?
#    We grep the whole $cmd string (the remote payload is embedded as
#    quoted args after `ubuntu@host` — `jq -r` returns the raw bash
#    source, so it's all in the same string).
#
#    Catches:
#      - git <verb>          (status, branch, log, fetch, merge, etc.)
#      - npm / npx / pnpm / yarn (look up package.json from cwd)
#      - drizzle-kit         (reads drizzle.config.ts from cwd)
#      - bash scripts/...    (legacy v2.55.19 case)
#      - cat package.json    (lookup is cwd-relative)
#      - python3 ... package.json  (typical fleet-status inline)
#      - pm2 restart sports-bar-tv-controller (lookup of ecosystem)
needs_repo_cwd() {
  echo "$cmd" | grep -qE '\b(git|npm|npx|pnpm|yarn|drizzle-kit)[[:space:]]+[a-zA-Z]' && return 0
  echo "$cmd" | grep -qE 'bash[[:space:]]+([A-Za-z0-9_./-]+/)?scripts/' && return 0
  echo "$cmd" | grep -qE '(\bcat\b|\bless\b|\btail\b|\bhead\b)[[:space:]]+package\.json\b' && return 0
  echo "$cmd" | grep -qE 'python3?[[:space:]]+-c[[:space:]].*package\.json' && return 0
  echo "$cmd" | grep -qE '\bpm2[[:space:]]+(start|restart|reload)[[:space:]]+(ecosystem|sports-bar)' && return 0
  return 1
}
needs_repo_cwd || exit 0

# 3. Does the command already include cd into the repo? Accept both
#    `cd /home/ubuntu/Sports-Bar-TV-Controller` and bare
#    `cd Sports-Bar-TV-Controller` (if the user is already in /home/ubuntu).
if echo "$cmd" | grep -qE '\bcd[[:space:]]+(/home/ubuntu/)?Sports-Bar-TV-Controller\b'; then
  exit 0
fi

# 4. Escape hatch: if the operator literally wrote --i-know-what-im-doing,
#    they're past us. Same convention as pre-destructive-block.sh.
if echo "$cmd" | grep -qF -- '--i-know-what-im-doing'; then
  exit 0
fi

# Deny with explanatory reason.
msg='SSH command runs a cwd-dependent payload (git / npm / cat package.json / pm2 etc.) without `cd /home/ubuntu/Sports-Bar-TV-Controller` in the remote payload.

The remote shell starts in /home/ubuntu, NOT in the repo. So:
  - `git branch` returns "fatal: not a git repository"
  - `cat package.json` returns ENOENT
  - `npm run build` reads /home/ubuntu/package.json (does not exist)

Fix: prepend `cd /home/ubuntu/Sports-Bar-TV-Controller && ` to the remote payload (inside the SSH quotes). For per-box installers fed via stdin to `bash -s`, the cd should be the first line of the script.

This trap has hit 5+ times across two sessions despite an earlier version of this hook — the original only matched `bash scripts/`. The broader check (any cwd-dependent verb) is in effect now.

Memory: feedback_fleet_rollout_cd_prefix.

Bypass (genuine cwd-independent payload): append --i-know-what-im-doing to the command.'

jq -n --arg msg "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $msg
  }
}'
exit 0
