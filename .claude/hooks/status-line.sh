#!/bin/bash
# Status line — surface git branch + package.json version so branch-slip is
# impossible to miss. Renders as:  ⎇ location/holmgren-way  v2.55.18

REPO=/home/ubuntu/Sports-Bar-TV-Controller
branch=$(git -C "$REPO" branch --show-current 2>/dev/null)
ver=$(grep -m1 '"version"' "$REPO/package.json" 2>/dev/null | sed -E 's/.*"version":[[:space:]]*"([^"]+)".*/\1/')
printf '⎇ %s  v%s' "${branch:-?}" "${ver:-?}"
