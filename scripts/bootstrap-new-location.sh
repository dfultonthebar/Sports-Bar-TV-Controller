#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — New Location Bootstrap (auth + DB binding)
# =============================================================================
# Run this on a fresh host AFTER `npm ci && npm run build && pm2 start`.
# Handles the pieces the older scripts/new-location-setup.sh doesn't:
#   1. Creates the Location row in production.db (or reuses existing).
#   2. Wires LOCATION_ID into .env so the auth middleware can find PINs.
#   3. Seeds AuthPin rows for STAFF + ADMIN roles with bcrypt-hashed PINs.
#   4. Ensures AUTH_COOKIE_SECURE=false on HTTP-only LAN deployments
#      (browsers silently drop Secure cookies over http://).
#   5. Optionally creates the location git branch off main.
#
# Safe to re-run: every step is idempotent. It will not overwrite an
# existing Location row or existing PINs; it reports what's already
# present and offers to replace.
#
# Usage:
#   bash scripts/bootstrap-new-location.sh
#     [--name "Human Readable Name"]
#     [--slug short-slug]
#     [--timezone America/Chicago]
#     [--admin-pin 7819]
#     [--staff-pin 1234]
#     [--anthropic-api-key sk-ant-...]
#     [--non-interactive]
#     [--create-branch]
#
# Exit codes:
#   0 — success, location is bootstrapped
#   1 — generic error (bad args, missing dependency)
#   2 — refused to overwrite existing data without --force
# =============================================================================

set -euo pipefail

REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
DB_PATH="/home/ubuntu/sports-bar-data/production.db"
ENV_FILE="$REPO_ROOT/.env"
NON_INTERACTIVE=0
CREATE_BRANCH=0

LOCATION_NAME=""
LOCATION_SLUG=""
LOCATION_TIMEZONE="America/Chicago"
ADMIN_PIN=""
STAFF_PIN=""
ANTHROPIC_API_KEY_ARG=""

die() {
  echo "[bootstrap] ERROR: $*" >&2
  exit 1
}

info() {
  echo "[bootstrap] $*"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --name) LOCATION_NAME="$2"; shift 2 ;;
    --slug) LOCATION_SLUG="$2"; shift 2 ;;
    --timezone) LOCATION_TIMEZONE="$2"; shift 2 ;;
    --admin-pin) ADMIN_PIN="$2"; shift 2 ;;
    --staff-pin) STAFF_PIN="$2"; shift 2 ;;
    --anthropic-api-key) ANTHROPIC_API_KEY_ARG="$2"; shift 2 ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    --create-branch) CREATE_BRANCH=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) die "unknown arg: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
# Prereqs
# ---------------------------------------------------------------------------
command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 not installed"
command -v node >/dev/null 2>&1 || die "node not installed"
[ -f "$DB_PATH" ] || die "production.db not found at $DB_PATH — run `npm run build && pm2 start` first"
[ -d "$REPO_ROOT/node_modules/bcryptjs" ] || die "bcryptjs not found in node_modules — run `npm ci` first"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Interactive prompts (skip if --non-interactive)
# ---------------------------------------------------------------------------
prompt_if_empty() {
  local varname=$1
  local label=$2
  local default=${3:-}
  local secret=${4:-}
  local current_value
  eval "current_value=\${$varname}"
  if [ -n "$current_value" ]; then return; fi
  if [ "$NON_INTERACTIVE" -eq 1 ]; then
    if [ -n "$default" ]; then
      eval "$varname=\"\$default\""
      return
    fi
    die "$label is required in --non-interactive mode (pass via --${varname,,} flag)"
  fi
  local input
  if [ -n "$secret" ]; then
    read -r -s -p "$label${default:+ [$default]}: " input
    echo
  else
    read -r -p "$label${default:+ [$default]}: " input
  fi
  eval "$varname=\"\${input:-\$default}\""
}

info "Sports Bar TV Controller — New Location Bootstrap"
info "Repo: $REPO_ROOT"
info "DB:   $DB_PATH"
echo

prompt_if_empty LOCATION_NAME "Location display name (e.g. 'Holmgren Way')"
[ -z "$LOCATION_NAME" ] && die "location name is required"

