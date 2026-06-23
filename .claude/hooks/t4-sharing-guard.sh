#!/usr/bin/env bash
# PreToolUse / Bash hook — Tesla T4 (CT212, 16GB) GPU-sharing guardrail.
# Fires before every Bash command; exits fast unless the command touches the
# shared T4 (CT212 / Ollama / heavy models / Honcho deriver / hermes inference).
# When it does, it injects the T4 sharing rules + the CURRENT market-hours window
# as context so the agent can't forget them. Informational (non-blocking).
# Canonical rules: ~/.claude/.../memory/feedback_t4_gpu_sharing_rules.md
cmd=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null) || exit 0
# Match actual LOAD ACTIONS on the shared T4, not mere mentions of model names
# (so doc-writes / greps that name the models don't false-trigger). Fires on:
# the T4 host/Ollama port, ollama action verbs, deriver start, hermes inference.
echo "$cmd" | grep -qiE '100\.70\.56\.34|:11434|ollama[[:space:]]+(run|pull|create|load|cp|stop|rm)|(docker[[:space:]]+compose[[:space:]].*deriver|deriver[[:space:]]+(start|restart|up))|hermes[[:space:]].*(-z|model|gateway|setup)' || exit 0
ET_HOUR=$(TZ=America/New_York date +%H 2>/dev/null || date +%H)
if [ "$ET_HOUR" -ge 21 ] || [ "$ET_HOUR" -lt 8 ]; then
  WINDOW="OFF-HOURS (ET ${ET_HOUR}:00) — heavy bar models (qwen2.5:14b / deriver) are OK; phi4-trader is unloaded; but mind THERMAL (fan unpowered)."
else
  WINDOW="MARKET HOURS (ET ${ET_HOUR}:00) — DO NOT evict phi4-trader; qwen2.5:14b + the Honcho deriver are FORBIDDEN right now; only small models (llama3.1:8b / llama3.2:3b / nomic) may load alongside Phil."
fi
python3 - "$WINDOW" <<'PY'
import json, sys
w = sys.argv[1]
ctx = ("⚠ T4 GPU-SHARING GUARD — this command touches the shared Tesla T4 (CT212, 16GB, shared with the trading bot). "
       f"CURRENT WINDOW: {w} "
       "RULES: (1) NEVER evict phi4-trader during market hours — a cold Phil auto-rejects trades (real money). "
       "(2) qwen2.5:14b + the Honcho deriver are OFF-HOURS ONLY (21:00-08:00 ET). "
       "(3) Small models (llama3.1:8b / llama3.2:3b / nomic-embed-text) coexist with Phil; OLLAMA_MAX_LOADED_MODELS=3, NUM_PARALLEL=1, KEEP_ALIVE=30m. "
       "(4) Any shared-config change (num_ctx / KV-cache type / MAX_LOADED / bigger resident model) needs trading-Claude coordination + an RTH /api/ps canary; revert on any eviction. "
       "(5) THERMAL: GPU fan installed but UNPOWERED (PSU on order), ~69C idle — keep sustained heavy inference light, abort at >=82C (throttle ~85C). "
       "Full rules: memory/feedback_t4_gpu_sharing_rules.md")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": ctx}}))
PY
exit 0
