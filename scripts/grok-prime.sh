#!/bin/bash
#
# grok-prime.sh — Grok wrapper that prepends docs/GROK_BRIEFING.md to
# every prompt so the agent always knows the Standing Rules + Gotchas
# without us having to re-explain them per invocation.
#
# Usage:
#   bash scripts/grok-prime.sh <prompt-file>                     # one-shot
#   bash scripts/grok-prime.sh --task "..." [--file extra.md]    # inline task + optional supplemental file
#   echo "your prompt" | bash scripts/grok-prime.sh -            # stdin
#
# What it does:
#   1. Reads docs/GROK_BRIEFING.md (the rules)
#   2. Concatenates your prompt below it under a "## YOUR TASK" header
#   3. Pipes the combined prompt to `grok --permission-mode auto`
#   4. Streams Grok's response to stdout
#
# Why a wrapper instead of relying on Grok to read GROK_BRIEFING.md
# autonomously: Grok has tools but doesn't auto-read briefing files on
# every invocation. Prepending guarantees the rules are in context.
#
# Notes:
#   - GROK_BRIEFING.md is ~250 lines (~5KB). At Grok's context size this
#     is negligible compared to typical audit-scope file reads.
#   - For long-running deep audits, the briefing helps Grok stay on
#     style + cite the right standing rules in his recommendations.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIEFING="$REPO_ROOT/docs/GROK_BRIEFING.md"

if [ ! -f "$BRIEFING" ]; then
    echo "ERROR: $BRIEFING not found. This wrapper requires docs/GROK_BRIEFING.md." >&2
    exit 1
fi

# Parse args
TASK_INLINE=""
PROMPT_FILE=""
EXTRA_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --task)
            TASK_INLINE="$2"; shift 2 ;;
        --file)
            EXTRA_FILE="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,30p' "$0"
            exit 0 ;;
        -)
            PROMPT_FILE="/dev/stdin"; shift ;;
        *)
            if [ -z "$PROMPT_FILE" ]; then
                PROMPT_FILE="$1"
            else
                echo "ERROR: too many positional args. See --help." >&2
                exit 1
            fi
            shift ;;
    esac
done

if [ -z "$PROMPT_FILE" ] && [ -z "$TASK_INLINE" ]; then
    echo "ERROR: provide a prompt file, --task '...', or pipe to stdin with -" >&2
    exit 1
fi

# Build the combined prompt in a temp file
TMP_PROMPT=$(mktemp /tmp/grok-prime-XXXXXX.md)
trap 'rm -f "$TMP_PROMPT"' EXIT

{
    cat "$BRIEFING"
    echo ""
    echo "---"
    echo ""
    echo "## YOUR TASK"
    echo ""
    if [ -n "$TASK_INLINE" ]; then
        echo "$TASK_INLINE"
    fi
    if [ -n "$PROMPT_FILE" ]; then
        if [ -n "$TASK_INLINE" ]; then echo ""; echo "### Additional context"; echo ""; fi
        cat "$PROMPT_FILE"
    fi
    if [ -n "$EXTRA_FILE" ]; then
        echo ""
        echo "### Supplemental file"
        echo ""
        echo "Path: $EXTRA_FILE"
        echo ""
        echo '```'
        cat "$EXTRA_FILE"
        echo '```'
    fi
} > "$TMP_PROMPT"

# Tell the user what's about to happen
echo "Prompt size: $(wc -l < "$TMP_PROMPT") lines, $(wc -c < "$TMP_PROMPT") bytes" >&2
echo "Briefing: $BRIEFING ($(wc -l < "$BRIEFING") lines)" >&2
echo "---" >&2

# Invoke grok with auto permission (matches the pattern Claude has been
# using all session for non-destructive Grok audits)
exec grok --permission-mode auto --prompt-file "$TMP_PROMPT"
