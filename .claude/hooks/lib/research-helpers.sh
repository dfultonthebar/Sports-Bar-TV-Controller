#!/bin/bash
# Shared helpers for the three research hooks (pre-bash, user-prompt, task-create).
# Centralizes: hardware-pattern detection, 24h caching, Grok invocation.

# ─── Patterns we care about ──────────────────────────────────────────
# Each line: a regex (case-insensitive) and the canonical hardware name
# we cache under. We only fire Grok when we see ONE of these — keeps
# the hook silent for general work.
#
# Hardware-related queries here are deliberately scoped to the gear in
# the bar AND known integration points (Atlas, Shure, Wolf Pack, etc).
# Generic terms (`audio`, `wireless`) are NOT triggers — too noisy.
declare -gA RESEARCH_PATTERNS=(
  ["atlas|AZMP?[48]"]="atlas-azm8"
  ["shure|SLX-?D|SLXD\d?"]="shure-slxd"
  ["wolfpack|wolf[ -]pack|WP-?[0-9]+X?[0-9]*"]="wolfpack-matrix"
  ["itach|IP2IR|global[ -]?cache"]="itach-ip2ir"
  ["fire[ -]?(tv|cube)|firetv|AFTR"]="firetv"
  ["directv|direct-?tv|h25\|h26\|hr2[0-9]\|hr5[0-9]"]="directv"
  ["crestron|DM[ -]?MD|DMPS"]="crestron"
  ["bss[ -]?(soundweb|blu)|HiQnet"]="bss-soundweb"
  ["dbx[ -]?(zonepro|zone[ -]?pro)"]="dbx-zonepro"
  ["multiview|HDTVSupply|4K60[ -]?quad"]="hdtvsupply-multiview"
  ["nesdr|rtl[ -]?sdr|rtl_power|rtl_fm"]="rtl-sdr"
  ["soundtrack[ -]?your[ -]?brand"]="soundtrack-syb"
  ["EAVC|epson[ -]?projector"]="epson-projector"
  ["atmosphere[ -]?tv"]="atmosphere-tv"
)

CACHE_DIR=/tmp/sports-bar-research-cache
CACHE_TTL_SECS=86400  # 24h
mkdir -p "$CACHE_DIR" 2>/dev/null

# Echo the canonical hardware key if any pattern matches the input.
# stdout: one key per matched pattern (deduped); empty if no match.
detect_hardware_patterns() {
  local text="$1"
  local matched=""
  for pattern in "${!RESEARCH_PATTERNS[@]}"; do
    if echo "$text" | grep -qiE -- "$pattern"; then
      matched+="${RESEARCH_PATTERNS[$pattern]}"$'\n'
    fi
  done
  echo "$matched" | sort -u | grep . || true
}

# Cache-aware research lookup. $1 = hardware key.
# Echos research markdown on stdout. Cached for 24h.
research_hardware() {
  local key="$1"
  [ -z "$key" ] && return 0
  local cache_file="$CACHE_DIR/$key.md"
  if [ -f "$cache_file" ]; then
    local age=$(( $(date +%s) - $(date -r "$cache_file" +%s) ))
    if [ "$age" -lt "$CACHE_TTL_SECS" ]; then
      cat "$cache_file"
      return 0
    fi
  fi

  # Cache miss — fire Grok with a tight research prompt.
  if ! command -v grok >/dev/null 2>&1; then
    echo "(research unavailable — grok CLI not installed)"
    return 0
  fi

  local prompt_file
  prompt_file=$(mktemp /tmp/research-prompt-XXXXXX.md)
  cat > "$prompt_file" <<RESEARCH
Research the following piece of hardware that's deployed in a sports bar
A/V system. The reader (an AI coding assistant) is about to write code
that interacts with it or debug a problem on it.

Hardware key: $key

Return a SHORT structured brief (under 300 words):

1. Identification (model family, what it is, vendor)
2. Common gotchas / known integration issues — link to 1-2 reliable sources
   (GitHub issues, vendor support pages, Reddit threads)
3. Protocol/wire-format reference (if it has one — Telnet, HTTP, ASCII, etc)
4. Two recent (within last 12 months) community discussions that might be
   relevant — with URLs

Skip marketing material. Skip price/availability. Skip generic "what is
A/V" prose. Focus on integration + troubleshooting.

If you cannot find SPECIFIC technical information on this hardware,
return exactly the line "NO_RESEARCH_AVAILABLE" and nothing else.
RESEARCH

  local result
  # --permission-mode auto = single-turn headless w/ web tools enabled.
  # (The earlier --headless --always-approve form was invalid — --headless
  # is not a real grok flag. grok would then go into interactive-TUI mode
  # with no web tools and return the "no specific research" fallback on
  # every call. Verified via `grok --help` and a live test on shure-slxd
  # that returned real prose + URLs once we switched to --permission-mode
  # auto. v2.55.35 fix; see VERSION_SETUP_GUIDE entry.)
  # We deliberately do NOT use scripts/grok-prime.sh here — that prepends
  # docs/GROK_BRIEFING.md (~5 KB) which is overkill for a 300-word lookup
  # and wastes context per cache-miss.
  result=$(timeout 90 grok --permission-mode auto --prompt-file "$prompt_file" 2>/dev/null || true)
  rm -f "$prompt_file"

  if [ -z "$result" ] || echo "$result" | grep -q "NO_RESEARCH_AVAILABLE"; then
    # Cache the empty result so we don't re-fire every event for the same hw
    echo "(no specific research available for $key)" > "$cache_file"
    cat "$cache_file"
    return 0
  fi

  printf '%s\n' "$result" > "$cache_file"
  cat "$cache_file"
}
