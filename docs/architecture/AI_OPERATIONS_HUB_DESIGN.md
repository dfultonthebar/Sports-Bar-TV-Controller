# AI Operations Hub — Two-Agent System Design

**Status:** Design phase. Foundation pieces will land before operator
returns home. Wire-up + first end-to-end test is gated on operator
presence to validate the security model.

## The vision

Two AIs working as a team to keep the bar systems healthy:

1. **Local AI (Ollama)** — always-on, watches the system, knows
   everything about this specific bar (via RAG store we just built).
   Cheap, fast (iGPU), no API cost. Handles routine monitoring +
   classification + first-line answers.
2. **Claude Code CLI** — heavier lifting. Code changes, root-cause
   analysis, multi-file refactors, anything that needs reasoning
   the local 8B model can't do well. Invoked on demand, costs API
   credits, runs as a background agent.

The local AI watches and triages; Claude executes when escalated.
Operator can intervene at any point.

## Two pieces of work

### Piece 1 — Option B: unify document search

**Current state:** two parallel doc-search systems exist:
- `/api/rag/*` + `apps/web/rag-data/vector-store.json` (513 chunks
  indexed: CLAUDE.md, packages READMEs, memory files, RF docs)
- `/api/chat` + `@/lib/enhanced-document-search` (a separate older
  system the AI Hub chat page uses)

The AI Hub at `/ai-hub` calls `/api/chat`, so the RF docs we just
indexed are invisible to the AI Hub chatbot.

**Target state:** AI Hub `/api/chat` uses our RAG store as its
sole document-search backend. Single index, single truth, every
new doc we index automatically reachable from every AI surface.

**Migration plan:**

1. Audit what `documentSearch` returns vs. what `retrieveContext`
   returns. Adapt the response shapes.
2. Modify `/api/chat` route's documentSearch call to use
   `retrieveContext(query, topK)` from `@/lib/rag-server/query-engine`.
3. Re-index any docs that were only in `enhanced-document-search`
   (likely most of `/docs/*.md` — our RAG only indexed RF-related
   files via the regex filter).
4. Run the existing AI Hub chat tests against the new backend
   (questions about CEC, IR learning, matrix routing, etc. should
   still work).
5. Eventually delete `enhanced-document-search.ts` to avoid drift.

**Risk:** AI Hub chat regressions on non-RF questions if the new
search returns different chunks. Mitigation: keep both code paths
during the transition, A/B flag, then remove old once verified.

**Effort:** ~2 hours.

### Piece 2 — AI → Claude task escalation

**Trigger pattern:** local AI detects a system anomaly it can
diagnose but cannot fix on its own. Writes a "task" describing the
issue + suggested fix. Claude Code CLI picks up the task, executes
the fix, reports back.

