#!/bin/bash
# PostToolUse Bash — after `git checkout main`, warn if location data files
# just got blanked to empty templates. main carries empty templates for
# data files; the live Holmgren box reads them, so a stray checkout-main
# can blank the layout the bartender remote uses.

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

echo "$cmd" | grep -qE 'git[[:space:]]+checkout[[:space:]]+main(\b|$)' || exit 0

REPO=/home/ubuntu/Sports-Bar-TV-Controller
LAYOUT="$REPO/apps/web/data/tv-layout.json"
[ -f "$LAYOUT" ] || exit 0
size=$(wc -c < "$LAYOUT")
[ "$size" -gt 100 ] && exit 0

msg="⚠ Working tree is now on main — apps/web/data/tv-layout.json is the empty template ($size bytes).

The live Holmgren box reads this file. Stay on main only for committing software changes. Before any operation that touches data, runs the app, or restarts PM2 here, switch back:

  git checkout location/holmgren-way

(memory: feedback_location_data_merge_risk + feedback_branch_slip_pm2_workflow)"

jq -n --arg msg "$msg" '{systemMessage: $msg}'
exit 0
