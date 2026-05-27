#!/bin/bash
#
# Sports Bar TV Controller — ISO uploader using direct REST + curl.
#
# Fallback for environments where the gh CLI isn't authenticated or the
# token lacks the `read:org` scope `gh auth login` requires. Uses the
# Personal Access Token from $GITHUB_TOKEN OR the one embedded in the
# git remote URL (which the auto-update.sh path has been using for git
# push all session).
#
# Required scope on the token: `repo` (or `public_repo` for public repos).
# That's strictly less than what `gh auth login` demands.
#
# Usage:
#   GITHUB_TOKEN=ghp_... bash scripts/iso/upload-github-release-curl.sh /path/to/sports-bar.iso [--tag v3.0-YYYY-MM-DD] [--notes "Notes"]
#
# Or just (token auto-extracted from git remote):
#   bash scripts/iso/upload-github-release-curl.sh /path/to/sports-bar.iso
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

ISO_PATH=""
TAG=""
NOTES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)   TAG="$2"; shift 2 ;;
        --notes) NOTES="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,17p' "$0"; exit 0 ;;
        -*) err "Unknown option: $1"; exit 1 ;;
        *) ISO_PATH="$1"; shift ;;
    esac
done

[ -z "$ISO_PATH" ] && { err "ISO path required."; exit 1; }
[ ! -f "$ISO_PATH" ] && { err "ISO not found: $ISO_PATH"; exit 1; }

TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ]; then
    REMOTE=$(git -C "$(dirname "$0")/.." remote get-url origin 2>/dev/null || true)
    TOKEN=$(echo "$REMOTE" | sed -n 's|https://\(ghp_[^@]*\)@.*|\1|p' || true)
fi
[ -z "$TOKEN" ] && { err "No GITHUB_TOKEN env and none in git remote. Export GITHUB_TOKEN=ghp_..."; exit 1; }

REPO="dfultonthebar/Sports-Bar-TV-Controller"
[ -z "$TAG" ] && TAG="v3.0-$(date +%Y-%m-%d)"
[ -z "$NOTES" ] && NOTES="Sports Bar TV Controller ISO — virgin install supports v2.54.51+ canonical pipeline (DB migrate, Gotcha #11 hardening, auth bootstrap via wizard, verify-install gate). See docs/BARE_METAL_ISO.md."

ISO_FILE=$(basename "$ISO_PATH")
ISO_SIZE_HR=$(du -h "$ISO_PATH" | awk '{print $1}')
log "ISO:  $ISO_FILE ($ISO_SIZE_HR)"
log "Tag:  $TAG"
log "Repo: $REPO"

for ext in md5 sha256; do
    if [ ! -f "${ISO_PATH}.${ext}" ]; then
        info "Generating ${ext} ..."
        case $ext in
            md5)    md5sum  "$ISO_PATH" > "${ISO_PATH}.md5" ;;
            sha256) sha256sum "$ISO_PATH" > "${ISO_PATH}.sha256" ;;
        esac
    fi
done

API="https://api.github.com"
UPLOAD_API="https://uploads.github.com"
AUTH_H="Authorization: Bearer $TOKEN"
ACCEPT_H="Accept: application/vnd.github+json"

EXISTING_ID=$(curl -sS -H "$AUTH_H" -H "$ACCEPT_H" \
    "$API/repos/$REPO/releases/tags/$TAG" 2>/dev/null \
    | python3 -c "import sys,json
try:
    print(json.load(sys.stdin).get('id',''))
except Exception:
    print('')" 2>/dev/null || echo "")
if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "" ]; then
    warn "Release tag $TAG already exists (id=$EXISTING_ID). Deleting + re-creating."
    curl -fsS -X DELETE -H "$AUTH_H" -H "$ACCEPT_H" \
        "$API/repos/$REPO/releases/$EXISTING_ID" >/dev/null
    curl -fsS -X DELETE -H "$AUTH_H" -H "$ACCEPT_H" \
        "$API/repos/$REPO/git/refs/tags/$TAG" 2>/dev/null || true
fi

log "Creating release $TAG ..."
CREATE_PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'tag_name': sys.argv[1],
    'name': 'Sports Bar TV Controller ' + sys.argv[1],
    'body': sys.argv[2],
    'draft': False,
    'prerelease': False,
}))" "$TAG" "$NOTES")

RELEASE_JSON=$(curl -fsS -X POST -H "$AUTH_H" -H "$ACCEPT_H" \
    "$API/repos/$REPO/releases" -d "$CREATE_PAYLOAD")
RELEASE_ID=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RELEASE_URL=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['html_url'])")
log "Release created: id=$RELEASE_ID"

upload_asset() {
    local file="$1"
    local name
    name=$(basename "$file")
    local mime="application/octet-stream"
    [[ "$name" == *.md5 || "$name" == *.sha256 ]] && mime="text/plain"
    info "Uploading $name ($(du -h "$file" | awk '{print $1}')) ..."
    curl -fsS -X POST \
        -H "$AUTH_H" -H "$ACCEPT_H" -H "Content-Type: $mime" \
        --data-binary @"$file" \
        "$UPLOAD_API/repos/$REPO/releases/$RELEASE_ID/assets?name=$name" >/dev/null
    log "  uploaded $name"
}

upload_asset "$ISO_PATH"
upload_asset "${ISO_PATH}.md5"
upload_asset "${ISO_PATH}.sha256"

echo
log "Release published: $RELEASE_URL"
log "Browser-download:  $RELEASE_URL"
log "Direct URL:        $RELEASE_URL/download/$ISO_FILE"