**Example flow (operator's example):**

1. The scheduler watcher fires an error: "AI Game Plan generation
   failed for tomorrow's NFL slate — Ollama timeout after 3 attempts"
2. Local AI runs its routine triage: queries logs, checks scheduler
   state, asks itself "can I fix this?"
3. Local AI decides this needs code-level investigation (e.g.
   "the Ollama timeout suggests the prompt grew too large; need to
   audit the prompt builder for new fields and either chunk or
   summarize"). Writes a task row.
4. Claude Code CLI (running as a watcher / cron job) picks up the
   task, opens the relevant files, makes the fix, runs tests,
   commits + pushes. Updates the task row with the resolution.
5. Local AI reads the resolution, surfaces it in the AI Hub UI
   ("Yesterday Claude fixed the AI Game Plan timeout by adding
   league-grouping to the prompt"), and learns the pattern for next
   time.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL AI (Ollama @ Iris Xe iGPU)                            │
│  - Monitors: PM2 logs, watcher events, scheduler errors      │
│  - Has RAG context: all RF + Atlas + Shure + Scout docs      │
│  - Classifies: "can I answer this myself or escalate?"       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │  Writes task row to claude_tasks (new table)
                   │  with: title, description, suggested_fix,
                   │  source_logs, priority, status='queued'
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  TASK QUEUE: claude_tasks SQLite table                       │
│  - Operator review + approval gate before dispatch           │
│  - status: queued → approved → in_progress → resolved        │
│  - audit trail with all status transitions                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │  Operator clicks "Send to Claude" in UI
                   │  → POST /api/ai-hub/dispatch-to-claude/:taskId
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE DISPATCHER (scripts/dispatch-to-claude.sh)           │
│  - Builds a one-shot prompt with the task + system context   │
│  - Invokes: claude -p "<task>" --append-system-prompt ...    │
│  - Captures stdout/stderr, exit code, files-changed          │
│  - Updates the task row with the result                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE CLI                                             │
│  - Reads task description                                    │
│  - Has full repo access (it IS in the repo)                  │
│  - Investigates, fixes, tests, commits, pushes               │
│  - Returns summary to dispatcher                             │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
            Task row marked resolved
                   │
                   ▼
       Local AI reads resolution, surfaces in UI
```

**Critical security gate (don't skip):**

Claude Code CLI dispatched autonomously can DO ANYTHING in the repo
— commit, push, modify production code. We MUST NOT let the local
AI dispatch directly. The flow is:

1. Local AI writes task with `status='queued'`
2. **Operator reviews the task in the AI Hub UI** — sees title,
   description, suggested fix, source logs. Can edit, reject, or
   approve.
3. Only `status='approved'` tasks are dispatched.
4. Dispatcher invokes Claude with the approved task.
5. Claude's commits land with co-authored-by both the operator and
   Claude, so the audit trail is intact.

**Why operator-in-the-loop:**
- Local AI hallucinates sometimes — without review it might
  dispatch nonsense tasks
- Claude Code is non-cheap (~$0.20-$3 per task) — accidental
  loops would burn money fast
- Production code changes need human authorization

**Pieces to build:**

1. `claude_tasks` schema (new SQLite table)
2. `/api/ai-hub/tasks` CRUD endpoints (operator review UI hits these)
3. `apps/web/src/components/ai-hub/ClaudeTaskQueue.tsx` (review +
   approve UI in `/ai-hub`)
4. `scripts/dispatch-to-claude.sh` (the actual `claude -p` invocation)
5. `apps/web/src/lib/ai-task-classifier.ts` (the local AI's
   routine triage that produces task rows)
6. Watchers wired to call the classifier when they detect issues
   (scheduler watcher, atlas-drop-watcher, shure-rf-watcher, etc.)

**Effort estimates:**
- Schema + CRUD + UI: ~1 day
- Dispatcher script: ~half day (mostly figuring out non-interactive
  Claude session management)
- Triage classifier prompts + watcher integration: ~1 day
- End-to-end test with operator present: ~half day

**Total: ~3 days.** Splits cleanly into 3 ships:
- Day 1: schema + CRUD + UI (operator can manually write/review tasks)
- Day 2: dispatcher + first end-to-end test with operator
- Day 3: watcher integration so tasks generate themselves

## Operator-presence requirements

The following MUST be done with operator present so we can verify
the security model + handle the first auto-generated task carefully:

- First Claude dispatch via the operator-approval flow
- First time a watcher auto-generates a task
- Anything involving auto-push to main without operator review

Foundation pieces that DON'T require operator presence and can be
built ahead of time:

- The schema + DB tables
- CRUD endpoints (return 401 until auth wired)
- The UI component (renders empty state when no tasks)
- Documentation (this file)
- The triage classifier (operates locally, just writes to DB)

## Build sequence when operator returns

1. **Verify Option B** — the unified doc search is up and AI Hub
   chat can answer RF questions
2. **Smoke test the task queue UI** — manually insert a fake task
   row, see it render in the UI, approve it, watch the dispatcher
   pick it up
3. **Run the first Claude dispatch** — start with something
   trivial like "add a comment to apps/web/src/lib/sdr-watcher.ts
   line 1 saying 'reviewed'" so we can verify the pipeline without
   risking production code
4. **Wire one watcher (e.g. atlas-drop-watcher)** to call the
   triage classifier — write a fake error condition and confirm
   the task row gets created with reasonable content
5. **Operator-approved first auto-generated dispatch** — let it
   actually fix something small

## Cost + safety notes

- Claude Code dispatch costs API credits. Set a budget cap in the
  dispatcher (e.g. max 5 dispatches/day until operator raises it).
- Always require operator approval before dispatch in production.
  Auto-dispatch mode (for trusted task types) is a v2 feature, not
  v1.
- Dispatcher logs MUST include the input prompt + output for audit.
- If Claude pushes bad code, the auto-update system's rollback
  mechanism kicks in — but treat that as the last line of defense,
  not the first.

## What's deferred

- **Real-time bi-directional chat** between the two AIs (would
  require streaming Claude session keep-alive). v3 feature.
- **Cross-bar coordination** — multiple location AIs sharing
  observations to a central Claude. Out of scope until fleet
  has more than 4-5 active bars.
- **Auto-merge to main from Claude's commits** — would need a
  bulletproof CI gate. v2 feature.
