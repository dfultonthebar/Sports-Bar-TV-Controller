# Claude Memory Guide

**This document is REQUIRED READING for any Claude Code session before doing
non-trivial work on this repo. It is referenced from the READ FIRST block at
the top of `CLAUDE.md`.** Skimming is not enough — the three memory systems
described below have overlapping responsibilities and subtle rules about
which one to use when.

---

## Scope

This guide covers everything related to persistent context and memory for
Claude Code sessions working on the Sports-Bar-TV-Controller repo. It
complements (does NOT replace) `CLAUDE.md`. Standing Rules 5 and 7 in
`CLAUDE.md` summarize the "what to do" — this file explains the "how and
why" so you can apply the rules to edge cases.

## The three memory systems (don't confuse them)

There are THREE distinct "memory" mechanisms in play at this project.
Each serves a different purpose. Picking the wrong one means data goes
to the wrong place and the next session doesn't find it.

### 1. Claude Code auto-memory (per-host, per-project)

- **Where:** `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/`
  on whichever host the session runs on.
- **What it stores:** Four types defined by the system prompt — `user`
  (profile of the operator), `feedback` (rules/guidance from corrections
  or explicit confirmations), `project` (initiatives, deadlines,
  incidents), `reference` (pointers to external systems).
- **Index:** `MEMORY.md` in that directory is a one-line-per-entry index.
  Never write memory content into `MEMORY.md` itself.
- **Lifecycle:** Per-host. Not committed to git, not pushed anywhere.
  Persists across Claude Code sessions on the same host. Does NOT
  propagate between locations.
- **When to write:** See the "Types of memory" section in the system
  prompt. Summary: when the user teaches you something about themselves,
  their preferences, or project state that a FUTURE session on this same
  host should remember. Do NOT save: code patterns (read the code
  instead), git history (use `git log`), debugging one-offs (the fix is
  in the commit), duplicate info from CLAUDE.md.
- **When to read:** When memory seems relevant, user references prior
  work, or user explicitly asks you to recall. Always verify against
  current code before acting — memory can be stale.

### 2. Memory Bank system (in-repo, per-host snapshots)

- **Where:** `apps/web/src/lib/memory-bank/` (the implementation) and
  `memory-bank/*.md` (the stored snapshots). Auto-cleanup keeps 30 most
  recent.
- **What it stores:** Project context snapshots — git status, modified
  file list, database location, port, Node version, quick resume
  commands. Not conversation memory; it's "what state was I in when the
  last session ended."
- **CLI:**
  ```bash
  npm run memory:snapshot    # Create manual snapshot
  npm run memory:restore     # View latest snapshot
  npm run memory:list        # List all snapshots
  npm run memory:stats       # Show storage statistics
  npm run memory:watch       # Auto-snapshot (has ENOSPC issues, use carefully)
  ```
- **API:**
  - `GET /api/memory-bank/current` — Get latest snapshot
  - `GET /api/memory-bank/history` — List all snapshots
  - `POST /api/memory-bank/snapshot` — Create new snapshot
  - `POST /api/memory-bank/restore` — Restore specific snapshot
- **Lifecycle:** Per-host. Snapshots are gitignored via
  `memory-bank/` pattern. Each location builds up its own snapshot
  history independently.
- **When to use:** Primarily an operator/debugging tool — "SSH session
  died mid-task, what was I doing?" is the main use case. Claude
  sessions usually don't need to write snapshots manually; a Claude
  session can READ them to restore context after an interrupted session.

### 3. CLAUDE.md + shared doc files (committed, propagates to all locations)

- **Where:** `CLAUDE.md` (at repo root), `docs/CLAUDE_MEMORY_GUIDE.md`
  (this file), `docs/CLAUDE_VERSIONING_GUIDE.md`, and other `docs/*.md`.
- **What it stores:** Authoritative, shared institutional knowledge —
  architecture, Standing Rules, Common Gotchas, hardware conventions,
  UI styling guides, runbooks.
- **Lifecycle:** Committed to git. Every location inherits the same
  content via main branch merges. This is how cross-location learning
  propagates.

## Rule 5 — "When told to 'remember' something, update CLAUDE.md too"

Stated in CLAUDE.md Standing Rule 5. Full expansion:

When the user says **"remember X"**, ask yourself: is X a piece of
knowledge that should survive at OTHER locations, too?

- If yes (a universal gotcha, a project-wide convention, a rule the
  user wants enforced for every future session at every location):
  save to local memory AND add to the appropriate section of
  CLAUDE.md. Commit to the current branch (main if possible). Bump
  `package.json` version (per
  `docs/CLAUDE_VERSIONING_GUIDE.md`). Push.
