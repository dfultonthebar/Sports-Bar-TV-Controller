#!/bin/bash
# =============================================================================
# enforce-gotcha11-hardening.sh
# =============================================================================
#
# Purpose: Idempotently apply the four CLAUDE.md Gotcha #11 hardening items
# that make auto-update / RAG rescan / scheduler scripts actually fire on a
# fresh Ubuntu box. Without these, user-systemd timers silently die and
# subprocess `npx`/`ollama pull` invocations return "command not found" or
# "permission denied".
#
# Why this exists: today these steps are only printed as MANUAL commands in
#   - docs/NEW_LOCATION_SETUP.md §7b
#   - install.sh final banner
# Operators forget. Holmgren caught all three at v2.50.x rollout. This
# script automates them so a fresh install is hardened the first time.
#
# What it does (the four Gotcha #11 items):
#   1. enforce_linger        — `loginctl enable-linger ubuntu`
#   2. enforce_node_symlinks — symlink NVM node/npm/npx into /usr/local/bin
#   3. enforce_ollama_perms  — add ubuntu to ollama group + chgrp/chmod models
#   4. proof_all_working     — verify all three actually closed the gap
#
# Idempotency: every step checks for the desired end state first and prints
# "(already done)" on re-run. Safe to invoke from auto-update.sh, install.sh,
# or by hand. Re-running on a fully-hardened box exits 0 with no changes.
#
# Called from: install.sh (one-time at new-location bring-up).
#   Suggested wiring (not done by this script):
#     bash scripts/enforce-gotcha11-hardening.sh
#
# Usage:
#   sudo bash scripts/enforce-gotcha11-hardening.sh
#
# Exit codes:
#   0  — all four items PASS (or SKIP for legitimate reasons)
#   1  — must run as root
#   2  — linger enforcement failed
#   3  — node symlink enforcement failed
#   4  — ollama perms enforcement failed
#   5  — proof step caught a regression
# =============================================================================

set -e

# Color codes (mirrors verify-install.sh)
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Track which step we're in so the trap can name the failure
CURRENT_STEP="init"
trap 'echo -e "${RED}[gotcha11] FAIL during step: ${CURRENT_STEP}${NC}" >&2' ERR

log_pass() { echo -e "${GREEN}[gotcha11] PASS${NC} $1"; }
log_skip() { echo -e "${YELLOW}[gotcha11] SKIP${NC} $1"; }
log_fail() { echo -e "${RED}[gotcha11] FAIL${NC} $1" >&2; }
log_info() { echo -e "${BLUE}[gotcha11] $1${NC}"; }

# ---------------------------------------------------------------------------
# Root check — most items shell out to sudo subcommands, but we want a
# single up-front prompt rather than 6 separate ones, and several read-paths
# (e.g. test -w on the models dir) only behave correctly when we ARE root.
# ---------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  log_fail "must run as root. Try:  sudo bash $0"
  exit 1
fi

# ---------------------------------------------------------------------------
# Item 1 — Linger=yes on ubuntu user
# ---------------------------------------------------------------------------
enforce_linger() {
  CURRENT_STEP="enforce_linger"
  if loginctl show-user ubuntu 2>/dev/null | grep -q '^Linger=yes$'; then
    log_pass "linger already enabled for ubuntu (already done)"
    return 0
  fi
  log_info "enabling linger for ubuntu..."
  loginctl enable-linger ubuntu
  # Verify
  if loginctl show-user ubuntu 2>/dev/null | grep -q '^Linger=yes$'; then
    log_pass "linger enabled — user timers will now survive without an SSH session"
  else
    log_fail "loginctl enable-linger ran but Linger=yes not set"
    return 2
  fi
}

