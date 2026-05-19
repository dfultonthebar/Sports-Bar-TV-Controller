# AI Hub Roadmap — v2.50.x and beyond

**Drafted:** 2026-05-18, synthesis of 4 parallel web-research agents commissioned to
answer "how can we make the local LLM do more and learn more about our system."

**Status:** strategic plan; not yet executed. Each item below has citations + concrete
implementation paths. Update this doc as items ship — keep `Status:` lines current
so the AI Hub itself can answer "what's done and what's pending."

**TL;DR:** there are FOUR quick wins (each ≤2 dev-days, no new deps, no new models)
that collectively address every failure mode we've seen this week. Ship them first.
Then a 90-day continual-learning track that gets cheaper-better-smarter every week
without manual curation.

---

## The four quick wins — ship in one batch as v2.50.0

| # | Change | Files | Estimated | Solves |
|---|---|---|---|---|
| 1 | `OLLAMA_KEEP_ALIVE=-1` + audit system prompt for dynamic tokens (timestamps, request IDs) that poison the KV cache | `ecosystem.config.js` env, `apps/web/src/app/api/chat/route.ts` prompt builder | 10 min | **17× prefill speedup** on warm follow-up requests; turns "100s every time" into "100s once, then <10s." Closes the Graystone-vs-Appleton timing gap (170s vs 67s). |
| 2 | Batch `nomic-embed-text` calls in `rag-server/doc-processor.ts` — currently embeds chunk-by-chunk; switch to `input: [chunk1, chunk2, ...]` array | `packages/rag-server/src/doc-processor.ts`, `packages/rag-server/src/vector-store.ts` | 1-2 hrs | **10-50× faster RAG rescans.** Lets us rebuild on every commit instead of "kick off + wait 40 min." Eliminates the scan-was-running-before-the-doc-existed bug we hit today. |
| 3 | Replace the brittle `TOOL_CALL:` regex parser at `chat/route.ts:624` with Ollama's native `tool_calls` API (since Ollama 0.3, Jul 2024) | `apps/web/src/app/api/chat/route.ts`, tool definitions in `lib/ai-tools/` | 1-2 days | **Tool reliability 94-98%** vs our regex's ~70%. Eliminates malformed-block failures. Zero new deps. |
| 4 | Switch chat default to **qwen2.5:14b** when `request.tools.length > 0` (keep llama3.1:8b for plain chat) | `apps/web/src/app/api/chat/route.ts` model selector | 30 min | **8B is below the practical minimum for reliable multi-tool work** (BFCL benchmark). qwen2.5:14b is already pulled + iGPU-resident per FLEET_STATUS. |

**Verification gate before promotion:** run the 15-question RAG grilling suite +
the bartender register-detection test. If chat answers are no worse than v2.49.x,
ship to all locations.

**Cost: $0.** Pure config + Ollama-native API.

---

## Three RAG-quality wins — ship as v2.50.1 (one week after #0)

These compound: total documented effect when stacked is **-67% retrieval failure
rate** vs our current cosine-only setup.

| # | Change | Files | Estimated | Solves |
|---|---|---|---|---|
| 5 | **Contextual Retrieval** (Anthropic Sept 2024): walk our chunks, ask llama3.1:8b for 50-100 tokens of doc-level context per chunk, prepend before embedding. New `contextPrefix` field in vector store schema. | New script `scripts/contextualize-chunks.ts`, `packages/rag-server/src/doc-processor.ts` | 1 day code + 30-60 min generation on iGPU | **Single biggest accuracy gain documented anywhere.** -35% retrieval failure embeddings alone, -67% stacked with #6 + #7. Fixes the SLX-vs-SLX-D wrong-product-line confusion permanently (chunk gains "from CLAUDE.md §7a, Shure SLX-D firmware 1.4.7.0" prefix). |
| 6 | **Hybrid search (BM25 + vector + RRF fusion)** — add `better-sqlite3 FTS5` virtual table mirroring chunks; wrap retrieval with `parallelRetrieve()` + `rrfFuse()` (k=60) | `packages/rag-server/src/vector-store.ts` (new `hybrid-search.ts`) | 1 day, ~200 LOC, zero model deps | Nails **literal-identifier queries** (TX_MODEL, outputOffset, ERR_2:1,010, port 3804) that our dense embeddings smear into "config-ish concept" space. Directly fixes the "AI hedges instead of citing the table cell" failure. |
| 7 | **Cross-encoder re-ranking** with `bge-reranker-v2-m3` via `@xenova/transformers` (WASM, no new server) — take top-50 by hybrid score, re-rank to top-8 | `packages/rag-server/src/reranker.ts` (new), `query-engine.ts` integration | 1 day, ~100 LOC + 1.2GB model download | Joint (query, chunk) scoring vs independent cosine. Catches **tangentially-related-§** matches. Compounds with #5 + #6 for the Anthropic-documented -67% total. |

