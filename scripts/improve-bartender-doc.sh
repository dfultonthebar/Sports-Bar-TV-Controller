#!/usr/bin/env bash
# improve-bartender-doc.sh [doc.md]
#
# Uses the LOCAL LLM (qwen-trader on the shared T4) to review ONE bartender how-to
# against the CURRENT code and suggest bartender-grade improvements. Writes a REVIEW
# NOTE for human approval — it does NOT overwrite the live doc. (LLM-generated edits to
# bartender-facing guides get a human in the loop; see CLAUDE.md Gotcha #12 — the model
# paraphrases/embellishes, so we review before shipping.)
#
# With no arg, picks the NEXT doc in rotation (round-robins through docs/bartender-help/
# via a cursor file) so a nightly cron covers every doc over time, then loops.
#
# Off-hours + GPU-light: one doc = a couple LLM calls. Logs the run to the Honcho flywheel.
set -u
REPO="${REPO:-/home/ubuntu/Sports-Bar-TV-Controller}"
HELPDIR="$REPO/docs/bartender-help"
OUTDIR="$HELPDIR/_reviews"
CURSOR="$REPO/.git/.bartender-doc-cursor"          # in .git so it never ships in a doc commit
OLLAMA="${OLLAMA_REMOTE_BASE:-http://100.70.56.34:11434}"
MODEL="${DOC_REVIEW_MODEL:-qwen-trader}"
mkdir -p "$OUTDIR"

# --- pick the doc ---------------------------------------------------------------
DOC="${1:-}"
if [ -z "$DOC" ]; then
  mapfile -t DOCS < <(ls -1 "$HELPDIR"/*.md 2>/dev/null | grep -v '/_' | sort)
  [ "${#DOCS[@]}" -eq 0 ] && { echo "no docs found in $HELPDIR"; exit 1; }
  last=$(cat "$CURSOR" 2>/dev/null || echo "")
  idx=0
  for i in "${!DOCS[@]}"; do [ "${DOCS[$i]}" = "$last" ] && { idx=$(( (i+1) % ${#DOCS[@]} )); break; }; done
  DOC="${DOCS[$idx]}"
  echo "$DOC" > "$CURSOR"
fi
[ -f "$DOC" ] || { echo "no such doc: $DOC"; exit 1; }
name="$(basename "$DOC" .md)"
OUT="$OUTDIR/$name.review.md"
echo "Reviewing: $name  (model=$MODEL)"

# --- gather code context: grep the repo for nouns the doc references ------------
DOCTEXT="$(cat "$DOC")"
terms="$(printf '%s' "$DOCTEXT" | grep -oE '[A-Z][A-Za-z]+(Panel|Remote|Selector|Control|Layout|Widget|Tab|Card)|/api/[a-z0-9/_-]+' | sort -u | head -18)"
codectx=""
for t in $terms; do
  hit="$(grep -rl --include=*.tsx --include=*.ts -- "$t" "$REPO/apps/web/src" 2>/dev/null | head -1)"
  [ -n "$hit" ] || continue
  snip="$(grep -nE '(placeholder=|title=|aria-label=|label:|>[A-Z][A-Za-z ]{2,40}<|toast|Success|Failed|error)' "$hit" 2>/dev/null | head -18)"
  codectx="$codectx

### $t  (${hit#$REPO/})
$snip"
done
[ -z "$codectx" ] && codectx="(no matching component/route names found in the doc — review for clarity only)"

# --- prompt the local LLM (system prompt overrides qwen-trader's baked rubric) ---
export REVSYS="You are a documentation QA reviewer for a sports-bar TV control system. You check how-to guides written for BARTENDERS (non-technical, busy, working on an iPad) against the CURRENT code. Bartender voice rules: plain words, NO jargon (say 'the video system' not 'Wolf Pack matrix'; 'send a source to a TV' not 'route'; 'the silver box' not 'the receiver'), single-action numbered steps, reassurance and a recovery path. Output a SHORT review with exactly these sections: '## Accuracy' (anything in the doc that no longer matches the code or on-screen labels — quote the doc text and the code label), '## Missing' (useful things the code clearly does that the doc omits), '## Clarity' (wording too technical/confusing for a bartender, each with a concrete fix). If a section has nothing, write 'Looks good.' Do NOT rewrite the whole doc. Be specific, cite labels, keep it under ~400 words."
export REVUSER="DOC FILE: $name.md

=== CURRENT DOC ===
$DOCTEXT

=== RELEVANT CODE (on-screen labels, JSX, toasts, routes) ===
$codectx

Review this doc per your instructions."

BODY="$(M="$MODEL" python3 -c "import json,os; print(json.dumps({'model':os.environ['M'],'stream':False,'options':{'temperature':0.3,'num_predict':700},'messages':[{'role':'system','content':os.environ['REVSYS']},{'role':'user','content':os.environ['REVUSER']}]}))" 2>/dev/null)"
[ -z "$BODY" ] && { echo "failed to build request body"; exit 1; }
review="$(curl -s --max-time 240 "$OLLAMA/api/chat" -H 'Content-Type: application/json' -d "$BODY" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('message',{}).get('content',''))" 2>/dev/null)"
if [ -z "$review" ]; then echo "LLM returned nothing (Ollama unreachable or model not loaded?)"; exit 2; fi

# --- write the review note ------------------------------------------------------
{
  echo "# Doc review: $name.md"
  echo
  echo "*Auto-generated $(date '+%Y-%m-%d %H:%M') by improve-bartender-doc.sh (local LLM: $MODEL)."
  echo "Suggestions only — review and apply by hand. The live doc was NOT changed.*"
  echo
  echo "$review"
} > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines)"

# --- log to the Honcho flywheel + ping Telegram (best-effort) --------------------
SUMMARY="bartender-doc review generated for $name.md via local LLM ($MODEL) — suggestions queued at docs/bartender-help/_reviews/$name.review.md for human approval"
curl -sS -m 8 -X POST -H 'Content-Type: application/json' \
  "http://100.90.175.125:8000/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages" \
  -d "$(printf '%s' "$SUMMARY" | python3 -c 'import sys,json; print(json.dumps({"messages":[{"peer_id":"fleet-ops","content":sys.stdin.read()}]}))')" >/dev/null 2>&1 || true
