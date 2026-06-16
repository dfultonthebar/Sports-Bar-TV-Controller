# T4-Day Runbook — GPU go-live on CT 212 (#358)

**Goal:** install the T4 into the Hermes/Ollama box, prove GPU inference, then flip the
already-staged software so AI Suggest, RAG answer-gen, Honcho's deriver, and Hermes'
diagnose step all run on the T4 — each step reversible, Holmgren-canaried first.

**Authored:** 2026-06-16, from live recon of `hermes`. Tracks #358 (+ unblocks #359, #364).

## Ground truth (verified 2026-06-16)

| Fact | Value | Why it matters |
|---|---|---|
| CT 212 = `hermes` | **LXC** (not a VM), Tailscale `100.70.56.34`, vmid likely **212** | GPU enable is **host-side** (driver + device bind), NOT vfio, NOT a driver install inside the container |
| Resources | 4 cores / **8 GB RAM** | Inference is on the T4's 16 GB VRAM, not LXC RAM; RAM is fine for orchestration |
| Ollama | 0.30.8, systemd unit `ollama`, binds `*:11434` (fleet/hub already reach it) | A `systemctl restart ollama` after passthrough auto-detects CUDA — no reconfig |
| Models present | `qwen2.5:14b` (9 GB), `nomic-embed-text` (274 MB, **768-dim**), `llama3.1:8b` (4.9 GB) | **No pulls needed** — deriver (≥14B) + embeddings already there |
| sudo in LXC | needs password | privileged in-container steps need the operator |
| Honcho = CT 213 | `100.90.175.125`, health 200 | deriver/embeddings target; **`sports-bar` workspace ONLY** (domain isolation) |
| Staged software (v2.68.0) | `OLLAMA_REMOTE_BASE` (default `''`), `DIAGNOSE_ENABLED` (default `false`), `diagnoseWithLLM()` stub | T4-day is an **env-flip + 2 code ships**, not new plumbing |

## VRAM budget (T4 = 16 GB) — decide residency, don't pin both

`llama3.1:8b` (~5 GB) + `qwen2.5:14b` (~10 GB) + context **won't both stay resident**.
Plan: **`llama3.1:8b` resident** (long `keep_alive`) for all fleet-realtime work (AI Suggest,
RAG, Hermes diagnose); **`qwen2.5:14b` on-demand** (short keep_alive) for Honcho's periodic
deriver. Accept a model swap when the 14B is needed. Do NOT set `keep_alive: -1` on both.
Watch with `nvidia-smi` + `ollama ps`.

---

## Phase 0 — Pre-arrival (do NOW, before the card)