**Pre-condition:** ship #2 first so re-embedding the full corpus (required by #5)
takes 5 min instead of 40 min.

**Cost: $0.** All open-source models, all run on existing iGPU.

---

## Continual learning track — incremental over 90 days

Per the continual-learning research agent's report, the right strategy is
**ship inference-time wins first, training pipelines second**:

### Week 1 — In-context learning (zero training)

| # | Change | Effect |
|---|---|---|
| 8 | UI: thumbs-up/down + "Mark resolved" + Regenerate-with-store on every assistant message. New `ChatFeedback` table (`messageId, type: explicit\|implicit, sentiment: pos\|neg, weight: 0-1`). | Captures the signal we currently throw away. Foundation for everything below. |
| 9 | Embed thumbs-up questions into a new vector store keyed on `ChatMessage WHERE feedback='positive'`. `query-engine.ts` retrieves top-3 similar past-good-answers and prepends as few-shot exemplars in the system prompt. Cap at 3 × 400 tokens to avoid context bloat. | **Answer quality compounds week-over-week from zero-training feedback.** This is the right first move per 2025 ICL-vs-fine-tune research. |
| 10 | Reflexion lessons cron: hourly, qwen2.5:14b critiques each closed chat session ("given the operator's question, our answer, and that they [thumbs-down\|asked a follow-up\|stopped here], write a 2-sentence lesson"). Lessons inserted into RAG store with `lesson:` tag and +10% retrieval boost. LRU cap at 500. | Persistent reflective memory. No forgetting risk. Cheap. |

**Cost: $0, ~3 dev-days.**

### Month 1 — Synthetic seed corpus

| # | Change | Effect |
|---|---|---|
| 11 | Run `scripts/generate-qa-dataset.ts` (already written in v2.49.7) using qwen2.5:14b across all 6,000 RAG chunks → 30-50K synthetic Q-A pairs in JSONL. Dedup near-duplicates by embedding cosine > 0.92. | Trains llama3.1:8b to be **natively domain-fluent on our docs BEFORE any real chat data flows.** |
| 12 | One-time SFT-LoRA via Unsloth on the synthetic corpus. **Rent an A10 spot for ~$5 / 4 hours** instead of waiting 24-36 hrs on Iris Xe. Output: `sportsbar-base-8b.gguf` (~5GB). | Foundation model. Deploy via `Modelfile` `ADAPTER` directive into Ollama. A/B test on the 15-question grilling suite. Promote if PASS rate beats current. |

**Cost: ~$5 GPU rental, ~3 dev-days.**

### Month 2 — Nightly self-distillation

| # | Change | Effect |
|---|---|---|
| 13 | Cron: nightly job pulls yesterday's `ChatSession` rows → for each, qwen2.5:14b distills "given this question + retrieved chunks + final answer, generate 1-3 polished Q-A pairs (citation required)." Output to `SyntheticTrainingPair` table. | Accumulates KTO training data **automatically** from real operator usage. |
| 14 | Auto-promote distilled pairs into the few-shot ICL store from #9. | Continuous quality bump compounding on top of #9. |

**Cost: $0, overnight iGPU only, ~2 dev-days.**

### Month 3 — First KTO LoRA + weekly cadence

| # | Change | Effect |
|---|---|---|
| 15 | Weekly LoRA-**KTO** (NOT DPO — KTO accepts UNPAIRED thumb-up/down which matches our actual data) with **LoRA-Null** init for catastrophic-forgetting safety. Rank 16, lr 5e-6. ~2 hrs/run on Iris Xe overnight OR ~$0.60 on rented A10. | Real model improvements from real operator usage. **~$30/yr if we rent.** |
| 16 | RAG grilling suite as auto-promotion gate. Auto-rollback on regression. | Safe deployment without manual eval each week. |

**Cost: ~$30/yr GPU rental optional, ~5 dev-days total.**

**Year-1 total cost: ~$50 GPU + ~2 weeks dev spread across the quarter.**

---

## Agentic capability track — v2.51.x

Once chat reliability + retrieval quality + continual learning are in place,
make the AI Hub actually **do** things instead of just talk about them.

