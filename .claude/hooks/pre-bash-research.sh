#!/bin/bash
# PreToolUse Bash — when the about-to-run command references known
# hardware OR contains a recognizable hardware-comm error signature,
# inject a research dossier so Claude has the vendor docs / known
# issues in context BEFORE running the command (so a failed run can
# pivot to the right fix without an extra round-trip).
#
# Stays SILENT (exit 0, no JSON output) for any command that doesn't
# match a research pattern — runs maybe 5-10% of bash invocations.
#
# Cache: shared 24h TTL via .claude/hooks/lib/research-helpers.sh.
# Never blocks the command; even on Grok error it returns silent allow.

set -u
LIB="$(dirname "$0")/lib/research-helpers.sh"
[ -f "$LIB" ] || exit 0
. "$LIB"

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Skip commands that are pure data-shaping (grep, awk, sed, cat, ls etc.)
# without an actual hardware reference — speedup.
matched=$(detect_hardware_patterns "$cmd")
[ -z "$matched" ] && exit 0

# We have a match — assemble research for each unique hardware key.
# Skip empty / "no research available" / placeholder responses to avoid
# injecting noise into Claude's context (Grok's web-tool config is still
# being tuned per #333 — until then, hooks pattern-detect but only
# inject genuinely informative results).
context=""
for key in $matched; do
  research=$(research_hardware "$key" 2>/dev/null)
  [ -z "$research" ] && continue
  echo "$research" | grep -qi "no specific research\|no_research_available\|research unavailable" && continue
  context+="### Auto-research: $key"$'\n'"$research"$'\n\n'
done

[ -z "$context" ] && exit 0

# Inject via PreToolUse additionalContext — visible to Claude before
# the bash command runs. Non-blocking — Claude can use or ignore.
jq -n --arg c "$context" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: $c
  }
}'
exit 0
