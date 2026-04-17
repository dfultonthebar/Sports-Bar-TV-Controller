#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — Append Location Update Note
# =============================================================================
# Prepends a new entry to docs/LOCATION_UPDATE_NOTES.md. That file is read
# by Claude Code at auto-update Checkpoint A, so whatever gets recorded here
# influences the GO/CAUTION/STOP decision on every location's next update.
#
# Usage:
#   bash scripts/add-update-note.sh
#     [--sha <commit-sha>]
#     [--summary "One-line summary"]
#     [--risk low|medium|high]
#
# If args are omitted, runs interactively.
#
# Safe to run from any branch. Commits only the notes file update, never
# amends. Does not push.
# =============================================================================

set -euo pipefail

REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
NOTES_FILE="$REPO_ROOT/docs/LOCATION_UPDATE_NOTES.md"
[ -f "$NOTES_FILE" ] || { echo "ERROR: $NOTES_FILE not found"; exit 1; }

cd "$REPO_ROOT"

SHA=""
SUMMARY=""
RISK=""

while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    --risk) RISK="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Default SHA = HEAD's short form
if [ -z "$SHA" ]; then
  SHA=$(git rev-parse --short=8 HEAD)
fi

DATE=$(date '+%Y-%m-%d')

if [ -z "$SUMMARY" ]; then
  read -r -p "One-line summary of what changed (shown in the entry header): " SUMMARY
  [ -z "$SUMMARY" ] && { echo "ERROR: summary required"; exit 1; }
fi

if [ -z "$RISK" ]; then
  read -r -p "Risk level (low / medium / high): " RISK
fi
case "$RISK" in
  low|medium|high) ;;
  *) echo "ERROR: risk must be one of: low medium high"; exit 1 ;;
esac

# Collect the free-form sections
echo
echo "Now drafting the four sections for the entry."
echo "Press Ctrl+D (EOF) on an empty line to finish each one."
echo

collect_block() {
  local prompt=$1
  echo "--- $prompt ---"
  local result=""
  local line
  while IFS= read -r line; do
    result+="$line"$'\n'
  done
  # Trim trailing newline
  printf '%s' "${result%$'\n'}"
}

WHAT_CHANGED=$(collect_block "What changed (multi-line ok)")
echo
WHAT_BREAKS=$(collect_block "What could break at a location (be honest)")
echo
MANUAL_STEPS=$(collect_block "Manual steps required (or 'None')")
echo
ROLLBACK=$(collect_block "Rollback notes")
echo
AFFECTED=$(collect_block "Affected files (one per line)")

# Build the entry
TMP_ENTRY=$(mktemp)
cat > "$TMP_ENTRY" <<EOF

### $DATE — \`$SHA\` — $SUMMARY

**Risk:** $RISK

**What changed:**

$WHAT_CHANGED

**What could break at a location:**

$WHAT_BREAKS

**Manual steps required:** $MANUAL_STEPS

**Rollback notes:** $ROLLBACK

**Affected files:**

$AFFECTED

---
EOF

# Insert the new entry AFTER the "## Current entries" marker
TMP_NOTES=$(mktemp)
awk -v entry_file="$TMP_ENTRY" '
  /^## Current entries$/ {
    print
    print ""
    while ((getline line < entry_file) > 0) print line
    close(entry_file)
    next
  }
  { print }
' "$NOTES_FILE" > "$TMP_NOTES"

mv "$TMP_NOTES" "$NOTES_FILE"
rm -f "$TMP_ENTRY"

echo
echo "[add-update-note] Entry prepended to $NOTES_FILE"
echo "[add-update-note] Preview (first 60 lines):"
echo "---"
head -60 "$NOTES_FILE"
echo "---"
echo
read -r -p "Commit this update to docs/LOCATION_UPDATE_NOTES.md now? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  git add "$NOTES_FILE"
  git commit -m "docs(update-notes): $DATE $SHA — $SUMMARY"
  echo "[add-update-note] Committed. Run 'git push' when ready."
else
  echo "[add-update-note] Left uncommitted. Edit further before committing if needed."
fi