| # | Change | Effort | Effect |
|---|---|---|---|
| 17 | Stand up our own **MCP server** at `apps/mcp-server/` (TypeScript SDK) exposing Sports-Bar capabilities: `route_matrix`, `restart_pm2_process`, `query_atlas_drops`, `query_shure_events`, `run_diagnostic`, `read_production_db_table`, `trigger_rag_rescan`. Wire **MCPHost** bridge for Ollama. | 3-5 days | Bonus: **Claude Desktop on the operator's laptop can drive the bar over Tailscale** via the same MCP server. Every future agentic feature plugs into this. |
| 18 | **LangGraph state machine** at `services/agent-runner/` (Python sidecar) running ONE diagnose→propose→approve→execute→verify graph. SqliteSaver persists state across PM2 restarts. Self-critique node before destructive actions only. | 1 week | Persistent multi-step workflows ("diagnose Atlas drops → check audit table → cross-ref Shure events → propose fix → wait for operator approval via the bartender UI → execute → document"). |

**Skip:** CrewAI, AutoGen, smolagents — multi-agent overhead wasted at our scale.
One good agent with the MCP toolbox beats four mediocre ones.

**Cost: ~2 weeks dev. No GPU spend.**

---

## What we're NOT doing (and why)

| Item | Reason to skip |
|---|---|
| **GraphRAG** (Microsoft) | Wins on multi-hop / cross-doc themes; our queries are nearly all single-hop lookups. Cost-benefit is wrong: $50-200 indexing + 2.4× latency vs <$5. Revisit only if we add cross-location reasoning. |
| **NPU offload** | Our Raptor Lake fleet (i9-13900HK / i5-1340P) has NO NPU silicon. NPU starts at Meteor Lake (Core Ultra 1xxH). Plus IPEX-LLM NPU is Windows-only. Dead end until fleet hardware refresh. |
| **OpenVINO direct inference** | ~30% faster prefill than IPEX-LLM SYCL, but zero Ollama integration → major rewrite, lose model-swap convenience. Defer until we hit a wall IPEX-LLM can't clear. |
| **Speculative decoding** (draft model) | IPEX-LLM has self-speculative but it's Python-path only, not in the Ollama portable zip. Draft-model speculative is upstream-llama.cpp territory; Ollama hasn't merged the `--draft-model` flag. Wait for upstream. |
| **AWQ / GPTQ / EXL2 quantization** | Not in the Ollama path. Q4_K_M / Q5_K_M / Q6_K via Ollama is sufficient. |
| **DPO instead of KTO** | DPO needs paired data; we'll have far more unpaired thumbs-up/down. KTO matches our actual data shape. |
| **HyDE query rewriting** | Risky in well-specified domains — it hallucinates the answer it then retrieves on. Plain multi-query rewrite is the safer version. |
| **CrewAI / AutoGen / smolagents** | Multi-agent overhead wasted at our 1-bar-1-operator scale. LangGraph + MCP covers the value. |

---

## Sequencing

```
Week 0  (v2.50.0):  Quick wins #1-4 — 1 batch, 2 dev-days
Week 0  (v2.50.0):  RAG wins #5-7  — 1 batch, 3 dev-days
Week 1  (v2.50.1):  Continual learning #8-10 — 3 dev-days
Month 1 (v2.50.2):  Synthetic seed #11-12 — 3 dev-days + $5 GPU
Month 2 (v2.50.3):  Nightly distillation #13-14 — 2 dev-days
Month 3 (v2.51.0):  KTO weekly cadence #15-16 — 5 dev-days + $30/yr
Month 3 (v2.51.1):  MCP server #17 — 5 dev-days
Month 4 (v2.51.2):  LangGraph workflows #18 — 5 dev-days
```

**Total: ~6 weeks dev work spread across 4 months. Year-1 GPU cost ~$50.**

---

## How this doc gets used

This roadmap is **indexed into RAG** (under Standing Rule 11 — every fix → re-scan).
So the AI Hub itself can answer:
- "what's the roadmap for v2.50?"
- "are we planning to add tool calling?"
- "why aren't we using GraphRAG?"
- "when will the chat learn from my thumbs-down feedback?"

Operators get a self-documenting plan. Future Claude sessions read this before
proposing AI-Hub changes — don't re-litigate decisions already made here.

---

## Source research

Full agent reports archived under `docs/research/2026-05-18/`:
- `RAG_TECHNIQUES.md` — agent ac223 (RAG: Contextual Retrieval, hybrid, re-ranking, late chunking, parent-doc, embedding alternatives, GraphRAG)
- `AGENTIC_FRAMEWORKS.md` — agent aa0c1 (MCP, smolagents, LangGraph, Ollama-native tools, CrewAI, AutoGen, Reflexion)
- `CONTINUAL_LEARNING.md` — agent ada75 (DPO/ORPO/KTO, self-distillation, few-shot ICL, Unsloth-LoRA, Reflexion, UI signals, synthetic data)
- `IGPU_OPTIMIZATION.md` — agent a644a (IPEX-LLM newer builds, speculative decoding, batching, KV cache, quantization, embedding batch, memory residency)

Each report has citations + benchmark numbers. Cited research spans 2024-Q3 to 2026-Q2.
