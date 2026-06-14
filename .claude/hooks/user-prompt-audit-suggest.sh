#!/bin/bash
# UserPromptSubmit — when the operator types "audit X" or similar, surface
# the team-audit skill via additionalContext so Claude knows to use the
# Red/Blue/White/Purple/Green/Orange taxonomy + Workflow dispatch.
#
# Skill at .claude/skills/team-audit.md codifies the pattern. This hook
# only suggests; Claude still decides whether to run a full workflow or
# do a smaller investigation.

set -u

prompt=$(jq -r '.prompt // empty' 2>/dev/null) || exit 0
[ -z "$prompt" ] && exit 0

# Match common audit-request shapes. Case-insensitive. Catches:
#   "audit the scheduling system" / "audit the X subsystem"
#   "audit on/of/for the scheduling system"
#   "audit (the) scheduling and channel guide"
#   "audit (scheduling|channel.guide|matrix|...)" bare
#   "another audit" / "let's audit" / "do an audit"
#   Red/Blue/Green/team-audit triggers
if echo "$prompt" | grep -qiE '\b(audit|investigate|review)\s+(on|of|for|the|our|my|another|this|that)?\s*(the|our|my)?\s*(scheduling|channel[ -]?guide|matrix|bartender|wolfpack|atlas|shure|sdr|sports[ -]?guide|firetv|fire[ -]?cube|directv|streaming|auto[ -]?update|watchers?|sentinel|self[ -]?monitor)\b|\b(audit|review)\s+(the|our|my)?\s*\w+\s*(system|subsystem|module|service|stack)\b|\b(red|blue|green|orange|purple)\s*team\b|red.*blue.*green|teams?.*audit'; then

  context=$(cat <<'CTX'
### Auto-suggest: team-audit skill applies

The operator's message reads as an audit request. The `.claude/skills/team-audit.md` skill codifies the multi-team pattern we used today for the scheduler audit:

  Red    → adversarial bug-find
  Blue   → current-state defender / how it actually behaves
  White  → architecture review against CLAUDE.md docs
  Purple → bridge: keeps only findings that survive BOTH Red + Blue lenses
  Green  → builder (worktree-isolated, one agent per top-3 ranked issue)
  Orange → secure-by-design probe of each Green commit
  (Grok) → optional final pre-ship review

**Use the `Workflow` tool**, not parallel `Agent` calls — the audit is heavy and multi-phase, and Workflow handles deterministic ordering, caching, and resumability.

**Standard phases:** Discovery (R/B/W parallel) → Purple triage → Green build (parallel worktrees) → Orange probe (parallel) → optional Grok → merge sequence.

See `.claude/skills/team-audit.md` for the full script skeleton.
CTX
)

  jq -n --arg c "$context" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: $c
    }
  }'
fi

exit 0
