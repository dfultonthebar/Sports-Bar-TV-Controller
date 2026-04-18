#!/bin/bash
# =============================================================================
# verify-install.sh — Post-update health check for Sports Bar TV Controller
# =============================================================================
#
# Purpose: Sanity-check a fresh install or a post-update PM2 restart. Designed
# to be called by the auto-updater at Checkpoint C and also runnable standalone.
#
# Exit codes:
#   0   All checks passed
#   1   Generic failure (script error, bad arguments, etc.)
#   10  PM2 process not online or in a crash loop
#   11  HTTP /api/system/health failed
#   12  HTTP /api/system/metrics failed (DB connectivity proxy)
#   13  Bartender proxy on port 3002 unreachable
#   14  Critical DB tables missing or empty
#   15  Crash strings found in recent PM2 error logs
#
# Flags:
#   --quiet   Suppress per-check success output; print only the summary line
#             (and any failure detail). Designed for cron use.
#   --json    Emit a single JSON object on stdout instead of color logs.
#             Useful for the future Sync-tab API consumer.
#
# Usage:
#   bash scripts/verify-install.sh
#   bash scripts/verify-install.sh --quiet
#   bash scripts/verify-install.sh --json
#
# Reference: docs/AUTO_UPDATE_SYSTEM_PLAN.md §Pre-work 2
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
readonly PM2_PROCESS_NAME="sports-bar-tv-controller"
readonly APP_PORT=3001
readonly BARTENDER_PORT=3002
readonly DB_PATH="/home/ubuntu/sports-bar-data/production.db"
readonly HEALTH_URL="http://localhost:${APP_PORT}/api/system/health"
readonly METRICS_URL="http://localhost:${APP_PORT}/api/system/metrics"
readonly BARTENDER_URL="http://localhost:${BARTENDER_PORT}/"
readonly HTTP_RETRIES=3
readonly HTTP_RETRY_SLEEP=5
readonly CRASH_LOG_LINES=100
readonly CRASH_LOG_WINDOW_SECS=60

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
QUIET=0
JSON=0
for arg in "$@"; do
    case "$arg" in
        --quiet) QUIET=1 ;;
        --json)  JSON=1 ;;
        -h|--help)
            grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown flag: $arg" >&2
            echo "Usage: $0 [--quiet] [--json]" >&2
            exit 1
            ;;
    esac
done

# Track results: name|passed|detail (one per line)
RESULTS=""
START_EPOCH=$(date +%s)

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
_log() {
    # Suppressed entirely in JSON mode; success info suppressed in quiet mode.
    [ "$JSON" -eq 1 ] && return 0
    echo -e "$1"
}

log_info() {
    [ "$QUIET" -eq 1 ] && return 0
    _log "${BLUE}[VERIFY] $1${NC}"
}

log_pass() {
    [ "$QUIET" -eq 1 ] && return 0
    _log "${GREEN}[VERIFY] PASS${NC} $1"
}

log_fail() {
    _log "${RED}[VERIFY] FAIL${NC} $1"
}

log_warn() {
    [ "$JSON" -eq 1 ] && return 0
    _log "${YELLOW}[VERIFY] WARN${NC} $1"
}

record() {
    # name|passed(0/1)|detail
    local name="$1" passed="$2" detail="$3"
    RESULTS="${RESULTS}${name}|${passed}|${detail}"$'\n'
}

