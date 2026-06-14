# Bartender How-Tos — Coverage Plan

**Status:** Draft 2026-05-26. Awaiting operator approval.
**Authors:** Synthesized from Grok outside-perspective audit + 2 Explore subagents (UI surface inventory, voice-template reverse-engineering).

## What we have today (4 docs)

- `MIC_NOT_WORKING.md` — wireless mic triage
- `WRONG_CHANNEL_ON_TV.md` — channel/source routing fixes
- `MUSIC_OR_AUDIO_PROBLEM.md` — music + zone audio
- `RF_INTERFERENCE_FOR_BARTENDERS.md` — banner meanings, ghost overrides

All four share a proven voice (silver-box / can't-break-it / second-person / physical-object descriptors / escalation-with-photos). Average ~2,600–3,400 words, 70% prose / 30% steps, no screenshots, no code blocks.

## What we're missing

~65 distinct bartender actions across 11 panels (Video, Guide, Audio, Power, Routing, Music, Lighting, Remote, Schedule, DJ Mode, Ask AI). The 4 existing docs cover roughly 30% of that surface, and only the reactive "something is broken" half. Proactive flows (pre-shift checks, scheduled-game assignment, scene recall, multi-view, DJ-lock) have zero coverage.

## Approach (3-source consensus)

**NOT** 40 micro-docs (too fragmented, bartenders won't find them).
**NOT** 2 mega-docs (too long, won't read mid-shift).
**Group by mental model the bartender already has.** A bartender thinks "the TVs are wrong" or "the music sucks", not "the InteractiveBartenderLayout component". Each doc covers a coherent problem space across whichever UI tabs solve it.

## Proposed set: 9 docs total (4 existing + 5 new)

| # | Doc | Surface covered | Mode | Priority |
|---|-----|-----------------|------|----------|
| 1 | `MIC_NOT_WORKING.md` ✓ | Wireless mics, batteries, sync | Reactive | — |
| 2 | `WRONG_CHANNEL_ON_TV.md` ✓ | Reactive channel/source fixes | Reactive | — |
| 3 | `MUSIC_OR_AUDIO_PROBLEM.md` ✓ | Music + zone audio reactive | Reactive | — |
| 4 | `RF_INTERFERENCE_FOR_BARTENDERS.md` ✓ | Banner meanings | Reactive | — |
| 5 | `PUTTING_GAMES_ON_TVS.md` (NEW) | Guide tab, Schedule tab, layout routing, one-tap watch, Channel Guide search | Proactive + reactive | HIGH |
| 6 | `AUDIO_ZONES_AND_GROUPS.md` (NEW) | Atlas/DBX/HTD zone control, group volume, mute, source switching, meters | Proactive + reactive | HIGH |
| 7 | `LIGHTING_AND_SCENES.md` (NEW) | DMX + Commercial scenes, brightness, all-on/off, trivia/game-day setups | Proactive | MED |
| 8 | `POWER_AND_NETWORK_TVS.md` (NEW) | Power tab: per-TV / bulk power, HDMI inputs, pairing Samsung, rename | Proactive + setup | MED |
| 9 | `PRE_SHIFT_WALKTHROUGH.md` (NEW) | First-5-minutes-of-shift checklist: Shift Brief, mic battery sweep, music check, banner scan, Ask AI for tonight's heads-up | Proactive | HIGH |

**Deliberately deferred** (low frequency, can wait):
- DJ Mode lock (rare, special-event only)
- Quick Routing Grid matrix view (power-user / troubleshooting)
- Multi-View Quad Card toggle (event-specific)

These will get short paragraph mentions in the relevant new doc rather than dedicated files.

## Template (reverse-engineered from the 4 existing)

```markdown
# [Problem or Task Title] — Bartender Help

**For:** [audience].
**Goal:** [what success looks like].
**Time to fix:** [typical duration].
**You can't break it:** Every step here is the normal way to fix this.

## 30-second triage — start here
[2–3 yes/no routing questions]

## Scenario N: [Problem name]
**What this looks like:** [customer-facing symptom]

**Quick check first:**
1. [Non-destructive observation]
2. [Decision point]

### What to do
1. [Step]   (4–7 steps total)

### How you know it worked
- [Observable indicator]

### If it didn't work
- **[Symptom]:** [branch or next step]

## When to text the manager
- Text the manager if: [conditions]
- Include: photo, screenshot, what you tried, what it's doing now

## You did great
[Closing reassurance — escalation is success]
```

**Voice rules (non-negotiable):**
- Second person, present tense
- Physical-object descriptors ("silver box with stubby antennas", "round mesh ball")
- Zero jargon, or instant de-jargonization ("RF = radio frequencies")
- Reassurance early and often ("you can't break it")
- Time estimates per scenario
- Escalation framed as success, not failure
- No code blocks, no screenshots (text only)
- Karaoke uses BYO mics — never use "karaoke mic" as the canonical example. Use "wireless mic" / "paging mic" / "hosted-event mic".

## Template upgrades vs the existing 4

The 4 current docs lack these — new docs should include them:

1. **"What the customer sees while you fix it"** — sets expectations
2. **"What to say to the customer"** — turns the doc into a bartender script
3. **Per-scenario time-to-fix** (not just doc-level)
4. **Explicit "What NOT to do"** sections (existing docs have these inconsistently)
5. **Ask AI Hub pointer** — newer docs assume the floating button exists

## Writing execution plan

1. **Backfill the template upgrades into existing 4 docs** (4 docs, ~30min each). Voice already locked; just adding sections.
2. **Write 5 new docs in 2 parallel subagent waves**:
   - Wave 1 (2 subagents): `PUTTING_GAMES_ON_TVS.md` + `AUDIO_ZONES_AND_GROUPS.md` (HIGH priority)
   - Wave 2 (3 subagents): `LIGHTING_AND_SCENES.md` + `POWER_AND_NETWORK_TVS.md` + `PRE_SHIFT_WALKTHROUGH.md`
3. Each subagent gets: this PLAN + the template + voice rules + the relevant UI inventory section
4. **Consolidation pass** (1 agent) for cross-refs, escalation consistency, terminology
5. **Seed Q&A pairs** for the chat: extract ~3-5 questions per new doc, append to `scripts/seed-bartender-qa.ts`. Adds ~20 pairs to the existing 17, target ~37 curated bartender Q&A in the chat retrieval pool.
6. **RAG re-scan** so the Ask AI chat surface picks up the new files (Standing Rule 11).

Estimated: 1 working session for backfills + wave 1, 1 session for wave 2 + consolidation + seed Q&A + RAG.

## UX bugs surfaced during the audit (separate from doc work)

Grok flagged these — fix candidates for a different PR, not doc-writing:

1. **Input labels are cryptic** ("Input 3" vs "Cable Box 2 (DirecTV)") on the floorplan
2. **Two parallel power systems** (matrix-routed vs network-discovered Samsung/Roku) with no unified path or explanation
3. **Multi-view Quad Card** never previews the layout in the UI before applying
4. **"More" overflow tab** has near-zero discoverability for DJ Mode + Override-Learn
5. **HDMI input switching** lives only in Power tab, not on the main Video layout

These should land before/after the docs depending on operator priority — the docs as written will work around them, but fixing them shrinks how much the docs have to explain.
