#!/bin/bash
#
# Sports Bar TV Controller - Upload ISO to GitHub Releases
#
# Usage:
#   ./upload-github-release.sh <iso-path> [--tag v3.0-2026-03-02] [--notes "Release notes"]
#
# Requirements:
#   - gh CLI authenticated (gh auth status)
#   - ISO file must exist with .md5 and .sha256 sidecar files
#
# GitHub Releases (NOT branches) — safe for all bar locations.
#

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

# ─── Parse arguments ──────────────────────────────────────────────────────────
ISO_PATH=""
TAG=""
NOTES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            TAG="$2"; shift 2 ;;
        --notes)
            NOTES="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 <iso-path> [--tag <tag>] [--notes <notes>]"
            echo ""
            echo "Arguments:"
            echo "  iso-path   Path to the ISO file"
            echo "  --tag      Git tag for the release (default: v3.0-YYYY-MM-DD)"
            echo "  --notes    Release notes / description"
            echo ""
            echo "Examples:"
            echo "  $0 ~/sports-bar-tv-controller-v3.0-2026-03-02.iso"
            echo "  $0 ~/sports-bar-tv-controller-v3.0-2026-03-02.iso --tag v3.0-2026-03-02 --notes 'Fresh build with Drizzle ORM'"
            exit 0
            ;;
        -*)
            err "Unknown option: $1"; exit 1 ;;
        *)
            ISO_PATH="$1"; shift ;;
    esac
done

# ─── Validate ISO path ────────────────────────────────────────────────────────
if [ -z "$ISO_PATH" ]; then
    err "No ISO path provided."
    echo "Usage: $0 <iso-path> [--tag <tag>]"
    exit 1
fi

if [ ! -f "$ISO_PATH" ]; then
    err "ISO file not found: $ISO_PATH"
    exit 1
fi

ISO_NAME="$(basename "$ISO_PATH")"
ISO_DIR="$(dirname "$ISO_PATH")"

# ─── Auto-generate tag if not provided ───────────────────────────────────────
if [ -z "$TAG" ]; then
    TAG="v3.0-$(date +%Y-%m-%d)"
fi

# ─── Verify gh CLI ────────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
    err "GitHub CLI (gh) not found. Install from: https://cli.github.com"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    err "GitHub CLI not authenticated. Run: gh auth login"
    exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    err "Could not determine GitHub repository. Run from inside the repo directory or set GH_REPO."
    exit 1
fi

# ─── Build asset list ─────────────────────────────────────────────────────────
ASSETS=("$ISO_PATH")

if [ -f "${ISO_PATH}.md5" ]; then
    ASSETS+=("${ISO_PATH}.md5")
    log "Found MD5:    ${ISO_NAME}.md5"
else
    warn "No .md5 sidecar found — generating..."
    md5sum "$ISO_PATH" > "${ISO_PATH}.md5"
    ASSETS+=("${ISO_PATH}.md5")
fi

if [ -f "${ISO_PATH}.sha256" ]; then
    ASSETS+=("${ISO_PATH}.sha256")
    log "Found SHA256: ${ISO_NAME}.sha256"
else
    warn "No .sha256 sidecar found — generating..."
    sha256sum "$ISO_PATH" > "${ISO_PATH}.sha256"
    ASSETS+=("${ISO_PATH}.sha256")
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
ISO_SIZE=$(du -h "$ISO_PATH" | cut -f1)
MD5_HASH=$(cut -d' ' -f1 "${ISO_PATH}.md5" 2>/dev/null || echo "unknown")
SHA256_HASH=$(cut -d' ' -f1 "${ISO_PATH}.sha256" 2>/dev/null | cut -c1-16)

echo ""
echo "=================================="
echo "  GitHub Release Upload"
echo "=================================="
echo ""
info "Repository: $REPO"
info "Tag:        $TAG"
info "ISO:        $ISO_NAME ($ISO_SIZE)"
info "MD5:        $MD5_HASH"
info "SHA256:     ${SHA256_HASH}..."
echo ""

# ─── Confirm ──────────────────────────────────────────────────────────────────
if [ -t 0 ]; then
    read -p "Upload to GitHub Releases as tag '$TAG'? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Aborted."
        exit 0
    fi
fi

# ─── Build release notes ──────────────────────────────────────────────────────
BUILD_DATE=$(date '+%Y-%m-%d %H:%M UTC')

if [ -z "$NOTES" ]; then
    NOTES="## Sports Bar TV Controller ISO

**Build Date:** ${BUILD_DATE}
**Base System:** Ubuntu 22.04 LTS (debootstrap, clean install)
**Architecture:** x86_64, UEFI + BIOS hybrid

### Boot Modes
1. **Install** — clones latest code from GitHub, runs setup wizard
2. **Live (No Install)** — run from RAM for testing
3. **Safe Mode** — nomodeset for display compatibility

After first boot, run \`location-setup-wizard\` to auto-discover and configure devices.

### Checksums
\`\`\`
MD5:    $MD5_HASH
SHA256: $(cut -d' ' -f1 "${ISO_PATH}.sha256" 2>/dev/null || echo "unknown")
\`\`\`

### Software Included
- Node.js 22.x + npm
- PM2 process manager
- SQLite3
- OpenSSH Server
- ADB (Android Debug Bridge, for Fire TV)
- cec-utils (for HDMI-CEC cable box control)
- Ollama AI runtime
- Location Setup Wizard
- git, curl, logrotate

### Verification
\`\`\`bash
md5sum -c ${ISO_NAME}.md5
sha256sum -c ${ISO_NAME}.sha256
\`\`\`

### VM Testing
\`\`\`bash
qemu-system-x86_64 -cdrom ${ISO_NAME} -m 4G -enable-kvm -boot d
\`\`\`"
fi

# ─── Check if tag already exists ──────────────────────────────────────────────
if gh release view "$TAG" &>/dev/null 2>&1; then
    warn "Release '$TAG' already exists."
    read -p "  Delete existing release and recreate? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh release delete "$TAG" --yes --cleanup-tag 2>/dev/null || true
        log "Existing release deleted."
    else
        info "Aborted. Use a different --tag to create a new release."
        exit 0
    fi
fi

# ─── Create GitHub Release ────────────────────────────────────────────────────
log "Creating GitHub Release '$TAG'..."

gh release create "$TAG" \
    --repo "$REPO" \
    --title "Sports Bar TV Controller $TAG" \
    --notes "$NOTES" \
    "${ASSETS[@]}"

# ─── Print download URL ───────────────────────────────────────────────────────
RELEASE_URL=$(gh release view "$TAG" --repo "$REPO" --json url -q .url 2>/dev/null || echo "https://github.com/$REPO/releases/tag/$TAG")

echo ""
echo "=================================="
log "Upload complete!"
echo "=================================="
echo ""
info "Release URL: $RELEASE_URL"
info "Download:    gh release download $TAG --repo $REPO"
echo ""
echo "To verify after downloading:"
echo "  md5sum -c ${ISO_NAME}.md5"
echo "  sha256sum -c ${ISO_NAME}.sha256"
echo ""
