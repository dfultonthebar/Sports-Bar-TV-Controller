# Local AI as RF Coordination SME — Roadmap

**Status as of 2026-05-18:** Tier 1 complete (v2.46.0). Tier 2 and 3
deferred until post-August preseason data accumulation.

## What "SME" means here

A subject-matter-expert local AI for the Shure / SDR / Atlas RF
coordination subsystem can answer questions like:

- "Why is Channel 2 getting hammered on Saturdays?" — with cited
  evidence from event history + doc snippets explaining the local
  Green Bay RF landscape.
- "Should I move Mic 1 if I add a third channel?" — with knowledge
  of intermodulation rules + our existing Group 05 placement.
- "What's that mystery carrier at 488 MHz?" — by classifying its
  signature (continuous vs PTT, narrow vs wide, recurring time
  pattern) per the fox-and-hound model.
- "Did the Atlas firmware update cause this?" — recognizing
  Custom Priority Volume drop signatures from the 4.5+ release.

Without explicit training, llama3.1:8b knows generic UHF concepts
but NOT this bar's specific stack or history.

## The three tiers

### Tier 1 — RAG-grounded pattern digest (DONE in v2.46.0)

**What shipped:**
- `scripts/scan-rf-docs.ts` indexes the RF-relevant docs into the
  RAG vector store: CLAUDE.md (§7a Shure, §7b SDR, Gotcha #10),
  packages/shure-slxd/README.md, packages/atlas/README.md,
  RF-related memory feedback files, LOCATION_UPDATE_NOTES,
  VERSION_SETUP_GUIDE.
- `/api/shure-rf/pattern-digest` POST now:
  1. Runs the existing stats computation
  2. Queries RAG with a synthesized query blending worst-freq +
     RF coordination keywords
  3. Injects top-6 retrieved chunks into the Ollama prompt
  4. Also injects a hard-coded `HOLMGREN_CONTEXT` block with the
     local TV station map, current Shure freq assignments,
     known interferers, hardware/firmware state
  5. Tells Ollama to frame unknown carriers as "foxes" per
     ham-radio fox-and-hound model
  6. Ollama generates a grounded analysis citing doc snippets

**Operator experience after Tier 1:** "Analyze" button in
`/device-config → Audio → Wireless Mics → Interference Patterns (AI)`
returns concrete recommendations that name specific frequencies +
cite specific gotcha docs + use the fox-and-hound vocabulary.

**Re-run when docs change:** `npx tsx scripts/scan-rf-docs.ts --clear`

### Tier 2 — Chat-style RF coordination assistant (DEFERRED)

**Goal:** operator types freeform questions, AI answers with
grounded responses.

**Trigger to build:** when there are at least 2-3 weeks of real
event history AND an operator has identified specific questions
they keep asking. Premature without real questions.

**Estimated effort:** 1-2 days.

**Scope:**
- New `/api/shure-rf/chat` endpoint with multi-turn conversation
  memory (per-session, no auth-tied identity needed)
- New `<ShureRfChatPanel />` component in
  `/device-config → Audio → Wireless Mics`
- Reuses Tier 1's RAG retrieval + HOLMGREN_CONTEXT pattern
- Could optionally swap to `qwen2.5:14b` for better technical
  reasoning (already downloaded, 2x latency)

**Data prerequisite:** None — would work today, just wasteful
without real operator questions to test against.

### Tier 3 — Function-calling RF agent (DEFERRED until Aug 2026+)

**Goal:** AI as an active diagnostic tool that can query data,
test hypotheses, propose freq changes, classify carrier signatures.

**Trigger to build:** **4+ weeks of game-day data accumulation**
post preseason start (target: end of September 2026 for first
useful iteration). Without this data the agent has nothing
meaningful to reason over.

**Estimated effort:** 3-5 days.

**Scope:**
- Tool definitions: `get_freq_history(freq, days)`,
  `compare_to_atlas_priority(time_window)`,
  `suggest_clean_freq(band, exclude_freqs)`, `classify_carrier(freq,
  time_window)` (signature analysis: continuous/PTT/burst,
  narrow/wide, recurring/anomaly)
- Agent loop using Ollama's function-calling support (qwen2.5
  has better tool calling than llama3.1)
- UI: same chat panel as Tier 2 but with rendered tool-call
  results inline

**Data prerequisite:** ≥ 4 weeks of real game-day RF events in
`shure_rf_events` + `sdr_carriers` + `atlas_priority_events`
tables. Until that exists the agent will make up answers.

**Hardware prerequisite:** RTL-SDR dongle (NESDR Smart) operational.
Without SDR data the agent can't do carrier-signature classification.

## Data collection milestones — when each Tier unlocks

| Date target | Data state | Tier unlocked |
|---|---|---|
| **2026-05-18 (DONE)** | Synthetic + initial baselines | Tier 1 functional |
| **End of June 2026** | ~6 weeks of baseline data + a handful of operator-triggered tests | Tier 2 build-out worth it if operator asks for it |
| **August 2026 preseason start** | Real game-day RF starts hitting | Continue Tier 1; gather data |
| **End of September 2026** | 4+ weeks of game-day data | Tier 3 build-out viable |
| **End of October 2026** | Full preseason + start of regular season | Tier 3 has meaningful training signal |

## Fox-and-Hound vocabulary (for future-Claude consistency)

Operators in this codebase frame rogue carriers as "foxes" per the
ham radio amateur direction-finding sport (ARDF). When implementing
Tier 2/3, use this vocabulary consistently:

- **Fox** — an unidentified RF carrier we've detected
- **Hound** — our detection apparatus (Shure receiver + SDR + Atlas
  correlation), collectively
- **Signature** — the distinguishing pattern of a fox: continuous vs
  intermittent, narrow vs wide, recurring vs one-off, correlated vs
  uncorrelated with our mic activity
- **Naming a fox** — once a fox has a repeating signature, give it a
  human label ("Saturday ENG truck", "Building maintenance carrier at
  3 AM", "Neighbor venue wireless")
- **Hunting** — actively characterizing a fox over multiple
  observations to refine its signature
- **Triangulation NOT possible** — we have a single fixed SDR, no
  directional antenna. Tier 3 can classify by signature but cannot
  geolocate. Multi-site SDR would unlock true ARDF but is out of
  scope for this project.

## How to keep the RAG index fresh

Run after any of:
- New CLAUDE.md §7 subsection added
- New memory file under `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/`
  with RF / Shure / SDR / Atlas content
- packages/shure-slxd/README.md updated
- New LOCATION_UPDATE_NOTES entry mentioning the RF subsystem

```bash
npx tsx scripts/scan-rf-docs.ts          # incremental — refresh listed files
npx tsx scripts/scan-rf-docs.ts --clear  # wipe + rebuild (recommended after major doc changes)
```

Verify with:

```bash
curl -sS http://localhost:3001/api/rag/stats | python3 -m json.tool
# expect totalChunks > 0 + totalDocuments matching files indexed

curl -sS -X POST http://localhost:3001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"query": "What is the GROUP_CHANNEL gotcha on Shure SLX-D?"}'
# expect a grounded answer citing CLAUDE.md or packages/shure-slxd/README.md
```
