#!/bin/bash
#
# test-claude-cron-env.sh
#
# Pre-work 3 diagnostic: verifies the Claude Code CLI can be invoked
# headlessly from a cron-minimal shell environment. The auto-update
# feature depends on this working — if this script fails, auto-update
# cannot ship.
#
# Run manually as the `ubuntu` user. NOT a cron job itself; this is
# the diagnostic you run to prove cron WOULD work.
#
# Exit codes:
#   0  = all checks passed, Claude Code is cron-ready
#   10 = claude binary not found at expected path
#   11 = claude not on PATH even with .local/bin addition
#   12 = headless `claude -p` returned non-zero or empty output
#   13 = headless response didn't match expected content
#   14 = headless call exceeded 60-second budget
#

set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log_info()    { echo -e "${BLUE}[TEST] $*${NC}"; }
log_ok()      { echo -e "${GREEN}[TEST] ✓ $*${NC}"; }
log_fail()    { echo -e "${RED}[TEST] ✗ $*${NC}"; }
log_warn()    { echo -e "${YELLOW}[TEST] $*${NC}"; }

# Expected install path — matches what Pre-work 3 found on Stoneyard.
# If Claude Code is installed elsewhere on a new location, update this.
readonly CLAUDE_BIN="/home/ubuntu/.local/bin/claude"
readonly CRON_PATH="/home/ubuntu/.local/bin:/usr/bin:/bin"

# -----------------------------------------------------------------------------
# Check 1 — binary exists at expected path
# -----------------------------------------------------------------------------
check_binary_exists() {
    log_info "Check 1: Claude Code binary at $CLAUDE_BIN"
    if [ -x "$CLAUDE_BIN" ] || [ -L "$CLAUDE_BIN" ]; then
        local version
        version=$("$CLAUDE_BIN" --version 2>&1 | head -1 || echo "unknown")
        log_ok "Found: $version"
        return 0
    fi
    log_fail "Not found at $CLAUDE_BIN"
    log_warn "Install Claude Code CLI or update CLAUDE_BIN in this script"
    return 10
}

# -----------------------------------------------------------------------------
# Check 2 — resolvable via PATH in a sanitized env
# -----------------------------------------------------------------------------
check_path_resolution() {
    log_info "Check 2: 'claude' resolves via cron-minimal PATH"
    local found
    found=$(env -i HOME=/home/ubuntu LOGNAME=ubuntu PATH="$CRON_PATH" SHELL=/bin/sh PWD=/home/ubuntu bash -c 'command -v claude' 2>&1 || true)
    if [ -z "$found" ]; then
        log_fail "'claude' not found with PATH=$CRON_PATH"
        log_warn "The crontab line must prepend /home/ubuntu/.local/bin to PATH"
        return 11
    fi
    log_ok "Resolved to: $found"
    return 0
}

# -----------------------------------------------------------------------------
# Check 3 — headless print-mode invocation returns output
# -----------------------------------------------------------------------------
check_headless_invocation() {
    log_info "Check 3: headless 'claude -p' returns output in a sanitized env"
    local output
    local exit_code=0
    local start end elapsed

    start=$(date +%s)
    output=$(env -i HOME=/home/ubuntu LOGNAME=ubuntu PATH="$CRON_PATH" SHELL=/bin/sh PWD=/home/ubuntu bash -c \
        'timeout 60 claude -p "Respond with just the single word OK and nothing else." 2>&1') || exit_code=$?
    end=$(date +%s)
    elapsed=$((end - start))

    if [ "$exit_code" -eq 124 ]; then
        log_fail "Timed out after 60s (exit 124)"
        return 14
    fi
    if [ "$exit_code" -ne 0 ]; then
        log_fail "Non-zero exit: $exit_code"
        log_warn "Output: $output"
        return 12
    fi
    if [ -z "$output" ]; then
        log_fail "Empty output"
        return 12
    fi
    log_ok "Exit 0 in ${elapsed}s, got: ${output}"

    # Check 3b — content match (soft regression check)
    if ! echo "$output" | grep -qi "OK"; then
        log_fail "Response didn't contain 'OK': $output"
        return 13
    fi
    log_ok "Response content matches expected"
    return 0
}

# -----------------------------------------------------------------------------
# Check 4 — structured JSON response (what real auto-update checkpoints expect)
# -----------------------------------------------------------------------------
check_structured_response() {
    log_info "Check 4: structured JSON response"
    local output
    local exit_code=0

    output=$(env -i HOME=/home/ubuntu LOGNAME=ubuntu PATH="$CRON_PATH" SHELL=/bin/sh PWD=/home/ubuntu bash -c \
        'timeout 60 claude -p "Reply with this exact JSON and nothing else: {\"verdict\":\"ok\",\"test\":\"cron-env\"}" 2>&1') || exit_code=$?

    if [ "$exit_code" -ne 0 ]; then
        log_fail "Non-zero exit: $exit_code"
        return 12
    fi
    if ! echo "$output" | grep -q '"verdict"'; then
        log_fail "Response didn't look like JSON: $output"
        return 13
    fi
    log_ok "Structured response parsed: $(echo "$output" | tr -d '\n' | head -c 100)"
    return 0
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local failures=0
    local codes=()

    log_info "Claude Code cron-environment diagnostic"
    log_info "========================================"

    check_binary_exists    || { failures=$((failures+1)); codes+=("$?"); }
    check_path_resolution  || { failures=$((failures+1)); codes+=("$?"); }
    check_headless_invocation || { failures=$((failures+1)); codes+=("$?"); }
    check_structured_response || { failures=$((failures+1)); codes+=("$?"); }

    echo ""
    if [ "$failures" -eq 0 ]; then
        echo -e "${GREEN}[TEST] Claude Code cron-env: PASS (4/4 checks)${NC}"
        echo "[TEST] Auto-update can safely depend on Claude Code CLI from cron."
        exit 0
    fi

    echo -e "${RED}[TEST] Claude Code cron-env: FAIL ($failures/4 checks failed)${NC}"
    echo "[TEST] Failure exit codes: ${codes[*]}"
    echo "[TEST] Auto-update CANNOT ship until this passes."
    exit "${codes[0]}"
}

main "$@"
