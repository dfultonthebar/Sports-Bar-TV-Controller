---
name: learn-system-write-bartender-howtos
description: Explore how a part of the system actually works (via Claude Code + the docs), then write a plain-English bartender how-to and put it in the chatbot's knowledge so bartenders get good answers.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [bartender, howto, documentation, rag, chatbot, self-improvement, claude]
---

# Learn the System → Write Bartender How-Tos

Turn how the system REALLY works into help a bartender can actually use. You learn
the truth from the code + docs (you don't make it up), then write it in plain
English and feed it into the chatbot's knowledge, so when a bartender asks "the
mic isn't working" the AI gives a real, correct, do-this-now answer.

The audience is a bartender with **zero tech background** mid-shift. That governs
everything (see Gotcha #13 + the bartender-lens rule).

## When to use
- A bartender asks the chatbot something there's no good help doc for yet.
- A recurring real-world problem has no how-to (mic cutting out, TV showing the
  wrong game, no sound on a TV, music stopped, a remote/Fire TV issue, a black TV).
- After a fix ships, write the bartender-facing "if this happens, do this."

## Workflow
1. **Pick ONE concrete topic** — a real question/problem, not a whole subsystem.
   Keep a running list of covered vs uncovered topics so you don't repeat.
2. **Learn the truth (don't guess):**
   - `search_system_docs("<topic>")` for the runbook + the gotchas.
   - For anything the docs don't fully cover, `ask_claude_code`: "Explain end to
     end how <X> works in this codebase and the EXACT steps to fix <problem> — give
     me both the operator-level cause and the simplest bartender-level action."
     Claude reads the real code so the steps are correct.
   - Cross-check the live state with the observe tools if relevant (e.g. what the
     Shure/Atlas status actually looks like when a mic is ghosting).
3. **Write it bartender-grade** (this is the whole point — get the register right):
   - Plain English. NO acronyms/model names. Identify hardware by **look + location**
     ("the silver box with the antenna on the top rack", "the black box under TV 3"),
     never "the SLX-D receiver".
   - ONE action per numbered step. Recovery path inline ("if that didn't work, …").
   - Reassurance ("you can't break anything by trying this").
   - Always end with an escalation path ("if none of this worked, snap a photo of
     the screen and text the manager").
   - **Mics: never "karaoke mic"** — it's the wireless/paging/hosted-event mic
     (karaoke is BYO). Cable boxes: it's a remote/IR thing, don't mention CEC.
4. **Put it in the chatbot's knowledge:**
   - Save to `docs/bartender-help/<short-topic-slug>.md` (the RAG-indexed bartender
     help dir — this is what the chat answers from).
   - Hand the file write to `ask_claude_code` (it can create the file + commit on
     main) OR file it as a maintenance todo with the full markdown for a human to
     commit. The doc must land on `main` and be committed (it's shared, not per-box).
   - Trigger a RAG rescan so the chatbot can use it immediately
     (`scripts/rag-rescan-if-needed.sh`, or note it in the todo). A how-to that
     isn't rescanned is invisible to the chat (Standing Rule 11).
5. **Verify it works:** ask the chatbot (the bartender register) the original
   question and confirm it now answers from your new how-to, in plain English.
   If the answer is jargon-y or wrong, fix the how-to and rescan.

## Guardrails
- Truth first: the steps must match what the code/hardware actually does. If you
  can't confirm a step, say so — don't invent a fix.
- One how-to per topic; improve the existing file rather than duplicating.
- Bartender register is non-negotiable — if a bartender couldn't follow it without
  asking what a word means, rewrite it.
- Writing the file + committing to main is a guarded action (it's shared docs):
  go through `ask_claude_code` or a human-confirmed todo, and always RAG-rescan after.
