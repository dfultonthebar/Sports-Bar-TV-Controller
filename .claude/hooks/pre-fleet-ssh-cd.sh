#!/bin/bash
# PreToolUse Bash — fleet SSH must run inside the repo working tree.
#
# The remote shell starts in /home/ubuntu, NOT in the repo, so `git`, `npm`,
# `cat package.json`, `bash scripts/...`, `pm2 ...` fail unless the payload
# starts with `cd /home/ubuntu/Sports-Bar-TV-Controller`.
#
# v2 (2026-06-18): instead of only DENYing, this hook now AUTO-INJECTS the cd
# into the remote payload when it can do so safely (a literal single/double-
# quoted payload after the host), and only falls back to DENY when it can't
# confidently rewrite (e.g. the payload lives in a shell variable). Born from a
# session where the cd was dropped ~12× in a row despite the deny message.
#
# Allow-by-default on any error — a buggy hook must never block legit work.

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# 1. SSH command? (sshpass / tailscale ssh / ssh -flag / ssh user@host)
is_ssh() {
  echo "$cmd" | grep -qE '\bsshpass\b' && return 0
  echo "$cmd" | grep -qE '\btailscale[[:space:]]+ssh\b' && return 0
  echo "$cmd" | grep -qE '(^|[[:space:];&|`(])ssh[[:space:]]+(-[a-zA-Z]|[a-zA-Z0-9_-]+@)' && return 0
  return 1
}
is_ssh || exit 0

# 2. Remote payload references cwd-dependent commands?
needs_repo_cwd() {
  echo "$cmd" | grep -qE '\b(git|npm|npx|pnpm|yarn|drizzle-kit)[[:space:]]+[a-zA-Z]' && return 0
  echo "$cmd" | grep -qE 'bash[[:space:]]+([A-Za-z0-9_./-]+/)?scripts/' && return 0
  echo "$cmd" | grep -qE '(\bcat\b|\bless\b|\btail\b|\bhead\b)[[:space:]]+package\.json\b' && return 0
  echo "$cmd" | grep -qE 'python3?[[:space:]]+-c[[:space:]].*package\.json' && return 0
  echo "$cmd" | grep -qE '\bpm2[[:space:]]+(start|restart|reload)[[:space:]]+(ecosystem|sports-bar)' && return 0
  return 1
}
needs_repo_cwd || exit 0

# 3. Already cd'd into the repo? (absolute or bare from /home/ubuntu)
echo "$cmd" | grep -qE '\bcd[[:space:]]+(/home/ubuntu/)?Sports-Bar-TV-Controller\b' && exit 0

# 4. Explicit escape hatch.
echo "$cmd" | grep -qF -- '--i-know-what-im-doing' && exit 0

# 5. TRY TO AUTO-INJECT the cd into the literal quoted payload. Matches a
#    single- or double-quoted string (the remote payload) that contains a
#    cwd-dependent verb, and inserts the cd right after its opening quote.
#    Never crosses quote boundaries (?!\2), so it leaves the command untouched
#    (→ DENY) when the payload is in a variable — we never emit a malformed
#    rewrite.
fixed=$(CMD="$cmd" perl -e '
  my $c = $ENV{CMD};
  my $cd = "cd /home/ubuntu/Sports-Bar-TV-Controller && ";
  my $verb = qr/(?:bash\s+(?:[\w.\/-]+\/)?scripts\/|\bgit\s+[a-z]|\b(?:npm|npx|pnpm|yarn|drizzle-kit)\s+[a-z]|\b(?:cat|less|tail|head)\s+package\.json|python3?\s+-c\b[^"\x27]*package\.json|\bpm2\s+(?:start|restart|reload)\s+(?:ecosystem|sports-bar))/x;
  if ($c =~ s/([ \t])(["\x27])((?:(?!\2).)*?$verb(?:(?!\2).)*)\2/$1.$2.$cd.$3.$2/se) {
    print $c;
  }
' 2>/dev/null)

if [ -n "$fixed" ] && [ "$fixed" != "$cmd" ]; then
  jq -n --arg c "$fixed" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Auto-prepended cd /home/ubuntu/Sports-Bar-TV-Controller to the remote SSH payload.",
      updatedInput: { command: $c }
    }
  }'
  exit 0
fi

# 6. Could not safely auto-inject (payload in a shell variable, etc.) — DENY
#    with the explanatory reason so the cd is added explicitly.
msg='SSH command runs a cwd-dependent payload (git / npm / cat package.json / pm2 / bash scripts/...) without `cd /home/ubuntu/Sports-Bar-TV-Controller`, and the payload is in a shell variable so it could not be auto-fixed.

Fix one of:
  - Put the LITERAL `cd /home/ubuntu/Sports-Bar-TV-Controller && ` at the start of the remote payload (not via a $VAR — the auto-injector and this check both need the literal text).
  - Build the command in a script file whose remote payload string starts with the cd, then run `bash /tmp/that.sh` (no ssh verb in the top-level command, so this hook does not fire).
  - Genuinely cwd-independent payload: append --i-know-what-im-doing.

Memory: feedback_fleet_rollout_cd_prefix.'

jq -n --arg msg "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $msg
  }
}'
exit 0
