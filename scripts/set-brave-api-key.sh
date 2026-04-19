#!/bin/bash
# set-brave-api-key.sh — install a Brave Search API key at this location.
#
# Stores the key in TWO places so both the PM2 runtime AND any interactive
# Claude Code session pick it up:
#
#   1. /home/ubuntu/Sports-Bar-TV-Controller/.env — read by PM2's
#      ecosystem.config.js via require('dotenv').config() at process
#      start. Needed so the brave-search MCP can read BRAVE_API_KEY when
#      Claude Code launches with the repo's .mcp.json.
#
#   2. ~/.bashrc — exported into every new interactive shell. Needed so
#      `claude` sessions launched from the terminal see the key without
#      a separate `source .env`.
#
# Idempotent: if the var is already set in either file, the script
# UPDATES the value (same file, no duplicate lines). If the new value
# matches the existing value, no write happens.
#
# Both files are gitignored — no commit risk. The key never reaches any
# branch.
#
# Usage:
#   bash scripts/set-brave-api-key.sh <key>
#   bash scripts/set-brave-api-key.sh --remove    # uninstall
#
# Test the key with:
#   bash scripts/set-brave-api-key.sh --test
# (requires a live shell-session export; run `source ~/.bashrc` first)
#
# Free-tier signup: https://api.search.brave.com/app/keys
# (2-min flow, no credit card, 2,000 queries/month per key)

set -euo pipefail

REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
ENV_FILE="$REPO_ROOT/.env"
BASHRC="$HOME/.bashrc"
VAR_NAME="BRAVE_API_KEY"

usage() {
  cat <<EOF
Usage:
  bash scripts/set-brave-api-key.sh <key>         # install/update the key
  bash scripts/set-brave-api-key.sh --remove      # uninstall
  bash scripts/set-brave-api-key.sh --test        # probe the Brave API to confirm key works
  bash scripts/set-brave-api-key.sh --show        # show what's currently set (masked)

Signup: https://api.search.brave.com/app/keys
EOF
  exit 0
}

mask_key() {
  local key="$1"
  if [ -z "$key" ]; then echo "(unset)"; return; fi
  local len=${#key}
  if [ "$len" -lt 10 ]; then
    echo "****"
  else
    echo "${key:0:6}******${key: -4}"
  fi
}

current_from_env() {
  [ -f "$ENV_FILE" ] && grep -E "^${VAR_NAME}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
}

current_from_bashrc() {
  grep -E "^export ${VAR_NAME}=" "$BASHRC" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

show() {
  echo ".env:      $(mask_key "$(current_from_env)")"
  echo "~/.bashrc: $(mask_key "$(current_from_bashrc)")"
}

remove() {
  echo "Removing $VAR_NAME from .env and ~/.bashrc..."
  # .env
  if [ -f "$ENV_FILE" ] && grep -qE "^${VAR_NAME}=" "$ENV_FILE"; then
    sed -i "/^${VAR_NAME}=/d" "$ENV_FILE"
    echo "  .env:      removed"
  else
    echo "  .env:      (not set)"
  fi
  # ~/.bashrc — also remove the comment header if our install added it
  if [ -f "$BASHRC" ] && grep -qE "^export ${VAR_NAME}=" "$BASHRC"; then
    sed -i "/^# Brave Search MCP/d; /^export ${VAR_NAME}=/d" "$BASHRC"
    echo "  ~/.bashrc: removed (open a new shell or run \`unset ${VAR_NAME}\` to clear the current session)"
  else
    echo "  ~/.bashrc: (not set)"
  fi
}

set_key() {
  local key="$1"
  if [ -z "$key" ]; then
    echo "ERROR: empty key. Use --remove to uninstall." >&2
    exit 2
  fi
  # Basic sanity — Brave keys start with BS and are ~32-33 chars. Don't
  # reject on format alone in case the format changes; just warn.
  if [[ ! "$key" =~ ^BS[A-Za-z0-9_]{20,} ]]; then
    echo "WARN: key doesn't look like a Brave API key (expected BS...)." >&2
    echo "      Proceeding anyway." >&2
  fi

  # Update .env (idempotent)
  touch "$ENV_FILE"
  if grep -qE "^${VAR_NAME}=" "$ENV_FILE"; then
    local existing
    existing=$(current_from_env)
    if [ "$existing" = "$key" ]; then
      echo "  .env:      unchanged (same value)"
    else
      # Use a literal delimiter that can't appear in a key
      sed -i "s#^${VAR_NAME}=.*#${VAR_NAME}=${key}#" "$ENV_FILE"
      echo "  .env:      updated"
    fi
  else
    echo "${VAR_NAME}=${key}" >> "$ENV_FILE"
    echo "  .env:      added"
  fi

  # Update ~/.bashrc (idempotent)
  if [ -f "$BASHRC" ] && grep -qE "^export ${VAR_NAME}=" "$BASHRC"; then
    local existing
    existing=$(current_from_bashrc)
    if [ "$existing" = "$key" ]; then
      echo "  ~/.bashrc: unchanged (same value)"
    else
      sed -i "s#^export ${VAR_NAME}=.*#export ${VAR_NAME}=${key}#" "$BASHRC"
      echo "  ~/.bashrc: updated"
    fi
  else
    # Add with a header comment so future readers know what it's for
    {
      echo ""
      echo "# Brave Search MCP key — installed by scripts/set-brave-api-key.sh"
      echo "export ${VAR_NAME}=${key}"
    } >> "$BASHRC"
    echo "  ~/.bashrc: added"
  fi

  echo ""
  echo "Done. Masked result:"
  show
  echo ""
  echo "For the CURRENT shell to see the key, run:"
  echo "  export ${VAR_NAME}=${key}"
  echo "Or just open a new terminal."
  echo ""
  echo "The PM2-managed Sports Bar app will pick up the .env value on its next"
  echo "delete+start cycle (pm2 restart alone does not re-read .env — see"
  echo "CLAUDE.md Common Gotcha #3). If you want the brave-search MCP to work"
  echo "in the CURRENT Claude Code session, exit claude and relaunch."
}

test_key() {
  local key="${BRAVE_API_KEY:-$(current_from_bashrc)}"
  key="${key:-$(current_from_env)}"
  if [ -z "$key" ]; then
    echo "ERROR: no BRAVE_API_KEY in env, ~/.bashrc, or .env." >&2
    exit 3
  fi
  echo "Probing Brave Search API with key $(mask_key "$key")..."
  local http_code
  http_code=$(curl -sS -o /tmp/brave-test.json -w "%{http_code}" \
    -H "X-Subscription-Token: $key" \
    "https://api.search.brave.com/res/v1/web/search?q=test&count=1" || echo "000")
  if [ "$http_code" = "200" ]; then
    echo "OK: HTTP 200 — key works."
  elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    echo "FAIL: HTTP ${http_code} — key is invalid or revoked."
    exit 4
  elif [ "$http_code" = "429" ]; then
    echo "WARN: HTTP 429 — rate-limited. Key is valid but over quota right now."
  else
    echo "UNKNOWN: HTTP ${http_code}. Raw response:"
    head -c 300 /tmp/brave-test.json
    echo ""
  fi
}

case "${1:-}" in
  ""|-h|--help|help) usage ;;
  --show|show)       show ;;
  --remove|remove)   remove ;;
  --test|test)       test_key ;;
  -*)                echo "Unknown flag: $1" >&2; usage ;;
  *)                 set_key "$1" ;;
esac
