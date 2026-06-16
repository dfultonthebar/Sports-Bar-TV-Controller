# Hermes Autonomous Fleet-Ops Loop — detect → diagnose → correlate → propose

**Status:** Plan (not yet implemented). Target start: T4-day (#358) onward. Tracks task **#359**.
**Author:** drafted 2026-06-16 after the channel-guide centralization + fleet OAuth unfreeze landed.

## The one-line idea

Today the fleet **detects** errors and files a bare "investigate this" TODO. This plan adds the three missing layers — **diagnose** (root cause + proposed fix via RAG + the T4 LLM), **correlate** (one fleet issue instead of 6 per-box duplicates), and **propose** (Hermes drafts the fix for operator approval). That is the substance of #359 ("kanban worker: wiring proven, blocker is runtime/model not code") — the T4 card removes the runtime blocker.

## What already exists — build on, do NOT rebuild

Verified against the live code (file:line):

| Capability | Where it lives | Shape |
|---|---|---|
| **Detect** | `scripts/watchers/error-watch.sh` → `POST /api/error-watch/todo` | tails PM2 error logs, 8 hardcoded signatures, 30s in-memory dedup window |
| **Store TODO** | `Todo` table (`packages/database/src/schema.ts:528`) + `/api/todos/route.ts` | `priority CRITICAL\|HIGH\|MEDIUM\|LOW`, `status PLANNED\|IN_PROGRESS\|TESTING\|COMPLETE`, `category`, `tags`, GitHub-synced on every mutation |
| **Dedup TODO** | `apps/web/src/app/api/error-watch/todo/route.ts:47` | matches `tags=errorwatch:<sig>` AND `status != COMPLETE` → re-files only after the prior one is closed |
| **Fleet aggregation** | `packages/hub-agent` (`collect.ts:116`) → `POST /api/ingest/errors` → hub `error_events` | `ErrorEvent {source, signature, severity, sample, occurredAt}`; hub dedups on `(locationId, source, signature, occurredAt)` unique index |
| **Hub reasoning** | `apps/hub/src/lib/ai.ts` `askFleet()` | grounded with `buildFleetContext()` FLEET STATUS text, → Ollama on CT 212 (`HUB_OLLAMA_BASE`, `llama3.1:8b`) |
| **RAG** | `apps/web/src/app/api/rag/query/route.ts` + `packages/rag-server/src/query-engine.ts` | in: `{query, tech?, topK?, includeContext?, temperature?}`; out: `{answer, sources[], metadata}`; all docs/CLAUDE.md/memory indexed; `RAG_RERANK_ENABLED` gates the cross-encoder |
| **Delivery** | Hermes crons on CT 212 (`~/.hermes/scripts/sports-bar-*.sh`, `--deliver local` → `tg_send`) | the cron + Telegram pattern to copy for the worker |

**The gap:** between "TODO filed" and "operator reads logs" there is no diagnosis and no cross-fleet view. The auto-filed TODO literally says *"Investigate, fix, then mark COMPLETE."*

## Design — 3 additive layers, each flag-gated default-off

### Layer 1 — Diagnosis enrichment (location side; smallest, ship first)

Extend the existing `/api/error-watch/todo` handler with a diagnose step before it writes the TODO:

1. Grab the error sample + surrounding log context.
2. `POST /api/rag/query` with the signature + sample → matching gotchas/docs/memory.
3. Call the LLM **via `@sports-bar/ollama-client`** (remote-first → T4) with `{sample, logContext, ragSources}` → structured:
   ```json
   { "rootCauseHypothesis": "...", "affectedComponent": "...", "proposedFix": "...", "confidence": "high|medium|low", "relevantDocs": ["..."] }
   ```
4. Write that block into the TODO `description`; add tag `diagnosed:1` so the same TODO is never re-diagnosed.

Result: the operator opens a TODO that already reads *"Root cause: ChannelPreset 308 missing trailing `+` → BREWERS.TV won't bind (CLAUDE.md §9a). Proposed fix: rename preset to 'Bally Sports Wisconsin+'. Confidence: high."* — not "investigate."

Flag: `DIAGNOSE_ENABLED` (default off until the T4 makes the LLM call fast enough to leave on).

### Layer 2 — Fleet correlation (hub side)

New hub job (piggyback on the ingest cadence) over `error_events` across all 6 boxes:

1. Group by **normalized signature + sample-text similarity** within a window — NOT just the 8 coarse signatures (avoids lumping two different `type_error`s).
2. Same signature on **≥2 boxes** → upstream code/preset bug, not per-box. Produce `{signature, affectedLocations[], count, firstSeen, severity}`.
3. One `askFleet()` diagnosis for the group + RAG → emit **one** fleet-level record instead of 6 duplicates.

New: `POST /api/diagnose` on the hub (parallel to `/api/ingest`, `/api/game-data`) + hub table `fleet_diagnoses`. Surfaces on the existing hub `/chat` dashboard.

### Layer 3 — Propose (the Hermes worker = #359)

New Hermes cron on CT 212 `sports-bar-ops-worker.sh`, every N min:

1. Pull open TODOs (`/api/todos?status=PLANNED`) + hub `fleet_diagnoses`.
2. For each un-proposed one, use the diagnosis to **draft** a fix: a git branch + patch (code / `.env` / doc), **pushed for review, never merged**.
3. Telegram: *"3 boxes hit resolver-miss X. Root cause Y. Draft on `hermes/fix-X`. Approve?"*
4. Operator approves → the existing **`auto-update.sh`** path applies it (now OAuth-gated, so it actually runs the checkpoint).

**Hard guardrail:** drafts only — never merges, never executes. Same rule as bar hardware and trade execution.

## Data flow

```
error ─► error-watch.sh ─► [L1: RAG + T4 diagnose] ─► enriched TODO (location, GitHub-synced)
       └► hub-agent ─► error_events ─► [L2: group + askFleet] ─► fleet_diagnoses (hub)
                                                              └► [L3: Hermes worker draft + TG] ─► operator approves ─► auto-update.sh
```

## Build sequence

0. **Prereq (T4-day, #358):** `@sports-bar/ollama-client` remote-first live so diagnosis runs on the T4, not a location iGPU (the iGPU is too slow to leave diagnosis on by default).
1. **Layer 1** — enrich the TODO. Self-contained, immediately useful, Holmgren canary. *(This alone is a big day-to-day win.)*
2. **Layer 2** — hub correlation + collapse per-box noise. Canary with a synthetic same-signature-on-2-boxes.
3. **Layer 3** — Hermes worker: ship **read-only first** (diagnosis → Telegram, no draft), then add draft-branch, then the approve→apply handoff.

## Honcho's role (after the deriver is live)

Write each diagnosis **and its outcome** (did the fix work?) to the `sports-bar` Honcho workspace. Hermes then learns which proposed fixes actually worked → future diagnoses cite *"last time signature X, fix Y worked."* That closes the **learning loop** (the #349 item) — and it is `sports-bar` workspace ONLY, never `trading-bot` (domain isolation rule).

## Risks & mitigations

- **Hallucinated root cause** → always attach RAG sources + a confidence score; low-confidence = labeled "unverified hypothesis"; never auto-applied.
- **T4 contention** (diagnosis + AI Suggest + deriver on one 16 GB card) → diagnosis is lowest priority and sheds first via the planned `ollama-client` load-shedding.
- **False correlation grouping** → require sample-text overlap, not just a shared coarse signature.
- **Regression risk** → every layer flag-gated default-off; the existing detect→TODO path keeps working untouched if a new layer fails.

## Standing-rule compliance

main-first + version bump + `VERSION_SETUP_GUIDE.md` entry per ship; force-rebuild on package changes; Holmgren canary each layer; RAG re-scan on each doc/commit; Hermes proposes-never-executes; domain isolation (`sports-bar` workspace only).