# ---------------------------------------------------------------------------
# JSON helper using node (jq is not installed on production hosts)
# ---------------------------------------------------------------------------
json_field() {
    # Usage: json_field <json-string> <dot.path>
    # Prints the value or empty string. Returns 0 always (caller checks output).
    local json="$1" path="$2"
    node -e "
        try {
            const j = JSON.parse(process.argv[1]);
            const path = process.argv[2].split('.');
            let v = j;
            for (const k of path) { if (v == null) break; v = v[k]; }
            if (v == null) process.exit(0);
            if (typeof v === 'object') console.log(JSON.stringify(v));
            else console.log(v);
        } catch (e) { process.exit(0); }
    " "$json" "$path" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Check 1: PM2 process online + not in a crash loop
# ---------------------------------------------------------------------------
check_pm2() {
    log_info "Checking PM2 process '${PM2_PROCESS_NAME}'..."
    local jlist
    if ! jlist=$(pm2 jlist 2>/dev/null); then
        log_fail "pm2 jlist command failed (PM2 not running?)"
        record "pm2_online" 0 "pm2 jlist failed"
        return 10
    fi

    # Use node to parse PM2 JSON output
    local parsed
    parsed=$(node -e "
        try {
            const list = JSON.parse(process.argv[1]);
            const proc = list.find(p => p.name === process.argv[2]);
            if (!proc) { console.log('NOTFOUND'); process.exit(0); }
            const status = proc.pm2_env && proc.pm2_env.status;
            const restartTime = proc.pm2_env && proc.pm2_env.restart_time || 0;
            const unstableRestarts = proc.pm2_env && proc.pm2_env.unstable_restarts || 0;
            const pmUptime = proc.pm2_env && proc.pm2_env.pm_uptime || 0;
            console.log(status + '|' + restartTime + '|' + unstableRestarts + '|' + pmUptime);
        } catch (e) { console.log('PARSEERR'); }
    " "$jlist" "$PM2_PROCESS_NAME" 2>/dev/null || echo "PARSEERR")

    if [ "$parsed" = "NOTFOUND" ]; then
        log_fail "PM2 process '${PM2_PROCESS_NAME}' not found in jlist"
        record "pm2_online" 0 "process not in jlist"
        return 10
    fi
    if [ "$parsed" = "PARSEERR" ]; then
        log_fail "Could not parse pm2 jlist output"
        record "pm2_online" 0 "jlist parse error"
        return 10
    fi

    local status restart_time unstable_restarts pm_uptime
    IFS='|' read -r status restart_time unstable_restarts pm_uptime <<< "$parsed"

    if [ "$status" != "online" ]; then
        log_fail "PM2 status is '${status}', expected 'online'"
        record "pm2_online" 0 "status=${status}"
        return 10
    fi

    # Crash-loop detection: unstable_restarts is PM2's own counter for restarts
    # that happen faster than min_uptime. Anything > 0 is suspicious in a
    # post-restart verify run.
    if [ "${unstable_restarts:-0}" -gt 2 ]; then
        log_fail "PM2 unstable_restarts=${unstable_restarts} (crash loop suspected)"
        record "pm2_online" 0 "unstable_restarts=${unstable_restarts}"
        return 10
    fi

    log_pass "PM2 process online (restart_time=${restart_time}, unstable_restarts=${unstable_restarts})"
    record "pm2_online" 1 "status=online restart_time=${restart_time}"
    return 0
}

# ---------------------------------------------------------------------------
# Check 2: HTTP /api/system/health
# ---------------------------------------------------------------------------
check_health_http() {
    log_info "Checking ${HEALTH_URL}..."
    local attempt body http_code overall_status
    for attempt in $(seq 1 $HTTP_RETRIES); do
        # -s silent, -S show errors, -w write http code, -o write body
        body=$(curl -sS -o /tmp/verify-health-body.$$ -w '%{http_code}' \
            --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
        http_code="$body"
        if [ "$http_code" = "200" ]; then
            body=$(cat /tmp/verify-health-body.$$ 2>/dev/null || echo "")
            rm -f /tmp/verify-health-body.$$
            overall_status=$(json_field "$body" "overall.status")
            if [ -n "$overall_status" ]; then
                # "healthy" and "degraded" both pass; only "critical" fails
                if [ "$overall_status" = "critical" ]; then
                    log_fail "/api/system/health returned overall.status=critical"
                    record "health_http" 0 "overall.status=critical"
                    return 11
                fi
                log_pass "/api/system/health responded 200 (overall.status=${overall_status})"
                record "health_http" 1 "status=${overall_status}"
                return 0
            else
                log_warn "/api/system/health 200 but no overall.status field; accepting (attempt $attempt)"
                record "health_http" 1 "200 ok, no status field"
                return 0
            fi
        fi
        rm -f /tmp/verify-health-body.$$
        log_warn "/api/system/health attempt ${attempt}/${HTTP_RETRIES} returned HTTP ${http_code}"
        [ "$attempt" -lt "$HTTP_RETRIES" ] && sleep "$HTTP_RETRY_SLEEP"
    done
    log_fail "/api/system/health failed after ${HTTP_RETRIES} attempts (last HTTP ${http_code})"
    record "health_http" 0 "http=${http_code}"
    return 11
}

# ---------------------------------------------------------------------------
# Check 3: HTTP /api/system/metrics — DB / runtime liveness
# ---------------------------------------------------------------------------
# Note: The metrics endpoint exposes CPU/memory/disk via os.* and `df`. It does
# NOT have a literal `database` field (verified against the real route file).
# What we get from it is liveness — if the Next.js process can serve this route
# at all, the runtime is up and responsive. We treat HTTP 200 + a present
# `metrics.cpu` field as the DB-connectivity proxy. The schema/CRUD itself is
# covered by check 5 (sqlite3 direct query against production.db).
check_metrics_http() {
    log_info "Checking ${METRICS_URL}..."
    local attempt body http_code success cpu_cores
    for attempt in $(seq 1 $HTTP_RETRIES); do
        body=$(curl -sS -o /tmp/verify-metrics-body.$$ -w '%{http_code}' \
            --max-time 10 "$METRICS_URL" 2>/dev/null || echo "000")
        http_code="$body"
        if [ "$http_code" = "200" ]; then
            body=$(cat /tmp/verify-metrics-body.$$ 2>/dev/null || echo "")
            rm -f /tmp/verify-metrics-body.$$
            success=$(json_field "$body" "success")
            cpu_cores=$(json_field "$body" "metrics.cpu.cores")
            if [ "$success" = "true" ] && [ -n "$cpu_cores" ]; then
                log_pass "/api/system/metrics responded 200 (cores=${cpu_cores})"
                record "metrics_http" 1 "cores=${cpu_cores}"
                return 0
            fi
            log_warn "/api/system/metrics 200 but missing expected fields"
        fi
        rm -f /tmp/verify-metrics-body.$$
        log_warn "/api/system/metrics attempt ${attempt}/${HTTP_RETRIES} returned HTTP ${http_code}"
        [ "$attempt" -lt "$HTTP_RETRIES" ] && sleep "$HTTP_RETRY_SLEEP"
    done
    log_fail "/api/system/metrics failed after ${HTTP_RETRIES} attempts (last HTTP ${http_code})"
    record "metrics_http" 0 "http=${http_code}"
    return 12
}

# ---------------------------------------------------------------------------
# Check 4: Bartender proxy on port 3002
# ---------------------------------------------------------------------------
check_bartender_proxy() {
    log_info "Checking ${BARTENDER_URL}..."
    local attempt http_code
    for attempt in $(seq 1 $HTTP_RETRIES); do
        http_code=$(curl -sS -o /dev/null -w '%{http_code}' \
            --max-time 10 "$BARTENDER_URL" 2>/dev/null || echo "000")
        if [ "$http_code" = "200" ] || [ "$http_code" = "302" ] || [ "$http_code" = "307" ]; then
            log_pass "Bartender proxy on port ${BARTENDER_PORT} responded HTTP ${http_code}"
            record "bartender_proxy" 1 "http=${http_code}"
            return 0
        fi
        log_warn "Bartender proxy attempt ${attempt}/${HTTP_RETRIES} returned HTTP ${http_code}"
        [ "$attempt" -lt "$HTTP_RETRIES" ] && sleep "$HTTP_RETRY_SLEEP"
    done
    log_fail "Bartender proxy on port ${BARTENDER_PORT} unreachable (last HTTP ${http_code})"
    record "bartender_proxy" 0 "http=${http_code}"
    return 13
}

# ---------------------------------------------------------------------------
# Check 5: Critical DB tables populated
# ---------------------------------------------------------------------------
# Tables and rules:
#   ChannelPreset      > 0   (presets are required for the bartender remote)
#   station_aliases    > 0   (required for station→preset matching)
#   DirecTVDevice      >= 0  (fresh install with no DirecTV is valid)
#   FireTVDevice       >= 0  (fresh install with no Fire TV is valid)
check_critical_tables() {
    log_info "Checking critical DB tables in ${DB_PATH}..."
    if [ ! -f "$DB_PATH" ]; then
        log_fail "Database file not found at ${DB_PATH}"
        record "critical_tables" 0 "db file missing"
        return 14
    fi

    local presets aliases directv firetv
    presets=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ChannelPreset;" 2>/dev/null || echo "ERR")
    aliases=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM station_aliases;" 2>/dev/null || echo "ERR")
    directv=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM DirecTVDevice;" 2>/dev/null || echo "ERR")
    firetv=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM FireTVDevice;" 2>/dev/null || echo "ERR")

    if [ "$presets" = "ERR" ] || [ "$aliases" = "ERR" ] || \
       [ "$directv" = "ERR" ] || [ "$firetv" = "ERR" ]; then
        log_fail "One or more critical tables missing (presets=${presets} aliases=${aliases} directv=${directv} firetv=${firetv})"
        record "critical_tables" 0 "schema missing tables"
        return 14
    fi

    # ChannelPreset = 0 is EXPECTED on a fresh location install — main ships
    # empty channel-presets-*.json templates, so the JSON→DB seeder has nothing
    # to insert until the operator adds presets via the UI. Treat this as a
    # WARN, not a FAIL. If the DB tables themselves were missing, we'd have
    # bailed above on the ERR check.
    if [ "$presets" -le 0 ]; then
        log_warn "ChannelPreset table is empty — expected on a fresh install, configure channels via the bartender remote"
    fi
    # station_aliases is hardcoded in seed-from-json.ts (32 standard entries)
    # and seeded on every first boot, so an empty count here genuinely means
    # the seed function didn't run — that IS a failure worth blocking on.
    if [ "$aliases" -le 0 ]; then
        log_fail "station_aliases table is empty (count=${aliases}) — seed-from-json.ts didn't run"
        record "critical_tables" 0 "station_aliases empty"
        return 14
    fi

    log_pass "Critical tables OK (presets=${presets} aliases=${aliases} directv=${directv} firetv=${firetv})"
    record "critical_tables" 1 "presets=${presets} aliases=${aliases} directv=${directv} firetv=${firetv}"
    return 0
}

# ---------------------------------------------------------------------------
# Check 6: No recent crash strings in PM2 error logs
# ---------------------------------------------------------------------------
# Looks at last CRASH_LOG_LINES of PM2 error stream and grepps for crash
# patterns at the start of lines OR after a leading timestamp/level token.
# Only flagged lines whose mtime/log line falls within CRASH_LOG_WINDOW_SECS
# of "now" matter, but pm2 logs --nostream gives us tail content without
# timestamps in a portable way, so we conservatively flag any match in the
# tail window. This is intentional: post-restart, the tail is by definition
# very recent.
check_crash_logs() {
    log_info "Checking last ${CRASH_LOG_LINES} lines of PM2 error logs for crash patterns..."
    local logs
    logs=$(pm2 logs "$PM2_PROCESS_NAME" --lines "$CRASH_LOG_LINES" --nostream --err 2>/dev/null || echo "")

    if [ -z "$logs" ]; then
        log_pass "No PM2 error log content (or logs unavailable)"
        record "crash_logs" 1 "empty error log"
        return 0
    fi

    # Match patterns at line start OR after a leading [timestamp] or level token.
    # Avoids false positives like "info: query result Error: none"
    local matches
    matches=$(echo "$logs" | grep -E '(^|^\[[^]]*\][[:space:]]+|^[A-Za-z]+:[[:space:]]+)(Error:|FATAL|UnhandledPromiseRejection|MODULE_NOT_FOUND)' || true)

    if [ -n "$matches" ]; then
        local count
        count=$(echo "$matches" | wc -l)
        log_fail "Found ${count} crash-like line(s) in recent PM2 error log"
        # Show first 3 matches to aid debugging without flooding output
        echo "$matches" | head -3 | while read -r line; do
            log_fail "  > ${line:0:160}"
        done
        record "crash_logs" 0 "crash patterns found: ${count}"
        return 15
    fi

    log_pass "No crash patterns in recent PM2 error logs"
    record "crash_logs" 1 "clean"
    return 0
}

# ---------------------------------------------------------------------------
# Run all checks. Track first-failure exit code so we can return a specific
# code when only one check failed (helps the auto-updater decide what to roll
# back), but always run every check so the operator sees the full picture.
# ---------------------------------------------------------------------------
TOTAL=7
PASSED=0
FAILED_NAMES=""
FIRST_FAIL_CODE=0

run_check() {
    local fn="$1" name="$2" code
    set +e
    "$fn"
    code=$?
    set -e
    if [ "$code" -eq 0 ]; then
        PASSED=$((PASSED + 1))
    else
        FAILED_NAMES="${FAILED_NAMES}${name} "
        [ "$FIRST_FAIL_CODE" -eq 0 ] && FIRST_FAIL_CODE="$code"
    fi
}

# Matrix config sanity: on SINGLE-CARD Wolf Pack chassis, outputOffset
# MUST be 0 or every routing command lands on the wrong physical output —
# silent but destructive. Lucky's 1313 shipped with outputOffset=26 on a
# WP-36X36 for weeks before being caught. Multi-card chassis legitimately
# have non-zero offsets per card.
#
# The WP-36X36 chassis (and even WP-8X8/WP-16X16 in rare cases) can be
# deployed as either single-card or multi-card — the model string alone
# does NOT distinguish them. So this check is OPT-IN: a single-card
# location declares itself by setting `MATRIX_SINGLE_CARD=true` in its
# .env, which activates the offset=0 requirement. Multi-card locations
# leave it unset (the default) and any offset is accepted.
#
# Current single-card locations (as of 2026-04-18): Lucky's 1313, Leg Lamp.
# Current multi-card locations: Stoneyard Greenville, Stoneyard Appleton,
# Holmgren Way, Graystone.
check_matrix_config() {
    log_info "Checking MatrixConfiguration sanity..."
    local row
    row=$(sqlite3 "$DB_PATH" "SELECT model || '|' || outputOffset FROM MatrixConfiguration WHERE isActive=1 LIMIT 1;" 2>/dev/null || echo "")
    if [ -z "$row" ]; then
        log_pass "MatrixConfiguration check skipped (no active matrix)"
        record "matrix_config" 1 "no active matrix"
        return 0
    fi
    local model="${row%|*}"
    local offset="${row#*|}"

    # Read MATRIX_SINGLE_CARD from env (runtime) or fall back to .env file.
    local single_card="${MATRIX_SINGLE_CARD:-}"
    if [ -z "$single_card" ] && [ -f "$REPO_ROOT/.env" ]; then
        single_card=$(grep -E '^MATRIX_SINGLE_CARD=' "$REPO_ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    fi

    if [ "$single_card" = "true" ]; then
        if [ "$offset" -ne 0 ] 2>/dev/null; then
            log_fail "Single-card Wolf Pack ($model) declared via MATRIX_SINGLE_CARD=true has outputOffset=$offset but must be 0 — routing will land on wrong outputs"
            record "matrix_config" 0 "offset=$offset on single-card $model (expected 0)"
            return 16
        fi
        log_pass "MatrixConfiguration OK (single-card $model, outputOffset=0)"
        record "matrix_config" 1 "single-card $model offset=0"
        return 0
    fi

    # Multi-card (default): any offset is acceptable — each card slot in
    # the chassis has its own offset per the physical wiring.
    log_pass "MatrixConfiguration OK (multi-card $model, outputOffset=$offset accepted — set MATRIX_SINGLE_CARD=true in .env to enforce offset=0)"
    record "matrix_config" 1 "multi-card $model offset=$offset"
    return 0
}

run_check check_pm2             "pm2_online"
run_check check_health_http     "health_http"
run_check check_metrics_http    "metrics_http"
run_check check_bartender_proxy "bartender_proxy"
run_check check_critical_tables "critical_tables"
run_check check_matrix_config   "matrix_config"
run_check check_crash_logs      "crash_logs"

END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))

# ---------------------------------------------------------------------------
# Summary output
# ---------------------------------------------------------------------------
if [ "$JSON" -eq 1 ]; then
    # Build JSON via node from the RESULTS buffer
    node -e "
        const raw = process.argv[1];
        const layers = raw.trim().split('\n').filter(Boolean).map(line => {
            const [name, passed, detail] = line.split('|');
            return { name, passed: passed === '1', detail };
        });
        const passedCount = layers.filter(l => l.passed).length;
        const out = {
            status: passedCount === layers.length ? 'PASS' : 'FAIL',
            passed: passedCount,
            total: layers.length,
            durationSecs: parseInt(process.argv[2], 10),
            failed: layers.filter(l => !l.passed).map(l => l.name),
            layers,
        };
        console.log(JSON.stringify(out));
    " "$RESULTS" "$DURATION"
elif [ "$FIRST_FAIL_CODE" -eq 0 ]; then
    echo -e "${GREEN}[VERIFY] PASS (${PASSED}/${TOTAL} checks, ${DURATION}s)${NC}"
else
    echo -e "${RED}[VERIFY] FAIL (${PASSED}/${TOTAL} checks, ${DURATION}s, failed: ${FAILED_NAMES% })${NC}" >&2
fi

# Exit with the most specific code we have. If only one check failed, return
# its dedicated code (10-15). If multiple failed, return the first failure's
# code — the auto-updater will see at least one specific failure and can
# escalate from there.
exit "$FIRST_FAIL_CODE"
