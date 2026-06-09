#!/bin/bash
# PreToolUse Bash — block obviously destructive commands unless the literal
# token `--i-know-what-im-doing` is present in the command. The four traps:
#   1. npm audit fix --force            → catastrophically downgrades core deps
#   2. git push --force to origin main  → rewrites fleet-shared history
#   3. git reset --hard                 → discards uncommitted work
#   4. rm -rf under repo or data dir    → service + data loss

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Explicit override
if echo "$cmd" | grep -qF -- '--i-know-what-im-doing'; then
  exit 0
fi

deny() {
  jq -n --arg msg "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $msg
    }
  }'
  exit 0
}

# Helper: is this token at the start of a command (^ or after ; && || | `( )?
at_cmd_start() {
  echo "$cmd" | grep -qE "(^|[[:space:];&|\`(])$1"
}

# 1. npm audit fix --force
if echo "$cmd" | grep -qE 'npm[[:space:]]+audit[[:space:]]+fix' && \
   echo "$cmd" | grep -qE '(^|[[:space:]])--force(\b|$)'; then
  deny "BLOCKED: npm audit fix --force

This would catastrophically downgrade core packages to 'fix' transitive moderate vulns:
  - postcss vuln → installs next@9.3.3 (we are on Next 16 — destroys the app)
  - esbuild vuln → installs drizzle-kit@0.18.1 (ancient — breaks all migrations)
  - uuid vuln → installs next-auth@3.29.10 (we are on 4.24.11 — breaks auth)

These vulns are documented in v2.55.13's commit message as intentionally left.

If you really must: append --i-know-what-im-doing to override."
fi

# 2. git push --force / -f targeting origin main
if echo "$cmd" | grep -qE 'git[[:space:]]+push' && \
   echo "$cmd" | grep -qE '(-f($|[[:space:]])|--force(\b|$)|--force-with-lease)' && \
   echo "$cmd" | grep -qE '\borigin[[:space:]/]+main\b|\borigin[[:space:]]+HEAD:main\b'; then
  deny "BLOCKED: git push --force to origin main

Force-pushing main rewrites history that all 6 location branches + the fleet auto-update depend on. Boxes that already merged the prior history would diverge and require manual recovery.

If recovering from a destructive accident: append --i-know-what-im-doing to override."
fi

# 3. git reset --hard
if at_cmd_start 'git[[:space:]]+reset' && \
   echo "$cmd" | grep -qE 'git[[:space:]]+reset.*--hard'; then
  deny "BLOCKED: git reset --hard

This discards uncommitted changes (your work AND any pre-existing untracked operator work) AND moves HEAD irrevocably. On the live Holmgren working tree this can destroy in-progress location data files, untracked operator scripts (see initial git status of every session), etc.

If intentional: append --i-know-what-im-doing to override."
fi

# 4. rm -rf under repo or production data dir
# Match: rm -rf (or -fr, -Rf, -r -f) followed somewhere by an absolute path
# into /home/ubuntu/Sports-Bar-TV-Controller or /home/ubuntu/sports-bar-data.
if echo "$cmd" | grep -qE '(^|[[:space:];&|`(])rm[[:space:]]+-[a-zA-Z]*[rRfF][a-zA-Z]*' && \
   echo "$cmd" | grep -qE '/home/ubuntu/(Sports-Bar-TV-Controller|sports-bar-data)(/|[[:space:]]|$)'; then
  deny "BLOCKED: rm -rf under /home/ubuntu/Sports-Bar-TV-Controller or /home/ubuntu/sports-bar-data

The repo is Holmgren's live working tree (production deploy). sports-bar-data holds the production SQLite DB + logs + caches. Recursive deletion here = data loss + service loss.

If you really must (clean rebuild etc): append --i-know-what-im-doing to override."
fi

exit 0
