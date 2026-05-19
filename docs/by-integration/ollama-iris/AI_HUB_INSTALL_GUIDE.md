# AI Hub — Install + Operator Usage Guide

**Audience:** location operators bringing the AI Hub online at a new
location, OR refreshing it after a major doc update.

**What "AI Hub" means here:** the local Ollama LLM (running on Intel
Iris Xe iGPU) + RAG vector store (~3000+ chunks of indexed
documentation about every piece of hardware, integration, and
operational gotcha at the bar). Reachable via:

- `/device-config → Audio → Wireless Mics → Interference Patterns (AI)`
- `POST /api/rag/query` (direct RAG q&a)
- `POST /api/shure-rf/pattern-digest` (RF-specific Ollama analysis)
- `/ai-hub` page (chat UI — Option B unification pending)

Status as of v2.46.x: **Tier 1 of the 3-tier AI roadmap is shipped**.
See `docs/by-equipment/shure-sdr/AI_RF_SME_ROADMAP.md` for the full
tier plan including the future Claude Code CLI escalation hookup.

---

## Part 1 — Prerequisites (one-time per location)

### 1a. Hardware

- **Intel Iris Xe iGPU** required for fast inference (~14 tok/s on
  llama3.1:8b). Most fleet boxes already have this — see
  `docs/FLEET_STATUS.md` for per-location iGPU status.
- **CPU-only fallback** works but is 5x slower (~3 tok/s). Pattern
  digest would take 3–5 min instead of 40–90 sec. Usable but
  noticeably worse UX.
- **8 GB RAM minimum** for llama3.1:8b (Q4 quantization). 16 GB
  recommended if you want to also run qwen2.5:14b for tougher
  technical reasoning.
- **~10 GB disk** for the model cache + vector store.

### 1b. Software baseline

These should be in place from the standard install:

```bash
# Verify Node.js 22+
node --version

# Verify PM2 is managing sports-bar-tv-controller
pm2 list | grep sports-bar-tv-controller

# Verify the app is on v2.46.x or later (RAG is wired up)
curl -sS http://localhost:3001/api/version
```

If any of the above is missing, finish the standard location setup
first (`docs/NEW_LOCATION_SETUP.md` + `docs/VERSION_SETUP_GUIDE.md`).

---

## Part 2 — Install Ollama (IPEX-LLM iGPU build)

The fleet uses the **IPEX-LLM portable build** for iGPU
acceleration (not stock Ollama). This is the v2.32.57+ standard.

```bash
# One-time install script (idempotent — safe to re-run)
sudo bash scripts/setup-iris-ollama.sh
```

Verify it's running on the iGPU:

```bash
journalctl -u ollama-ipex | grep "using Intel GPU"
# Expected: a line confirming SYCL/Intel GPU detected
```

Pull required models:

```bash
ollama pull llama3.1:8b        # Main inference (4 GB)
ollama pull nomic-embed-text   # RAG embeddings (~280 MB)
# Optional — heavier reasoning on tough technical questions
ollama pull qwen2.5:14b        # 8 GB
```

Verify models loaded:

```bash
curl -sS http://127.0.0.1:11434/api/tags | python3 -m json.tool
```

**Per-location note:** the `setup-iris-ollama.sh` script will refuse
to run on hardware without an Intel iGPU (it probes via `clinfo`).
On AMD/Nvidia boxes use stock Ollama instead — performance is
similar to CPU-only on most fleet hardware.

---

## Part 3 — Index docs into the RAG store

This is the step that gives the AI subject-matter expertise. Without
this, Ollama can only fall back on its generic training data.

```bash
# One-shot full system index — takes 30–60 min on iGPU
npx tsx scripts/scan-system-docs.ts --clear
```

What this indexes:
- `CLAUDE.md` (master architecture + standing rules)
- All `docs/**/*.md` and `docs/**/*.pdf`
- All `packages/*/README.md` (per-package SME briefings)
- All `.claude/locations/*.md` (per-bar hardware refs)
- All `ai-assistant/*.md`
- All auto-memory feedback + project files
- Root-level `*.md` (INSTALLATION, DEPLOYMENT, etc.)

