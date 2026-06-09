#!/bin/bash
# PreToolUse Bash — enforce 'every commit to main bumps package.json version'.
# Block `git push origin main` if commits ahead of origin/main don't include
# a change to the `"version":` line in package.json. Standing Rule (CLAUDE.md).

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Match `git push` whose TARGET ref on origin is main. Forms handled:
#   git push origin main                  → src=main, dst=main
#   git push -u origin main               → same
#   git push origin HEAD:main             → src=HEAD, dst=main
#   git push origin <src>:main            → src=<src>, dst=main
# IMPORTANT: `git push origin main` pushes LOCAL main, NOT current HEAD —
# so when the operator runs this from a location branch, compare local
# `main` against origin/main, not HEAD.
echo "$cmd" | grep -qE 'git[[:space:]]+push' || exit 0

# Extract the refspec arg after "origin ", first non-flag token
refspec=$(echo "$cmd" | grep -oE 'origin[[:space:]]+[^[:space:];&|`)]+' | head -1 | awk '{print $2}')
[ -z "$refspec" ] && exit 0
src="${refspec%%:*}"
dst="${refspec#*:}"
[ "$src" = "$refspec" ] && dst="$src"   # no colon → src==dst
[ "$dst" != "main" ] && exit 0           # only enforce target=main

REPO=/home/ubuntu/Sports-Bar-TV-Controller

# Need origin/main to compare; if no remote tracking ref, allow (first push).
git -C "$REPO" rev-parse --verify origin/main >/dev/null 2>&1 || exit 0
# Source ref must exist locally too.
git -C "$REPO" rev-parse --verify "$src" >/dev/null 2>&1 || exit 0

ahead=$(git -C "$REPO" rev-list --count "origin/main..$src" 2>/dev/null) || exit 0
[ "$ahead" -eq 0 ] && exit 0

# Did any commit in the range modify the "version": line in package.json?
version_change=$(git -C "$REPO" diff "origin/main..$src" -- package.json 2>/dev/null | grep -E '^[+-][[:space:]]*"version":' || true)
[ -n "$version_change" ] && exit 0

# Deny
ahead_msg="$ahead commit(s) ahead of origin/main, none of which bumped package.json \`version\`."
msg="Pushing to main without a package.json version bump.

$ahead_msg

Standing Rule (CLAUDE.md): every commit to main MUST include a package.json version bump in the same change. Locations report their running version from package.json — if code changes without a bump, fleet boxes will report matching versions for mismatched code and be undebuggable.

Fix:
  # bump package.json (patch for bugfix/docs, minor for feature)
  sed -i 's/\"version\": \"[0-9]*\\.[0-9]*\\.[0-9]*\"/\"version\": \"X.Y.Z\"/' package.json
  git add package.json
  git commit --amend --no-edit   # fold into the last commit, OR a new commit
  git push origin main"

jq -n --arg msg "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $msg
  }
}'
exit 0