# ---------------------------------------------------------------------------
# Item 2 — NVM node/npm/npx in /usr/local/bin
# Background: systemd-fired scripts (rag-rescan-if-needed, scheduler) run
# without the operator's login shell PATH. NVM only adds itself via
# ~/.bashrc, so non-login subprocesses get the bare-bones PATH and fail on
# `npx tsx` with "command not found". Symlinking the actual binaries into
# /usr/local/bin (which IS on the default PATH) fixes it permanently.
# ---------------------------------------------------------------------------
enforce_node_symlinks() {
  CURRENT_STEP="enforce_node_symlinks"
  local nvm_root="/home/ubuntu/.nvm"
  if [ ! -d "$nvm_root/versions/node" ]; then
    log_skip "no NVM install at $nvm_root — node is APT-installed (or not yet present). Nothing to symlink."
    return 0
  fi

  # Detect the active version. Prefer the `default` alias if set (matches
  # what `nvm use default` would give a login shell); else fall back to
  # the lexicographically-highest installed version. CLAUDE.md shows the
  # symlink command targeting v20.20.0 — keep this dynamic so we don't
  # have to re-edit on every Node major bump.
  local active_ver=""
  if [ -f "$nvm_root/alias/default" ]; then
    active_ver=$(cat "$nvm_root/alias/default" 2>/dev/null | tr -d '[:space:]')
    # Alias may be a version range like "lts/*" — resolve to a real dir.
    if [ ! -d "$nvm_root/versions/node/$active_ver" ]; then
      active_ver=""
    fi
  fi
  if [ -z "$active_ver" ]; then
    # Use highest installed version (sort -V handles vN.N.N correctly)
    active_ver=$(ls -1 "$nvm_root/versions/node" 2>/dev/null | sort -V | tail -1)
  fi
  if [ -z "$active_ver" ] || [ ! -d "$nvm_root/versions/node/$active_ver" ]; then
    log_fail "NVM dir exists but no usable node version found under $nvm_root/versions/node"
    return 3
  fi

  local nvm_bin="$nvm_root/versions/node/$active_ver/bin"
  log_info "active NVM node: $active_ver ($nvm_bin)"

  local changed=0
  for tool in node npm npx; do
    local target="/usr/local/bin/$tool"
    local src="$nvm_bin/$tool"
    if [ ! -x "$src" ]; then
      log_fail "$src missing or not executable"
      return 3
    fi
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$src" ]; then
      continue   # already linked to the right place
    fi
    ln -sfv "$src" "$target" >&2
    changed=1
  done
  if [ "$changed" -eq 0 ]; then
    log_pass "node/npm/npx already symlinked into /usr/local/bin (already done)"
  else
    log_pass "node/npm/npx symlinked into /usr/local/bin → $nvm_bin"
  fi
}