Result: ~3000–4000 chunks across ~650+ docs, stored at
`apps/web/rag-data/vector-store.json`.

Verify the index landed:

```bash
curl -sS http://localhost:3001/api/rag/stats | python3 -m json.tool
# Expected: totalChunks > 2500, totalDocuments > 400
```

### When to re-run the scan

- After a `git pull` that touches `docs/`, `CLAUDE.md`, or
  `packages/*/README.md`
- After adding a new piece of equipment or third-party integration
  doc to `docs/by-equipment/<vendor>/` or `docs/by-integration/<service>/`
- After writing new auto-memory files (operator gotchas worth
  preserving)
- After any major code merge if you want the AI's knowledge
  current

```bash
# Incremental refresh (faster, ~10 min) — only re-indexes new files
npx tsx scripts/scan-system-docs.ts

# Full rebuild (slower, ~30–60 min) — recommended if anything has
# moved or major refactors have landed
npx tsx scripts/scan-system-docs.ts --clear
```

### Optional — RF-only scan

If you only need the AI to know about the Shure / SDR / Atlas RF
subsystem and want a smaller / faster index:

```bash
npx tsx scripts/scan-rf-docs.ts --clear
```

Indexes only the ~15-20 RF-relevant docs. Faster (5 min) but the AI
won't be able to answer questions about Fire TV, DirecTV, matrix
routing, deployment, etc.

---

## Part 4 — Operator surfaces

### 4a. Pattern Digest (production-ready)

**Where:** `http://<bar-ip>:3001/device-config → Audio → Wireless
Mics → Interference Patterns (AI)`

**What it does:** runs Ollama on the last 30 days of RF interference
events with RAG-grounded context (Green Bay TV stations,
fox-and-hound rogue carrier model, Atlas 4.5 Custom Priority Volume
gotcha). Produces a natural-language summary identifying recurring
patterns + concrete mitigation suggestions.

**How operators use it:**
1. Click "Analyze" — first run takes 60–180 sec
2. Read the output (cited docs + frequencies + specific times)
3. Subsequent clicks within 1 hour return the cached result instantly
4. Click "Re-analyze" to force a fresh run

### 4b. Direct RAG Query (developer-facing)

**Endpoint:** `POST /api/rag/query`

```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"query": "How do I configure the Atlas zone priority?"}'
```

Returns a grounded answer + cited source documents. No auth
required. Useful for debugging / scripting.

### 4c. AI Hub Chat (Tier 2 — pending)

**Where:** `http://<bar-ip>:3001/ai-hub`

**Status:** **Currently uses a separate (older) document-search
backend** — does NOT see the RAG store we just indexed. Option B
unification is on the roadmap but not yet shipped. See
`docs/architecture/AI_OPERATIONS_HUB_DESIGN.md`.

When Option B ships, this chat will be fully RAG-grounded and able
to answer any question about any piece of equipment at any location.

---

## Part 5 — Per-location rollout checklist

For each NEW location adding the AI Hub:

- [ ] Confirm Intel Iris Xe iGPU present (`clinfo | grep Intel`)
- [ ] Run `sudo bash scripts/setup-iris-ollama.sh`
- [ ] Verify GPU acceleration: `journalctl -u ollama-ipex | grep "using Intel GPU"`
- [ ] Pull models: `ollama pull llama3.1:8b nomic-embed-text`
- [ ] Verify Ollama responds: `curl http://127.0.0.1:11434/api/tags`
- [ ] Pull latest repo: `cd /home/ubuntu/Sports-Bar-TV-Controller && git pull`
- [ ] Run full system scan: `npx tsx scripts/scan-system-docs.ts --clear`
- [ ] Verify index: `curl localhost:3001/api/rag/stats` → totalChunks > 2500
- [ ] Test pattern digest in `/device-config → Audio → Wireless Mics`
- [ ] Add the AI Hub URL to the operator quick-reference
  (`docs/BARTENDER_QUICK_START.md` if applicable)

