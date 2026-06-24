#!/usr/bin/env bash
# fleet-hygiene-scan.sh — nightly "what's unwired / dead?" sweep.
#
# Finds the class of problem that bit us with ai_schedule_suggestions (a table that existed
# but nothing wrote) and dead API routes. Surfaces CANDIDATES for human review (does NOT
# delete anything — same propose-then-approve philosophy as improve-bartender-doc.sh).
# Summarizes via the LOCAL model (qwen-trader — the sports-bar model for EVERYTHING) and
# reports to the Honcho flywheel + a dated report + a System Admin todo when there are hits.
#
# Off-hours only (uses qwen-trader on the shared fanless T4 — see feedback_t4_gpu_sharing_rules).
set -u
REPO="${REPO:-/home/ubuntu/Sports-Bar-TV-Controller}"
DB="${PROD_DB:-/home/ubuntu/sports-bar-data/production.db}"
OLLAMA="${OLLAMA_REMOTE_BASE:-http://100.70.56.34:11434}"
MODEL="${HYGIENE_MODEL:-qwen-trader}"      # qwen is the sports-bar model for everything
OUTDIR="$REPO/docs/hygiene-reports"; mkdir -p "$OUTDIR"
TS="$(date +%Y-%m-%d-%H%M 2>/dev/null || echo now)"
OUT="$OUTDIR/hygiene-$TS.md"
cd "$REPO" || exit 1

# off-hours guard (ET 21:00–08:00) — heavy local inference only off-hours
ET_HOUR="$(TZ=America/New_York date +%H 2>/dev/null || echo 0)"
OFFHOURS=0; { [ "$ET_HOUR" -ge 21 ] || [ "$ET_HOUR" -lt 8 ]; } && OFFHOURS=1

# ── 1. ORPHAN TABLES: in the DB but referenced ≤1× in code (excluding the schema def) ──
orphan_tables=""
if [ -f "$DB" ]; then
  for t in $(sqlite3 "$DB" ".tables" 2>/dev/null | tr -s ' ' '\n'); do
    case "$t" in __drizzle*|sqlite_*|_*) continue;; esac
    camel="$(printf '%s' "$t" | sed -r 's/_(.)/\U\1/g')"
    refs="$(grep -rIl --include=*.ts -e "$t" -e "$camel" "$REPO/apps/web/src" "$REPO/packages" 2>/dev/null | grep -vE 'schema\.ts$' | wc -l | tr -d ' ')"
    # refs=0 only: a true orphan (in the DB, written/read by NOTHING) — this is the
    # ai_schedule_suggestions / AudioMessage class. refs>=1 are legit single-helper tables.
    [ "${refs:-0}" -eq 0 ] && orphan_tables="$orphan_tables  - $t"$'\n'
  done
fi

# ── 2. DEAD ROUTES: /api route whose path isn't referenced anywhere outside its own dir ──
dead_routes=""
while IFS= read -r r; do
  # skip DYNAMIC routes ([id] etc.) — they're called via template-literal fetch
  # (`/api/x/${id}`) which a literal grep can't see → unreliable, too many false deads.
  case "$r" in *'['*) continue;; esac
  dir="$(dirname "$r")"
  path="$(printf '%s' "$r" | sed -E 's#.*/app/api/##; s#/route\.ts$##')"
  base="/api/$path"
  refs="$(grep -rIl --include=*.ts --include=*.tsx -- "$base" "$REPO/apps/web/src" 2>/dev/null | grep -vF "$dir/" | wc -l | tr -d ' ')"
  [ "${refs:-0}" -eq 0 ] && dead_routes="$dead_routes  - $base"$'\n'
done < <(find "$REPO/apps/web/src/app/api" -name route.ts 2>/dev/null)

orphan_n="$(printf '%s' "$orphan_tables" | grep -c '  - ' || echo 0)"
dead_n="$(printf '%s' "$dead_routes" | grep -c '  - ' || echo 0)"

