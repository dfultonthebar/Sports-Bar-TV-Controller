---
name: session-recall
description: Query the timestamped session/decision log to recall what was discussed, decided, or changed at any past date/time.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [memory, audit, ops, recall, incident-review, decisions]
---

# Session Recall

Reconstruct past operator sessions so the agent can answer "what did we talk
about / decide / change at <time>" — independent of Honcho semantic memory.
Honcho answers "what do we know about X"; this answers "what happened on <date>
at <time>", which is what post-incident review, change-tracing, and "remind me
what we agreed last week" actually need. (Source: Hermes masterclass — session
logging / recall.)

## When to use
- Operator asks "what did we discuss/decide/change on <date> / last <weekday>".
- Post-incident review: "what did the agent do around the time TV-3 went black".
- "List every link / todo I gave you in the last <window>."
- Verifying a past decision before repeating an action (avoid contradicting it).

## Workflow
1. **Resolve the time anchor** to an explicit local range. Default window if only
   a point is given: ±2h. For a weekday/relative phrase, compute the concrete date
   first and echo it back ("= 2026-06-05").
2. **List candidate sessions:** `hermes sessions list` — pick the session(s) whose
   "Last Active" falls in the range. The full transcript lives in the local store
   `~/.hermes/state.db` (table `messages`: columns `session_id`, `role`,
   `content`, `timestamp`) and mirrored in `~/.hermes/logs/`.
3. **Extract within range** from that session — query `messages` by `session_id`
   + `timestamp`, or `hermes sessions export <id>`. Capture: user requests, agent
   decisions/recommendations, tool calls (matrix routes, todos filed,
   propose_action, ask_claude_code), links given, artifacts produced.
4. **Apply filters** (location branch, topic keyword, tool name) if requested.
   Use Honcho only to enrich names/IDs — the session log is the source of truth
   for *what happened when*.
5. **Synthesize a dated digest**, newest-first, each line stamped
   `YYYY-MM-DD HH:MM — <one-line what-happened>`, grouped into **Decisions**,
   **Actions taken**, **Links/artifacts**.
6. **Offer follow-through.** If recall surfaces an unfinished item or a prior
   decision that contradicts a current request, flag it and offer to file a todo
   or re-open it via the todos / propose_action tools.

## Guardrails
- Read-only: never mutate the log. Filing a todo/proposal is a separate explicit
  step the operator confirms.
- If no session covers the range, say so plainly and report the nearest available
  session times — do not fabricate recalled content.
- Quote sparingly; summarize. Surface exact strings only when load-bearing
  (a decision, an IP, a command).