if [ -z "$LOCATION_SLUG" ]; then
  # Derive slug from name: lowercase, strip non-alnum, hyphen-join
  LOCATION_SLUG=$(echo "$LOCATION_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')
fi
info "Slug: $LOCATION_SLUG"

prompt_if_empty LOCATION_TIMEZONE "Timezone" "America/Chicago"
prompt_if_empty ADMIN_PIN "Admin PIN (4 digits, 1000-9999)" "" secret
prompt_if_empty STAFF_PIN "Staff PIN (4 digits, 1000-9999)" "" secret

# Validate PIN format
for role_pin in "ADMIN:$ADMIN_PIN" "STAFF:$STAFF_PIN"; do
  role="${role_pin%%:*}"
  pin="${role_pin#*:}"
  if ! [[ "$pin" =~ ^[0-9]{4}$ ]]; then
    die "$role PIN must be exactly 4 digits (got '$pin')"
  fi
done

# ---------------------------------------------------------------------------
# 1. Location row
# ---------------------------------------------------------------------------
info ""
info "=== Step 1: Location row ==="

EXISTING_LOCATION_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM Location WHERE name='$LOCATION_NAME' LIMIT 1;" 2>/dev/null || true)
if [ -n "$EXISTING_LOCATION_ID" ]; then
  info "Location '$LOCATION_NAME' already exists: $EXISTING_LOCATION_ID"
  LOCATION_ID="$EXISTING_LOCATION_ID"
else
  LOCATION_ID=$(node -e "console.log(require('crypto').randomUUID())")
  info "Creating Location row: $LOCATION_ID"
  NAME_ESC=$(printf '%s' "$LOCATION_NAME" | sed "s/'/''/g")
  TZ_ESC=$(printf '%s' "$LOCATION_TIMEZONE" | sed "s/'/''/g")
  sqlite3 "$DB_PATH" <<SQL
INSERT INTO Location (id, name, description, timezone, isActive)
  VALUES ('$LOCATION_ID', '$NAME_ESC', 'Bootstrapped by bootstrap-new-location.sh', '$TZ_ESC', 1);
SQL
fi

# ---------------------------------------------------------------------------
# 2. .env (LOCATION_ID + LOCATION_NAME + AUTH_COOKIE_SECURE)
# ---------------------------------------------------------------------------
info ""
info "=== Step 2: .env configuration ==="

touch "$ENV_FILE"

upsert_env() {
  local key=$1
  local value=$2
  # v2.32.37 — Single-quote any value containing whitespace or shell-special
  # chars so `set -a; source .env; set +a` (used by auto-update.sh build
  # phase) parses it correctly. Without this, "LOCATION_NAME=Leg Lamp"
  # gets parsed as `LOCATION_NAME=Leg` followed by `Lamp` command → 127
  # → trap fires → entire build phase aborts.
  if [[ "$value" =~ [[:space:]\$\`\"\!#\&\|] ]] && [[ "$value" != \'*\' ]]; then
    value="'${value//\'/\'\\\'\'}'"  # quote + escape any inner '
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local escaped_value
    escaped_value=$(printf '%s' "$value" | sed 's:[\/&]:\\&:g')
    sed -i -E "s/^${key}=.*/${key}=${escaped_value}/" "$ENV_FILE"
    info "  updated ${key}=${value}"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    info "  added   ${key}=${value}"
  fi
}

upsert_env "LOCATION_ID" "$LOCATION_ID"
upsert_env "LOCATION_NAME" "$LOCATION_NAME"
upsert_env "AUTH_COOKIE_SECURE" "false"

# v2.32.24 — All locations share the same ANTHROPIC_API_KEY for auto-update
# Checkpoints A/B/C (per CLAUDE.md / VERSION_SETUP_GUIDE v2.32.20). Without
# the key, auto-update.sh falls back to the Claude Code CLI subscription
# path which has a monthly token cap that defeats unattended cron updates.
if [ -n "$ANTHROPIC_API_KEY_ARG" ]; then
  upsert_env "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY_ARG"
elif ! grep -q '^ANTHROPIC_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  info "  WARN: ANTHROPIC_API_KEY not set in .env and --anthropic-api-key not provided."
  info "        auto-update.sh will fall back to the Claude Code CLI subscription path"
  info "        and may hit the monthly cap. Add the key with:"
  info "          echo 'ANTHROPIC_API_KEY=sk-ant-...' >> $ENV_FILE"
fi

# ---------------------------------------------------------------------------
# 3. AuthPin rows (STAFF + ADMIN)
# ---------------------------------------------------------------------------
info ""
info "=== Step 3: AuthPin rows ==="

seed_pin() {
  local role=$1
  local pin=$2
  local description=$3
  local existing
  existing=$(sqlite3 "$DB_PATH" "SELECT id FROM AuthPin WHERE locationId='$LOCATION_ID' AND role='$role' AND isActive=1 LIMIT 1;" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    info "  $role PIN already exists for this location: $existing (not overwriting)"
    return
  fi
  local hash
  hash=$(node -e "console.log(require('./node_modules/bcryptjs').hashSync('$pin', 10))")
  local id
  id=$(node -e "console.log(require('crypto').randomUUID())")
  local desc_esc
  desc_esc=$(printf '%s' "$description" | sed "s/'/''/g")
  sqlite3 "$DB_PATH" <<SQL
INSERT INTO AuthPin (id, locationId, role, pinHash, description, isActive)
  VALUES ('$id', '$LOCATION_ID', '$role', '$hash', '$desc_esc', 1);
SQL
  info "  $role PIN created: $id"
}

seed_pin "STAFF" "$STAFF_PIN" "Staff/bartender PIN — rotate via Device Config"
seed_pin "ADMIN" "$ADMIN_PIN" "Admin PIN — rotate via Device Config"

# ---------------------------------------------------------------------------
# 3b. Git identity (needed for UI backup commits + auto-update commits)
# ---------------------------------------------------------------------------
# The System Admin → Location tab's "Backup to git" button runs `git commit`
# under the hood, and so does scripts/auto-update.sh on every scheduled run.
# Both fail with "Author identity unknown" unless git user.name/user.email
# are set in this repo. Set a deterministic per-location identity that
# matches the existing sister-location convention.
info ""
info "=== Step 3b: git identity ==="

existing_name=$(git -C "$REPO_ROOT" config --get user.name 2>/dev/null || true)
if [ -z "$existing_name" ]; then
  git -C "$REPO_ROOT" config user.name "$LOCATION_NAME"
  info "  set git user.name = $LOCATION_NAME"
else
  info "  git user.name already set: $existing_name (not overwriting)"
fi

existing_email=$(git -C "$REPO_ROOT" config --get user.email 2>/dev/null || true)
if [ -z "$existing_email" ]; then
  git -C "$REPO_ROOT" config user.email "sports-bar-tv@${LOCATION_SLUG}.local"
  info "  set git user.email = sports-bar-tv@${LOCATION_SLUG}.local"
else
  info "  git user.email already set: $existing_email (not overwriting)"
fi

# ---------------------------------------------------------------------------
# 4. Optional: create git branch
# ---------------------------------------------------------------------------
if [ "$CREATE_BRANCH" -eq 1 ]; then
  info ""
  info "=== Step 4: git branch ==="
  local_branch="location/$LOCATION_SLUG"
  if git rev-parse --verify "$local_branch" >/dev/null 2>&1; then
    info "  branch $local_branch already exists"
  else
    git fetch origin main 2>&1 | tail -2 || true
    git checkout -b "$local_branch" origin/main 2>&1 | tail -2 || die "failed to create $local_branch"
    info "  created branch $local_branch from origin/main"
    info "  run 'git push -u origin $local_branch' when ready"
  fi
fi

# ---------------------------------------------------------------------------
# 5. Verify
# ---------------------------------------------------------------------------
info ""
info "=== Step 5: Verify ==="
info "  Running verify-install.sh..."
if bash "$REPO_ROOT/scripts/verify-install.sh" --quiet; then
  info "  verify-install.sh: PASS"
else
  info "  verify-install.sh: FAIL — check logs, app may not be running yet"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
info "==========================================="
info "Bootstrap complete for: $LOCATION_NAME"
info "==========================================="
info "LOCATION_ID:   $LOCATION_ID"
info "LOCATION_NAME: $LOCATION_NAME"
info "Timezone:      $LOCATION_TIMEZONE"
info "PINs seeded:   STAFF + ADMIN (values not logged)"
echo
info "Next steps:"
info "  1. pm2 restart sports-bar-tv-controller --update-env"
info "     (picks up the new LOCATION_ID + AUTH_COOKIE_SECURE from .env)"
info "  2. Test login at http://<host>:3001/login with the Admin PIN"
info "  3. Hit /api/auth/whoami to verify the session cookie was accepted"
info "  4. Go to /system-admin → Sync tab → toggle Auto Update Enabled → Save"
info "  5. (Optional) Run one manual update via 'Run Update Now' to prove the"
info "     auto-update orchestrator works end-to-end on this host"
info ""
info "Rotate these bootstrap PINs at first opportunity via Device Config"
info "or direct SQL update to the AuthPin table."

exit 0