# ---------------------------------------------------------------------------
# Item 3 — ollama models dir writable by ubuntu
# IPEX-LLM daemon runs as ubuntu (with SupplementaryGroups=ollama in its
# unit), but the models dir is owned ollama:ollama. New `ollama pull`
# operations fail mid-blob with "permission denied" unless the tree is
# group-writable AND ubuntu is in the ollama group.
# ---------------------------------------------------------------------------
enforce_ollama_perms() {
  CURRENT_STEP="enforce_ollama_perms"
  local models_dir="/usr/share/ollama/.ollama/models"

  # Determine if Ollama is even installed. On a virgin VM build this may
  # be deferred — skip cleanly rather than fail.
  local ollama_installed=0
  [ -d "/usr/share/ollama" ] && ollama_installed=1
  local has_ipex_unit=0
  systemctl list-unit-files 2>/dev/null | grep -q '^ollama-ipex\.service' && has_ipex_unit=1
  local has_upstream_unit=0
  systemctl list-unit-files 2>/dev/null | grep -q '^ollama\.service' && has_upstream_unit=1

  if [ "$ollama_installed" -eq 0 ] && [ "$has_ipex_unit" -eq 0 ] && [ "$has_upstream_unit" -eq 0 ]; then
    log_skip "Ollama not installed on this box — no models dir or systemd unit. Re-run after Ollama provisioning."
    return 0
  fi

  local needs_restart=0

  # 3a. ubuntu in ollama group?
  if id -nG ubuntu 2>/dev/null | tr ' ' '\n' | grep -qx ollama; then
    :   # already a member
  else
    log_info "adding ubuntu to ollama group..."
    usermod -aG ollama ubuntu
    needs_restart=1
  fi

  # 3b. models dir group + write bit. Only adjust if the tree actually exists.
  if [ -d "$models_dir" ]; then
    # Quick probe: try a group-write as ubuntu. If it works, the tree is
    # already correctly permissioned and we can skip the recursive chgrp/chmod.
    if sudo -u ubuntu test -w "$models_dir" 2>/dev/null; then
      :   # already writable
    else
      log_info "chgrp -R ollama + chmod g+w on $models_dir (may take a few seconds on large trees)..."
      chgrp -R ollama "$models_dir"
      chmod -R g+w "$models_dir"
      needs_restart=1
    fi
  else
    log_info "models dir $models_dir doesn't exist yet — will be created with correct perms on first pull"
  fi

  # 3c. Restart the daemon if we changed anything so the new group
  # membership / perms take effect. Prefer ollama-ipex (fleet standard
  # per CLAUDE.md §9), fall back to upstream ollama.
  if [ "$needs_restart" -eq 1 ]; then
    if [ "$has_ipex_unit" -eq 1 ]; then
      log_info "restarting ollama-ipex.service..."
      systemctl restart ollama-ipex
    elif [ "$has_upstream_unit" -eq 1 ]; then
      log_info "restarting ollama.service..."
      systemctl restart ollama
    else
      log_skip "no ollama systemd unit to restart — group/perm changes will apply on next daemon start"
    fi
    log_pass "ollama perms enforced (changes applied)"
  else
    log_pass "ollama perms already correct (already done)"
  fi
}

# ---------------------------------------------------------------------------
# Item 4 — Proof step. Verify all three above actually close the gap from
# the perspective a systemd-fired subprocess would experience.
# ---------------------------------------------------------------------------
proof_all_working() {
  CURRENT_STEP="proof_all_working"
  local proof_failed=0

  # 4a. Linger
  if loginctl show-user ubuntu 2>/dev/null | grep -q '^Linger=yes$'; then
    log_pass "proof: Linger=yes confirmed"
  else
    log_fail "proof: Linger=yes NOT set after enforcement"
    proof_failed=1
  fi

  # 4b. node/npm/npx resolvable from a clean PATH (simulates systemd
  # subprocess env). We DON'T require resolution if NVM wasn't present
  # AND apt-installed node also isn't on /usr/bin — then there's nothing
  # to symlink and the env is misconfigured upstream.
  local clean_path_env="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  for tool in node npm npx; do
    if env -i bash -c "export $clean_path_env; command -v $tool" >/dev/null 2>&1; then
      log_pass "proof: $tool resolvable from clean PATH"
    else
      log_fail "proof: $tool NOT resolvable from clean PATH (systemd subprocesses will fail)"
      proof_failed=1
    fi
  done

  # 4c. ubuntu can write into the ollama models dir. Skip if dir doesn't
  # exist (Ollama legitimately not installed — already SKIP'd above).
  local models_dir="/usr/share/ollama/.ollama/models"
  if [ -d "$models_dir" ]; then
    local probe="$models_dir/.gotcha11-write-probe-$$"
    if sudo -u ubuntu bash -c "touch '$probe' && rm -f '$probe'" 2>/dev/null; then
      log_pass "proof: ubuntu can write into $models_dir"
    else
      log_fail "proof: ubuntu CANNOT write into $models_dir — ollama pull will fail with permission denied"
      proof_failed=1
    fi
  else
    log_skip "proof: $models_dir doesn't exist — Ollama not installed, skipping write-probe"
  fi

  if [ "$proof_failed" -ne 0 ]; then
    return 5
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Drive
# ---------------------------------------------------------------------------
log_info "=== Gotcha #11 hardening enforcement ==="

enforce_linger        || exit 2
enforce_node_symlinks || exit 3
enforce_ollama_perms  || exit 4
proof_all_working     || exit 5

echo
log_pass "=== All four Gotcha #11 items enforced ==="
exit 0
