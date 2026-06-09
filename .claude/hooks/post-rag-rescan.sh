#!/bin/bash
# PostToolUse Bash — after a successful `git commit` that touched RAG-indexed
# paths (CLAUDE.md, docs/**, packages/*/README.md, .claude/locations/**),
# automatically trigger the RAG rescan in the background. Standing Rule 11.

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Only after a real `git commit`
echo "$cmd" | grep -qE '(^|[[:space:];&|`(])git[[:space:]]+commit($|[[:space:]])' || exit 0

REPO=/home/ubuntu/Sports-Bar-TV-Controller
# Get files touched in HEAD (the just-made commit). If no parent (initial commit), skip.
if ! git -C "$REPO" rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  exit 0
fi
changed=$(git -C "$REPO" diff --name-only HEAD~1 HEAD 2>/dev/null) || exit 0
[ -z "$changed" ] && exit 0

rag_hits=$(echo "$changed" | grep -E '^(CLAUDE\.md$|docs/.*\.(md|pdf|html)$|\.claude/locations/.*\.md$|packages/[^/]+/README\.md$)' | head -20)
[ -z "$rag_hits" ] && exit 0

# Fire rescan in background. Use the project's guarded helper so we don't
# stomp on a concurrent scan.
nohup bash "$REPO/scripts/rag-rescan-if-needed.sh" --force \
  >/tmp/rag-rescan-hook-$(date +%s).log 2>&1 </dev/null &
disown 2>/dev/null || true

n=$(echo "$rag_hits" | wc -l)
hits_short=$(echo "$rag_hits" | sed 's/^/  /')
msg="RAG rescan auto-triggered — last commit touched $n indexed file(s) (Standing Rule 11):
$hits_short

Background scan running; tail with: tail -f /tmp/rag-rescan-hook-*.log"

jq -n --arg msg "$msg" '{systemMessage: $msg}'
exit 0
