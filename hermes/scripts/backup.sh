#!/usr/bin/env bash
# Hermes brain backup -> private GitHub repo, per-box subdir.
# Text only (skills + memory + *.md). NEVER backs up .env / config.yaml (secrets).
# Auth: relies on git's existing credential.helper=store (~/.git-credentials) —
# no token embedded in this script.
set -euo pipefail

SRC="$HOME/.hermes"
WORK="$HOME/.hermes-backup"
REPO="https://github.com/dfultonthebar/hermes-backup.git"

# Friendly, stable per-box subdir: LOCATION_NAME slug -> hostname -> 'box'
LOC="$(grep -E '^LOCATION_NAME=' "$HOME/Sports-Bar-TV-Controller/.env" 2>/dev/null \
        | head -1 | cut -d= -f2- | tr -d '"'\''' | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
[ -z "$LOC" ] && LOC="$(hostname | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
[ -z "$LOC" ] && LOC="box"

# Fresh clone if the working copy is missing/broken
if [ ! -d "$WORK/.git" ]; then
  rm -rf "$WORK"
  git clone -q "$REPO" "$WORK"
fi
cd "$WORK"
git pull --rebase --autostash -q || true

DEST="$WORK/$LOC"
rm -rf "$DEST"        # clean snapshot each run (rsync --delete protects excluded files; wipe avoids leftover bloat)
mkdir -p "$DEST"

# Brain only. Exclude the Hermes PROGRAM source + caches/blobs/secrets FIRST
# (first-match-wins), then allowlist the brain dirs + root markdown.
rsync -a --delete \
  --exclude='hermes-agent/' \
  --exclude='audio_cache/' --exclude='image_cache/' --exclude='sandboxes/' \
  --exclude='sessions/' --exclude='plugins/' --exclude='bin/' \
  --exclude='pairing/' --exclude='checkpoints/' --exclude='logs/' --exclude='cache/' \
  --exclude='__pycache__/' --exclude='*.pyc' \
  --exclude='.env' --exclude='config.yaml' --exclude='*credential*' --exclude='*.key' \
  --include='skills/***' \
  --include='memories/***' \
  --include='cron/***' \
  --include='hooks/***' \
  --include='*.md' \
  --include='*/' \
  --exclude='*' \
  "$SRC/" "$DEST/"

git add -A
if git diff --cached --quiet; then
  echo "hermes-backup: no changes for $LOC"
  exit 0
fi
git -c user.name='hermes-bot' -c user.email='hermes-bot@localhost' \
    commit -q -m "backup $LOC $(date -Iseconds)"
# push with one retry in case another box pushed meanwhile
git push -q origin HEAD || { git pull --rebase --autostash -q || true; git push -q origin HEAD; }
echo "hermes-backup: pushed $LOC"
