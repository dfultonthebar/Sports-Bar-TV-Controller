#!/usr/bin/env bash
# scripts/fleet-audit.sh
#
# Comprehensive fleet-wide audit. Captures all software/firmware/dependency
# versions on the host AND on every reachable Fire TV Cube. Output is
# parseable JSON-ish for diff comparison across locations.
#
# Usage:
#   bash scripts/fleet-audit.sh                          # local host audit
#   bash scripts/fleet-audit.sh --all                    # ssh to every fleet host
#
# Output: prints a structured report. Save with `> /tmp/fleet-audit-<host>.txt`.
#
# When run with --all from any host with sshpass + Tailscale access:
#   - Saves per-host audit to /tmp/fleet-audit-<host>.txt
#   - Also generates /tmp/fleet-audit-DIFF.txt showing inter-host drift
#
# Reference baseline is whichever host you run from (typically Holmgren).

set -uo pipefail

audit_local() {
  local host="${HOSTNAME:-$(hostname)}"
  local lan_ip
  lan_ip=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^100\.' | head -1)

  echo "============================================================"
  echo "FLEET AUDIT: $host"
  echo "Generated: $(date -Iseconds)"
  echo "============================================================"
  echo

  # ─── Host OS / kernel ────────────────────────────────────────────
  echo "## Host OS"
  echo "  hostname=$host"
  echo "  lan_ip=$lan_ip"
  echo "  tailscale_ip=$(hostname -I | tr ' ' '\n' | grep '^100\.' | head -1)"
  echo "  os_pretty=$(grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d= -f2- | tr -d '"')"
  echo "  os_codename=$(lsb_release -sc 2>/dev/null || grep -E '^VERSION_CODENAME=' /etc/os-release 2>/dev/null | cut -d= -f2)"
  echo "  kernel=$(uname -r)"
  echo "  arch=$(uname -m)"
  echo "  timezone=$(cat /etc/timezone 2>/dev/null || echo 'unknown')"
  echo "  uptime=$(uptime -p 2>/dev/null || uptime)"
  echo

  # ─── Build toolchain versions ────────────────────────────────────
  echo "## Build toolchain"
  echo "  node=$(node --version 2>&1 | head -1)"
  echo "  npm=$(npm --version 2>&1 | head -1)"
  echo "  pm2=$(pm2 --version 2>&1 | head -1)"
  echo "  java=$(java -version 2>&1 | head -1 | tr -d '"')"
  echo "  java_home=${JAVA_HOME:-unset}"
  echo "  adb=$(adb --version 2>&1 | head -1)"
  echo "  sqlite3=$(sqlite3 --version 2>&1 | head -1)"
  echo "  python3=$(python3 --version 2>&1 | head -1)"
  echo "  git=$(git --version 2>&1 | head -1)"
  echo "  curl=$(curl --version 2>&1 | head -1)"
  echo "  jq=$(jq --version 2>&1 | head -1)"
  echo "  systemd=$(systemctl --version 2>&1 | head -1)"
  echo

  # ─── Sports-Bar-TV-Controller state ──────────────────────────────
  echo "## Sports-Bar-TV-Controller"
  if [ -d /home/ubuntu/Sports-Bar-TV-Controller ]; then
    cd /home/ubuntu/Sports-Bar-TV-Controller
    echo "  version=$(grep '"version"' package.json 2>/dev/null | head -1 | tr -d ' ",' | sed 's/version://')"
    echo "  git_branch=$(git branch --show-current 2>/dev/null)"
    echo "  git_head=$(git rev-parse --short HEAD 2>/dev/null)"
    echo "  git_head_full=$(git rev-parse HEAD 2>/dev/null)"
    echo "  git_remote=$(git remote get-url origin 2>/dev/null)"
    echo "  git_dirty=$(git status --short 2>/dev/null | wc -l)"
    echo "  npm_workspace_count=$(ls packages/ 2>/dev/null | wc -l)"
    echo "  build_dir_size=$(du -sh apps/web/.next 2>/dev/null | cut -f1)"
    echo "  node_modules_size=$(du -sh node_modules 2>/dev/null | cut -f1)"
  else
    echo "  REPO_NOT_FOUND"
  fi
  echo

  # ─── Auto-update last-success sidecar ────────────────────────────
  echo "## Auto-update sidecar"
  if [ -f /home/ubuntu/sports-bar-data/.auto-update-last-success.json ]; then
    python3 -c "
import json
with open('/home/ubuntu/sports-bar-data/.auto-update-last-success.json') as f:
  d = json.load(f)
v = d.get('verifyInstall', {})
print(f'  last_version={d.get(\"version\")}')
print(f'  last_commit={d.get(\"commitSha\",\"\")[:10]}')
print(f'  last_run_at={d.get(\"successAt\")}')
print(f'  verify_status={v.get(\"status\")}')
print(f'  verify_passed={v.get(\"passed\")}/{v.get(\"total\")}')
print(f'  verify_failed={\",\".join(v.get(\"failed\",[])) or \"none\"}')
"
  else
    echo "  SIDECAR_MISSING"
  fi
  echo

  # ─── PM2 + service status ────────────────────────────────────────
  echo "## PM2"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
  apps = json.load(sys.stdin)
  for a in apps:
    name = a.get('name')
    env = a.get('pm2_env', {})
    print(f'  app={name} status={env.get(\"status\")} restarts={env.get(\"restart_time\",0)} uptime_unix={env.get(\"pm_uptime\",0)//1000} watching={env.get(\"watching\",False)}')
except Exception as e:
  print(f'  pm2_jlist_err={e}')
"
  else
    echo "  PM2_NOT_INSTALLED"
  fi
  echo "  api_health=$(curl -s -m 3 http://localhost:3001/api/health 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"status\",\"?\"))' 2>/dev/null || echo unreachable)"
  echo

  # ─── Database state ──────────────────────────────────────────────
  echo "## Database"
  DB=/home/ubuntu/sports-bar-data/production.db
  if [ -f "$DB" ]; then
    echo "  db_path=$DB"
    echo "  db_size=$(du -h $DB | cut -f1)"
    echo "  db_pragma_user_version=$(sqlite3 $DB 'PRAGMA user_version' 2>/dev/null)"
    echo "  table_count=$(sqlite3 $DB '.tables' 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | wc -l)"
    # Key table row counts
    for table in Location AuthPin Session FireTVDevice DirecTVDevice IRDevice MatrixConfiguration MatrixInput MatrixOutput input_sources ChannelPreset BartenderLayout firetv_streaming_catalog game_schedules HomeTeam; do
      count=$(sqlite3 $DB "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "?")
      echo "  rows.$table=$count"
    done
    # MatrixConfiguration values that drift
    sqlite3 $DB 'SELECT "  matrix.outputOffset=" || outputOffset || " matrix.audioOutputCount=" || audioOutputCount FROM MatrixConfiguration WHERE isActive=1 LIMIT 1' 2>/dev/null
  else
    echo "  DB_MISSING"
  fi
  echo

  # ─── Cron / systemd timers ───────────────────────────────────────
  echo "## Schedulers"
  echo "  user_cron_lines=$(crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l)"
  echo "  cron.d_files=$(ls /etc/cron.d 2>/dev/null | wc -l)"
  echo "  ollama_service=$(systemctl is-active ollama-ipex 2>/dev/null || systemctl is-active ollama 2>/dev/null || echo none)"
  echo "  nginx_active=$(systemctl is-active nginx 2>/dev/null || echo none)"
  echo

  # ─── Fire TV Cubes ───────────────────────────────────────────────
  echo "## Fire TV Cubes"
  if [ -f "$DB" ]; then
    IPS=$(sqlite3 $DB "SELECT ipAddress FROM FireTVDevice WHERE ipAddress IS NOT NULL AND name NOT LIKE '%REPLAC%';" 2>/dev/null)
    cube_count=0
    cube_reachable=0
    for ip in $IPS; do
      cube_count=$((cube_count + 1))
      adb connect "${ip}:5555" >/dev/null 2>&1
      state=$(adb -s "${ip}:5555" get-state 2>/dev/null || echo "unreachable")
      if [ "$state" != "device" ]; then
        echo "  cube_${ip}.state=$state"
        continue
      fi
      cube_reachable=$((cube_reachable + 1))
      model=$(adb -s "${ip}:5555" shell "getprop ro.product.model" 2>&1 | tr -d '\r')
      fireos=$(adb -s "${ip}:5555" shell "getprop ro.build.version.fireos" 2>&1 | tr -d '\r')
      android_sdk=$(adb -s "${ip}:5555" shell "getprop ro.build.version.sdk" 2>&1 | tr -d '\r')
      build_id=$(adb -s "${ip}:5555" shell "getprop ro.build.display.id" 2>&1 | tr -d '\r')
      firebat=$(adb -s "${ip}:5555" shell "dumpsys package com.amazon.firebat | grep versionName" 2>&1 | head -1 | tr -d ' \r')
      firebat_act=$(adb -s "${ip}:5555" shell "cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat" 2>&1 | tail -1 | tr -d '\r')
      scout=$(adb -s "${ip}:5555" shell "dumpsys package com.sportsbar.scout | grep versionName" 2>&1 | head -1 | tr -d ' \r')
      scout_as=$(adb -s "${ip}:5555" shell "dumpsys accessibility | grep -c FireStick" 2>&1 | tr -d '\r')
      sleep_ms=$(adb -s "${ip}:5555" shell "settings get system screen_off_timeout" 2>&1 | tr -d '\r')
      ss=$(adb -s "${ip}:5555" shell "settings get secure screensaver_enabled" 2>&1 | tr -d '\r')
      stay=$(adb -s "${ip}:5555" shell "settings get global stay_on_while_plugged_in" 2>&1 | tr -d '\r')

      echo "  cube_${ip}.model=$model"
      echo "  cube_${ip}.fireos=$fireos"
      echo "  cube_${ip}.android_sdk=$android_sdk"
      echo "  cube_${ip}.build_id=$build_id"
      echo "  cube_${ip}.firebat=$firebat"
      echo "  cube_${ip}.firebat_leanback_act=$firebat_act"
      echo "  cube_${ip}.scout=$scout"
      echo "  cube_${ip}.scout_as_bound=$scout_as"
      echo "  cube_${ip}.screen_off_timeout=$sleep_ms"
      echo "  cube_${ip}.screensaver_enabled=$ss"
      echo "  cube_${ip}.stay_on_while_plugged_in=$stay"
      # User-installed sports apps on this Cube
      for pkg in com.espn.gtv com.amazon.firebat com.peacock.peacockfiretv com.hulu.plus com.fubo.firetv.screen com.sling com.apple.atve.amazon.appletv com.amazon.firetv.youtube com.google.android.youtube.tvunplugged com.playon.nfhslive com.cbs.ott com.netflix.ninja; do
        present=$(adb -s "${ip}:5555" shell "pm path $pkg" 2>&1 | grep -c "package:")
        if [ "$present" = "1" ]; then
          ver=$(adb -s "${ip}:5555" shell "dumpsys package $pkg | grep versionName" 2>&1 | head -1 | tr -d ' \r' | sed 's/versionName=//')
          echo "  cube_${ip}.app.$pkg=$ver"
        fi
      done
    done
    echo "  cubes.total=$cube_count"
    echo "  cubes.reachable=$cube_reachable"
  fi
  echo

  echo "============================================================"
  echo "END FLEET AUDIT: $host"
  echo "============================================================"
}

audit_remote_via_sshpass() {
  if [ -z "${SSHPASS:-}" ]; then
    echo "ERROR: SSHPASS env var not set" >&2
    return 1
  fi
  local hosts=(graystone-tvcontroller luckys1313 stoneyard-appleton greenville-stoneyard leglamp-tvcontroller)
  mkdir -p /tmp/fleet-audit
  echo "Running local audit (this host)..."
  audit_local > /tmp/fleet-audit/local.txt
  for host in "${hosts[@]}"; do
    echo "Auditing $host..."
    if [ -f /tmp/fleet-audit/scripts.sent.$host ]; then : ; else
      sshpass -e scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$0" "ubuntu@${host}:/tmp/fleet-audit-runner.sh" 2>/dev/null
      touch /tmp/fleet-audit/scripts.sent.$host
    fi
    sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@${host} \
      "bash /tmp/fleet-audit-runner.sh" > /tmp/fleet-audit/${host}.txt 2>&1
  done
  echo
  echo "Audits saved to /tmp/fleet-audit/*.txt"
  echo
  # Diff key fields
  echo "=== Quick drift summary ==="
  for field in os_pretty kernel node npm pm2 java sqlite3 git_head version build_id fireos firebat scout; do
    echo
    echo "── $field ──"
    grep "^  ${field}=" /tmp/fleet-audit/*.txt 2>/dev/null | sed 's|/tmp/fleet-audit/||' | sed 's/.txt:/: /' | sort
  done
}

if [ "${1:-}" = "--all" ]; then
  audit_remote_via_sshpass
else
  audit_local
fi
