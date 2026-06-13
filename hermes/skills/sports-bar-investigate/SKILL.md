---
name: sports-bar-investigate
description: "Investigate a deep code/system question or an open todo by delegating to Claude Code (ask_claude_code), then relay or file the plan."
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [SportsBar, Investigation, ClaudeCode, Todos, Planning]
---

# Sports-Bar deep investigation — delegate to Claude Code

When a question is deeper than the observe tools can answer — "how does X work in the code?", "draft a fix
for this todo", "why does the scheduler do Y?", "root-cause this bug" — delegate to **Claude Code** via the
`ask_claude_code` tool. Claude reads the *real* codebase (read-only) and returns analysis or a concrete
plan. You stay the operator brain; Claude is the builder/analyst.

## When to use `ask_claude_code`
- A todo needs a concrete fix plan (which files, what approach) → ask Claude to investigate + draft it.
- A "how/why does the code do X" question that `search_system_docs` can't fully answer.
- Root-causing something that needs reading multiple source files.
**Not** for: live device state (use the observe tools) or quick doc lookups (use `search_system_docs`).

## Workflow
1. If it's about a todo, `list_open_todos` first to get the exact title + context.
2. Call `ask_claude_code` with a SPECIFIC question — name the files/area if you know them (faster), ask for
   a concrete plan or root cause, ask Claude to be concise. It is READ-ONLY: Claude analyzes/plans but
   changes nothing.
3. Relay Claude's answer. If it's a fix plan worth tracking, `create_maintenance_todo` with the plan in the
   description so it lands on the System Admin → Todos list for a human.
4. Never say the fix is DONE — Claude only plans; a human (or a future task-mode) executes it.

## Tips
- A multi-file investigation can take a couple of minutes — that's expected, not a hang.
- Pull likely file paths from `search_system_docs` first, then hand them to Claude so it goes straight there.