- If no (something specific to this host — a credential file path, a
  personal preference, a one-off state): save to local memory only.

Writing to both ensures that:
- Future sessions on THIS host see the rule even without reading
  CLAUDE.md in full (via auto-memory).
- Future sessions at OTHER locations inherit the rule via git merge
  (via CLAUDE.md).

**If you save to memory but not CLAUDE.md**, you create a silent
divergence — this host knows the rule; every other location doesn't.
Over time, fleet behavior fragments.

## Rule 7 — Bidirectional memory ↔ CLAUDE.md sync

Stated in CLAUDE.md Standing Rule 7. When you read CLAUDE.md during a
session (especially at auto-update Checkpoint B, which is the
designated sync moment), do TWO passes:

### CLAUDE.md → memory

For every Standing Rule, Common Gotcha, hardware constraint, or
convention section in CLAUDE.md, check the memory index (`MEMORY.md`):

- **Missing from memory:** save a new entry (type: `feedback` for
  behavioral rules, `project` for project state). Add a one-line
  pointer in `MEMORY.md`.
- **Present but conflicting:** update the memory entry to match
  CLAUDE.md. CLAUDE.md wins on conflicts because it's the shared
  authoritative copy.
- **Present and matches:** leave alone.

This ensures every session on this host — even ones that don't
re-read CLAUDE.md fully — inherit the current rule set through the
auto-memory mechanism.

### memory → CLAUDE.md

If a memory entry describes a rule/gotcha that is NOT in CLAUDE.md,
that's location-only knowledge that other locations are missing. Add
it to the appropriate section of CLAUDE.md, bump version, commit to
the current branch (main for shared knowledge; location branch only
if the fix is truly location-specific, with a plan to promote later).

Rule 5 covers NEW rules the user explicitly asks you to remember. Rule
7 is the passive drift-catching pass that runs on every CLAUDE.md
read. Together they keep the two sources near-duplicate over time.

### Remove stale memory entries

If CLAUDE.md now says a feature is deprecated or a file no longer
exists (e.g., the CEC deprecation — v2.11.x removed CEC cable-box
control), remove the corresponding memory entries (e.g., "use CEC for
cable boxes"). Stale entries lead to Claude acting on outdated
information.

## Verifying memory before acting on it

Memory entries are a claim about what was true WHEN THE MEMORY WAS
WRITTEN. Files move, functions rename, features get removed. Before
recommending an action based on a memory entry:

- If the memory names a file path: verify the file exists.
- If the memory names a function or flag: `grep` for it.
- If the user is about to act on your recommendation (not just asking
  about history), verify first.

"The memory says X exists" is NOT the same as "X exists now."

A memory that summarizes repo state (activity logs, architecture
snapshots) is frozen in time. If the user asks about *recent* or
*current* state, prefer `git log` / reading the code over recalling
the snapshot.

## Saving memory: the two-step process

1. Write the memory to its own file (e.g., `user_role.md`,
   `feedback_testing.md`) using frontmatter:

   ```markdown
   ---
   name: {{memory name}}
   description: {{one-line description — used to decide relevance in future conversations}}
   type: {{user, feedback, project, reference}}
   ---

   {{memory content}}
   ```

   For `feedback` and `project` types, structure the body as:
   - The rule/fact (one line)
   - `**Why:**` line — the reason (often a past incident or strong preference)
   - `**How to apply:**` line — when/where the guidance kicks in

   The "why" lets future-you judge edge cases instead of blindly
   following the rule.

2. Add a pointer in `MEMORY.md`:

   `- [Title](file.md) — one-line hook`

   Never write memory content directly into `MEMORY.md`. It's an
   index, not a memory.

## Memory vs. Plan vs. TaskCreate

- **Memory:** cross-session, cross-conversation persistence. Things
  future YOU (or future Claude sessions) need to know.
- **Plan / ExitPlanMode:** current-conversation architectural
  alignment before implementation. Scoped to this conversation.
- **TaskCreate / TaskUpdate:** current-conversation progress
  tracking. Scoped to this conversation.

If you're unsure which to use: if it's useful AFTER this conversation
ends, it's memory. If it's useful for the NEXT step of this
conversation, it's a task or a plan.

## Related Standing Rules

See `CLAUDE.md`:
- Rule 5 — remember → CLAUDE.md too
- Rule 7 — bidirectional sync

See `docs/CLAUDE_VERSIONING_GUIDE.md`:
- How to version-bump when you add a new universal rule via Rule 5 or 7.

---

**Last updated:** 2026-04-18 (v2.23.5 — initial extraction from CLAUDE.md).