---

## Part 6 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/rag/stats` returns `chunks=0` | Vector store empty (never scanned, or scan wrote to wrong path) | Re-run `npx tsx scripts/scan-system-docs.ts --clear` from repo root — script auto-chdirs to `apps/web/` internally (v2.46.1+ fix) |
| `/api/rag/stats` returns `chunks=X` but `/api/rag/query` says "no relevant info" | Query terms too generic | Rephrase with specific keywords (vendor name, protocol, port) |
| Pattern digest takes >5 min | CPU-only fallback (iGPU not detected) | Check `ollama ps`, `journalctl -u ollama-ipex`. Re-run `scripts/setup-iris-ollama.sh` to re-detect GPU |
| Pattern digest returns "Application error: ..." | Front-end React error (often TDZ on stale browser bundle) | Hard-refresh (Ctrl-Shift-R / Cmd-Shift-R). If persists, check browser DevTools Console for the stack trace |
| `ollama ps` shows `size_vram=0` even though it's fast | Known IPEX-LLM quirk — reports VRAM=0 even when iGPU-loaded | Use `intel_gpu_top -l -s 1` to confirm iGPU activity. See `feedback_ipex_llm_sycl_quirks.md` memory |
| RAG scan completes but API still shows old chunk count | Vector store cached in Next.js worker process | `pm2 restart sports-bar-tv-controller --update-env` |

### Common path errors

- **`./rag-data/vector-store.json` exists at repo root**: leftover
  from before v2.46.1 chdir fix. Delete it — the API reads from
  `apps/web/rag-data/vector-store.json`.
- **Scan script seems hung with no output**: likely buffering through
  `tail` or `head`. Run with `nohup` to log file:
  ```
  nohup npx tsx scripts/scan-system-docs.ts --clear > /tmp/scan.log 2>&1 &
  tail -f /tmp/scan.log
  ```

---

## Part 7 — Refreshing the index over time

**Recommended cadence:** weekly cron job to keep the index current
without operator intervention.

```cron
# Every Sunday at 3 AM, refresh the RAG index from latest docs
0 3 * * 0 cd /home/ubuntu/Sports-Bar-TV-Controller && npx tsx scripts/scan-system-docs.ts > /var/log/rag-scan.log 2>&1
```

Or run manually after any significant doc update.

---

## Part 8 — What's NEXT (Tier 2 + Tier 3)

See `docs/architecture/AI_OPERATIONS_HUB_DESIGN.md` for the full plan.

**Tier 2 (deferred until operator asks):** unify the AI Hub chat
(`/ai-hub`) so it uses our RAG store as the sole document-search
backend. About 2 hours of work.

**Tier 3 (gated on 4+ weeks of real game-day data, target end-of-Sep
2026):** AI delegates tasks to Claude Code CLI for code-level fixes.
Local AI detects scheduler errors, writes a task to a `claude_tasks`
queue, operator approves in the UI, dispatcher invokes
`claude -p "..."` to fix it autonomously.

---

## Cross-references

- `CLAUDE.md` §9 — Ollama runtime architecture
- `docs/architecture/AI_OPERATIONS_HUB_DESIGN.md` — full Tier 1/2/3 plan
- `docs/by-equipment/shure-sdr/AI_RF_SME_ROADMAP.md` — RF-specific AI plan
- `docs/by-integration/ollama-iris/ollama-api-reference.md` — Ollama API reference (fetched 2026-05-18)
- `scripts/scan-system-docs.ts` — the full-system indexer
- `scripts/scan-rf-docs.ts` — RF-only indexer (faster, narrower)
- `scripts/setup-iris-ollama.sh` — iGPU Ollama install
- Memory: `feedback_ipex_llm_sycl_quirks.md`