- [ ] **Operator (Proxmox host):** snapshot CT 212 — `pct snapshot 212 pre-t4` (rollback anchor).
- [ ] **Operator (host):** confirm IOMMU/T4 ok — `dmesg | grep -iE 'DMAR|IOMMU'`, decide driver (T4 = Turing → `nvidia-driver-550-server`+ or datacenter `.run`).
- [x] **CPU baseline captured (2026-06-16):** `llama3.1:8b` on hermes (4c/8 GB, no GPU) = **5.25 gen tok/s** (128 tok; prompt-eval 25.3 tok/s; load 160 ms; 25.7 s total). Phase-2 GPU target ~40–60+ tok/s (≈8–12×); fleet iGPU boxes do ~14 tok/s for reference. `qwen2.5:14b` not CPU-benched (9 GB model on 8 GB RAM would swap — that's exactly what the T4 fixes).
- [x] Models pre-pulled (verified). Software staged (v2.68.0 on main).

## Phase 1 — Card + host passthrough  ⟶ **OPERATOR, root on the Proxmox HOST**

1. `pct stop 212`; power down host; seat T4 in PCIe slot; power on.
2. Host driver: install `nvidia-driver-550-server` (or run-file), reboot host, verify `nvidia-smi` **on the host** shows the T4.
3. Add passthrough to `/etc/pve/lxc/212.conf` (host device bind + cgroup allow for the nvidia char devices: `nvidia0`, `nvidiactl`, `nvidia-uvm`, `nvidia-uvm-tools`). (LXC profile, not vfio.)
4. Inside CT 212: install the **matching** userspace driver with `--no-kernel-module` (uses the host's module).
5. `pct start 212`.
- **GATE:** inside CT 212, `nvidia-smi` shows the T4. ❌ → fix passthrough before proceeding. **Rollback:** `pct rollback 212 pre-t4`.

## Phase 2 — Ollama on GPU  ⟶ **ME (after Phase 1 gate)**

- `systemctl restart ollama` on hermes; `journalctl -u ollama | grep -iE 'cuda|gpu|compute'` shows CUDA.
- Benchmark `llama3.1:8b` generate vs Phase-0 baseline; `ollama ps` + `nvidia-smi` show the model in VRAM.
- Set keep_alive strategy per the VRAM-budget box (llama3.1:8b resident; qwen2.5:14b on-demand).
- **GATE:** tok/s materially up + GPU shows the process. ❌ → Ollama may need `OLLAMA_*` GPU env or a newer build; do not flip the fleet yet.

## Phase 3 — Flip the fleet to the T4 (the staged v2.68.0 env-flip)  ⟶ **ME**

1. **Holmgren canary first:** set `OLLAMA_REMOTE_BASE=http://100.70.56.34:11434` in Holmgren `.env` → `pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js` (Gotcha #2).
2. Verify AI Suggest now routes to the T4 (latency drop); **Playwright the AI Suggest UI end-to-end** (Standing Rule: verify live, not curl).
3. **Fallback test:** stop T4 Ollama briefly → confirm local fallback still answers → restart T4.
4. Roll `OLLAMA_REMOTE_BASE` to the other 5 boxes (`.env` + `pm2 delete+start`).
- **Rollback (any box):** unset `OLLAMA_REMOTE_BASE` → `pm2 delete+start` → back to local Ollama. Fully reversible.
- **Load-shedding:** confirm ollama-client priority so diagnosis sheds first under contention; if not built, file a small follow-up.

## Phase 4 — Honcho go-live (CT 213)  ⟶ **ME (+ operator for Honcho config if needed)**

- Point Honcho **deriver → `qwen2.5:14b`** on the T4 Ollama; **embeddings → `nomic-embed-text` (768-dim)**.
- **GATE:** Honcho derives facts into the **`sports-bar`** workspace only. **NEVER** the `trading-bot` workspace (domain isolation, hard rule).

## Phase 5 — Hermes Layer 1 diagnose LLM go-live (#359)  ⟶ **ME (code, ship v2.69.0)**

- Wire the v2.68.0 `diagnoseWithLLM()` stub to `@sports-bar/ollama-client` (remote-first → T4), returning the **P0 proposal schema** from the repo survey: `{ rootCauseHypothesis, affectedComponent, proposedFix, confidence(0-1), evidence_refs[file:line/log/RAG], blastRadius, rollback }`.
- Enable `DIAGNOSE_ENABLED=true` on Holmgren (`pm2 delete+start`); verify a real error-watch TODO gets enriched with root-cause + RAG + confidence. Then roll to fleet.
- **Rollback:** `DIAGNOSE_ENABLED=false` → `pm2 delete+start`.

## Phase 6 — AI Hub chat migration (#364)  ⟶ **ME (code + live Playwright)**

- Migrate `apps/web/src/app/api/chat/route.ts` onto ollama-client (add a non-streaming `ollamaChat()` + adapt the streaming path onto `ollamaChatStream`), preserve SSE + tool_calls + qaFallback **exactly**; point at the T4.
- **GATE:** live Playwright against the AI Hub — tool calls fire, streaming renders, fallback works. This is the #1 GPU beneficiary.

## Phase 7 — Hermes kanban worker spine (#359 Layer 3)  ⟶ **NEXT, not same-day**

- Build on ruflo's `worker-daemon.ts` skeleton (file claim-queue + atomic rename-to-`.processed`/quarantine + TTL/idle self-shutdown + crash recovery + free-mem gate), **execute step gutted** → drafts a branch + Telegram for approval. Pair with the ECC `safety-guard` PreToolUse hook so **proposes-never-executes** is mechanically enforced, not prose.

---

## Invariants (every phase)
- **Holmgren canaries every fleet-wide step**; nothing rolls fleet-wide until Holmgren passes + Playwright-verified.
- **Every flip reversible**: `OLLAMA_REMOTE_BASE` unset, `DIAGNOSE_ENABLED=false`, Proxmox `pct rollback 212 pre-t4`.
- **Domain isolation:** sports-bar Honcho workspace only; nothing crosses to trading-bot.
- **proposes-never-executes** for Hermes — drafts only, operator approves, existing `auto-update.sh` applies.
- **Critical path is Phases 1–2 (operator/host, ~1–2 h).** Phases 3–6 are fast software once the GPU is proven.
