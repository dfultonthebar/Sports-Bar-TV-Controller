#!/bin/bash
# PostToolUse TaskCreate — for every new task, fire a background Grok
# research call on the task subject + description. Result is written
# to a dossier file Claude can read when picking the task up.
#
# Does NOT block the TaskCreate response — runs in the background with
# nohup so the operator gets their task ID back instantly. The dossier
# typically lands within 30-90 sec.
#
# Result location: /tmp/sports-bar-task-research/<taskId>.md
#
# Skip-conditions:
#   - Task ID missing
#   - Task subject < 5 chars (probably a placeholder)
#   - grok CLI not installed
#
# Tell Claude where to find the dossier via systemMessage so it knows
# to read it when relevant.

set -u
LIB="$(dirname "$0")/lib/research-helpers.sh"
[ -f "$LIB" ] || exit 0
. "$LIB"

task_id=$(jq -r '.tool_response.taskId // .tool_response.task_id // .tool_input.subject // empty' 2>/dev/null) || exit 0
subject=$(jq -r '.tool_input.subject // empty' 2>/dev/null) || exit 0
description=$(jq -r '.tool_input.description // empty' 2>/dev/null) || true

# Extract taskId — newer TaskCreate returns it via tool_response.taskId
real_task_id=$(jq -r '.tool_response.taskId // empty' 2>/dev/null) || real_task_id=""
[ -z "$real_task_id" ] && real_task_id=$(jq -r '.tool_response.id // empty' 2>/dev/null) || real_task_id=""
[ -z "$real_task_id" ] && real_task_id="$(echo "$subject" | tr -cd 'a-z0-9' | head -c 16)"

[ -z "$subject" ] && exit 0
[ "${#subject}" -lt 5 ] && exit 0
command -v grok >/dev/null 2>&1 || exit 0

OUT_DIR=/tmp/sports-bar-task-research
mkdir -p "$OUT_DIR" 2>/dev/null
out_file="$OUT_DIR/${real_task_id}.md"

# Already researched? Skip.
if [ -f "$out_file" ] && [ -s "$out_file" ]; then
  jq -n --arg path "$out_file" --arg id "$real_task_id" '{
    systemMessage: ("[task-research] dossier already on disk for task " + $id + ": " + $path)
  }'
  exit 0
fi

# Also do an inline hardware-pattern check first — if the task mentions
# specific hardware, prefer the cached hardware dossier (cheaper, faster).
hw_matches=$(detect_hardware_patterns "$subject $description" || true)

# Build the research prompt
prompt_file=$(mktemp /tmp/task-research-prompt-XXXXXX.md)
cat > "$prompt_file" <<RESEARCH
Research a sports bar A/V system task. The AI coding assistant who picks
this task up will read your output for vendor docs, prior art, and known
gotchas.

### Task subject
$subject

### Task description
$description

### Hardware mentions auto-detected
${hw_matches:-(no specific hardware detected)}

Return a SHORT structured dossier (under 400 words) covering:

1. Brief restatement of what's being asked
2. Likely-relevant vendor docs OR prior art with URLs (3-5 links)
3. Known gotchas / common failure modes for this kind of work
4. One paragraph: "if I were starting this, I'd first look at X because Y"

Skip generic advice. Skip "what is A/V systems" prose. Be specific to
this task's hardware/protocol/integration angle.

If you cannot find anything specific, return exactly "NO_RESEARCH_AVAILABLE".
RESEARCH

# Fire in background — does NOT block the TaskCreate response.
nohup bash -c "
  result=\$(timeout 90 grok --prompt-file '$prompt_file' 2>/dev/null || echo 'NO_RESEARCH_AVAILABLE')
  if echo \"\$result\" | grep -q 'NO_RESEARCH_AVAILABLE'; then
    echo '(no specific research available for this task)' > '$out_file'
  else
    {
      echo '# Task research dossier'
      echo
      echo 'Task: $subject'
      echo 'Generated: '\$(date)
      echo
      echo '---'
      echo
      echo \"\$result\"
    } > '$out_file'
  fi
  rm -f '$prompt_file'
" >/dev/null 2>&1 &

# Tell Claude WHERE the dossier will appear (since the background job
# hasn't finished yet, just emit the path). When Claude later wants to
# work on the task, it can `cat` the path.
jq -n --arg path "$out_file" --arg id "$real_task_id" '{
  systemMessage: ("[task-research] queued background research for task " + $id + " — dossier will land at " + $path + " within ~90s")
}'
exit 0