# ── 3. LLM triage (best-effort, off-hours, qwen-trader) ──
digest="(LLM digest skipped — not off-hours, or model unreachable)"
if { [ "$OFFHOURS" = 1 ] || [ "${HYGIENE_FORCE_DIGEST:-0}" = 1 ]; } && { [ "$orphan_n" -gt 0 ] || [ "$dead_n" -gt 0 ]; }; then
  export HSYS="You are a codebase-hygiene reviewer for a sports-bar TV control system (Next.js + Drizzle/SQLite). You are handed CANDIDATE orphan DB tables (in the DB but barely referenced in code) and CANDIDATE dead API routes (path not referenced outside its own folder). Some candidates are FALSE POSITIVES — routes called by cron/Nginx/external clients, or tables written only via raw SQL. For each candidate give a one-line verdict: LIKELY-DEAD (safe to investigate for removal), NEEDS-WIRING (looks half-built — exists but nothing uses it, like a feature that was never hooked up), or PROBABLY-FINE (likely a false positive — say why). Be concise; prioritize the NEEDS-WIRING ones since those are bugs (a built feature nobody can reach). Do NOT recommend deleting anything outright — this is for a human to triage."
  export HUSER="ORPHAN TABLE CANDIDATES (high-confidence — these tables exist in the DB but are written/read by NO code):
$orphan_tables
Give a per-table verdict (LIKELY-DEAD / NEEDS-WIRING / PROBABLY-FINE-via-raw-SQL). These are the reliable findings — focus here."
  BODY="$(M="$MODEL" python3 -c "import json,os;print(json.dumps({'model':os.environ['M'],'stream':False,'options':{'temperature':0.3,'num_predict':800},'messages':[{'role':'system','content':os.environ['HSYS']},{'role':'user','content':os.environ['HUSER']}]}))" 2>/dev/null)"
  d="$(curl -s --max-time 240 "$OLLAMA/api/chat" -H 'Content-Type: application/json' -d "$BODY" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get('message',{}).get('content',''))" 2>/dev/null)"
  [ -n "$d" ] && digest="$d"
fi

# ── 4. report ──
{
  echo "# Fleet hygiene scan — $TS"
  echo
  echo "Candidates for human triage (nothing was changed). Orphan tables: **$orphan_n**, dead routes: **$dead_n**."
  echo
  echo "## Orphan-table candidates (in DB, ≤1 code ref outside schema)"
  [ "$orphan_n" -gt 0 ] && printf '%s\n' "$orphan_tables" || echo "_none_"
  echo "## LLM triage of orphan tables ($MODEL) — the reliable findings"
  echo "$digest"
  echo
  echo "## Dead-route candidates — LOW CONFIDENCE, do not act without verifying"
  echo "_Static grep can't see routes called via the API client, cron, external devices, or"
  echo "template-literal fetch — so this list has many false positives (live routes like"
  echo "/api/health appear here). The RELIABLE way to find dead routes is runtime access logs"
  echo "(which routes got 0 hits in N days); that's a future enhancement. Raw list for reference:_"
  echo
  [ "$dead_n" -gt 0 ] && printf '%s\n' "$dead_routes" || echo "_none_"
} > "$OUT"
echo "wrote $OUT (orphan_tables=$orphan_n dead_routes=$dead_n)"

# ── 5. flywheel + Telegram (best-effort) ──
SUMMARY="fleet-hygiene-scan $TS: $orphan_n orphan-table + $dead_n dead-route candidate(s) for triage (report docs/hygiene-reports/hygiene-$TS.md). Catches unwired/dead stuff like the ai_schedule_suggestions orphan."
curl -sS -m 8 -X POST -H 'Content-Type: application/json' \
  "http://100.90.175.125:8000/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages" \
  -d "$(printf '%s' "$SUMMARY" | python3 -c 'import sys,json;print(json.dumps({"messages":[{"peer_id":"fleet-ops","content":sys.stdin.read()}]}))')" >/dev/null 2>&1 || true
if [ "$orphan_n" -gt 0 ] || [ "$dead_n" -gt 0 ]; then
  ssh -o BatchMode=yes -o ConnectTimeout=8 ubuntu@100.70.56.34 "~/.local/bin/hermes send -t telegram" >/dev/null 2>&1 <<EOF || true
🧹 Fleet hygiene scan ($TS): $orphan_n orphan-table + $dead_n dead-route candidate(s) to triage. Report: docs/hygiene-reports/hygiene-$TS.md
EOF
fi
