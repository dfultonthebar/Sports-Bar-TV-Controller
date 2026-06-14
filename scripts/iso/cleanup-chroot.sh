#!/bin/bash
# cleanup-chroot.sh — safely unmount + remove an ISO/debootstrap chroot dir
#
# Why this script exists:
#   On 2026-05-27 we used `sudo umount -l` (lazy) on a chroot's /dev bind mount
#   followed by `sudo rm -rf` of the build dir. The lazy unmount left the bind
#   path traversable, so rm recursed INTO the still-attached bind and deleted
#   nodes from the HOST /dev — wiping /dev/null, /dev/urandom, /dev/zero, etc.
#   PM2 + bartender services kept limping (existing FDs survived) but every new
#   subprocess (git, npm, sshd-accept) failed for ~2h until recovery via mknod.
#
#   This helper does it the safe way: unmount in REVERSE dep order without -l,
#   verify nothing is left mounted, THEN rm.
#
# Usage:
#   bash scripts/iso/cleanup-chroot.sh /home/ubuntu/iso-build
#   bash scripts/iso/cleanup-chroot.sh /path/to/chroot --keep   # unmount only, no rm
#
# Exit codes:
#   0 — clean (nothing mounted, dir removed if not --keep)
#   1 — invalid args
#   2 — unmount failed (target busy; check fuser/lsof)
#   3 — rm failed (only when not --keep)

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 <build-dir> [--keep]

  <build-dir>   Path containing chroot/ subdir to clean (e.g. /home/ubuntu/iso-build)
  --keep        Unmount only; do not delete the directory.

Common build-dir layout this script handles:
  <build-dir>/chroot/proc
  <build-dir>/chroot/sys
  <build-dir>/chroot/dev/pts
  <build-dir>/chroot/dev
EOF
  exit 1
}

[ $# -ge 1 ] || usage
BUILD_DIR="$1"
KEEP=0
[ "${2:-}" = "--keep" ] && KEEP=1

[ -d "$BUILD_DIR" ] || { echo "ERROR: $BUILD_DIR does not exist"; exit 1; }

# Refuse to operate on dangerous parents — defense-in-depth against
# accidentally running this with the wrong argument.
case "$BUILD_DIR" in
  /|/home|/home/ubuntu|/root|/etc|/var|/usr|/dev|/proc|/sys|/bin|/sbin|/lib)
    echo "ERROR: refusing to operate on system path: $BUILD_DIR"
    exit 1
    ;;
esac

CHROOT="$BUILD_DIR/chroot"

if [ -d "$CHROOT" ]; then
  echo "[cleanup-chroot] Unmounting binds under $CHROOT (reverse dep order, no -l)..."

  # Order: deepest first. dev/pts BEFORE dev. dev BEFORE sys. sys + proc independent.
  for path in \
      "$CHROOT/dev/pts" \
      "$CHROOT/dev/shm" \
      "$CHROOT/dev/hugepages" \
      "$CHROOT/dev/mqueue" \
      "$CHROOT/dev" \
      "$CHROOT/sys/fs/fuse/connections" \
      "$CHROOT/sys/kernel/security" \
      "$CHROOT/sys" \
      "$CHROOT/proc/sys/fs/binfmt_misc" \
      "$CHROOT/proc"
  do
    if mountpoint -q "$path" 2>/dev/null; then
      echo "  umount $path"
      if ! sudo umount "$path" 2>&1; then
        echo "  WARN: umount $path failed — checking holders:"
        sudo fuser -mv "$path" 2>&1 | head -20 || true
        echo "  WARN: leaving $path mounted — DO NOT rm -rf $BUILD_DIR until resolved."
        exit 2
      fi
    fi
  done
fi

# Final paranoia check — nothing under build-dir should be in /proc/mounts.
STILL_MOUNTED=$(mount | grep -F "$BUILD_DIR" || true)
if [ -n "$STILL_MOUNTED" ]; then
  echo "[cleanup-chroot] ERROR: mounts still present under $BUILD_DIR:"
  echo "$STILL_MOUNTED"
  echo "Refusing to rm. Investigate before retrying."
  exit 2
fi

echo "[cleanup-chroot] No mounts remain under $BUILD_DIR."

if [ "$KEEP" = "1" ]; then
  echo "[cleanup-chroot] --keep specified; leaving $BUILD_DIR in place."
  exit 0
fi

echo "[cleanup-chroot] Removing $BUILD_DIR..."
if sudo rm -rf "$BUILD_DIR"; then
  echo "[cleanup-chroot] Done."
  exit 0
else
  echo "[cleanup-chroot] ERROR: rm -rf failed."
  exit 3
fi
