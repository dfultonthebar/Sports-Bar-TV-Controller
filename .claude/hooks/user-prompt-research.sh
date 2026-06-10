#!/bin/bash
# UserPromptSubmit — when the operator's message mentions known hardware
# (model numbers, vendor names), pre-fetch a research brief and inject
# it as additionalContext so Claude has the vendor docs in hand BEFORE
# starting to plan the work.
#
# Cache: shared 24h TTL. Silent (exit 0 with no output) for prompts
# that don't mention hardware. Same Grok backend as pre-bash-research.

set -u
LIB="$(dirname "$0")/lib/research-helpers.sh"
[ -f "$LIB" ] || exit 0
. "$LIB"

# UserPromptSubmit payload: { prompt: "...", session_id: "..." }
prompt=$(jq -r '.prompt // empty' 2>/dev/null) || exit 0
[ -z "$prompt" ] && exit 0

matched=$(detect_hardware_patterns "$prompt")
[ -z "$matched" ] && exit 0

context=""
for key in $matched; do
  research=$(research_hardware "$key" 2>/dev/null)
  [ -z "$research" ] && continue
  echo "$research" | grep -qi "no specific research\|no_research_available\|research unavailable" && continue
  context+="### Auto-research (from your message): $key"$'\n'"$research"$'\n\n'
done

[ -z "$context" ] && exit 0

# UserPromptSubmit additionalContext gets prepended to the conversation
# turn — Claude reads it first, then your prompt.
jq -n --arg c "$context" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $c
  }
}'
exit 0
