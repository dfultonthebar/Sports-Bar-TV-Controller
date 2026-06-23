# Hermes + Honcho + TV-Controller on a Tesla T4 — Architecture & Optimization Review

> **Drafted 2026-06-21 by Claude, grounded in the real deployment** (not the generic prompt
> assumptions — corrected: single Tesla T4 16GB on CT 212 shared with trading, per-venue Intel
> Iris Xe iGPUs, Hermes/Honcho live). Recommendations doc — not yet implemented. Companion to
> `docs/HARDWARE_DRIVER_SEPARATION_PLAN.md`.

## 0. The constraint that reframes everything: the T4 is *shared with the trading bot*

This is the most important fact. On CT 212 the T4 16 GB is **multi-tenant**:
- `phi4-trader` is **pinned and must never be evicted** (live trading).
- `qwen2.5:14b` runs the Honcho deriver + planning, but **off-hours only** to avoid market-hours contention.
- Current policy: `MAX_LOADED=2`, validator kept warm during market hours.

So "optimize everything for the T4" really means **optimize for a 16 GB card you only partially own.** Two corollaries:
1. **Per-venue inference does *not* run on this T4.** Each bar box has its own **Intel Iris Xe iGPU** running IPEX-LLM Ollama (AI Suggest, shift-brief, RAG). The T4/CT 212 is the **central Hermes brain + Honcho memory + heavy batch** — not the per-venue control loop. Keep it that way; it's the right split.
2. **The bar's hard reasoning already offloads to Grok-4 / Claude via Hermes** (`ask_claude_code`). The T4 should do *embeddings, the deriver, classification, and local fallback* — not be the agentic brain. That dramatically lowers its VRAM burden.

## 1. Architecture review for T4 suitability + optimizations

**Biggest fragility points (grounded in the actual system):**
- **ADB to the Fire TV Cube fleet** is the #1 reliability risk. `adb-client.ts`'s 3 s default `executeShellCommand` timeout silently truncates `uiautomator` dumps (walker passes 10 s); ADB-over-TCP daemons die, Cubes sleep, and one device (`.48`, Atmosphere) drops when its TV powers off.
- **Deep-link verification** is UI-coupled (ESPN "Watch" is DPAD-only, multiple injection paths, Scout extraction via accessibility) — it breaks when Amazon/ESPN ships a launcher update.
- **Shared-T4 contention** — covered above.
- **Observability gaps** — aggregated logging + the `HEALTH_EXCL` projector/atmosphere hack (what the driver-separation plan addresses).

**T4-specific hardware facts that should drive your config (easy to get wrong):**
- **Turing (compute 7.5) has *no BF16*.** Use **FP16** for half precision and lean on **INT8/INT4** — Turing has **INT8 tensor cores**, so quantized inference is the T4's genuine sweet spot. Never configure BF16 paths.
- **No FlashAttention-2** (needs Ampere+). Ollama/llama.cpp fall back gracefully; vLLM would use FA1/xformers — plan VRAM accordingly.
- **70 W, 16 GB GDDR6** — you'll run out of *VRAM* long before *compute*.

**Serving choice — stick with Ollama, not vLLM, on this card:**
- vLLM wants a **static, large VRAM reservation** (paged-attention pool) — that fights the trading co-tenancy and `phi4-trader`'s pin. Ollama's **dynamic load/unload + `keep_alive`** is the right model for a multi-tenant T4.
- Keep **one resident bar model** at a time. The `keep_alive=-1`-on-two-models swap-thrash already bit you (the 7.8 GB swap incident). Pick ONE resident model for all per-location AI features and let the deriver share it.
- Recommended Ollama env on CT 212: `OLLAMA_MAX_LOADED_MODELS=2` (trader + one bar model), `OLLAMA_KEEP_ALIVE=30m` (not `-1`), `OLLAMA_FLASH_ATTENTION=1` (FA1 on Turing, still helps), `OLLAMA_KV_CACHE_TYPE=q8_0` (halves KV-cache VRAM with negligible quality loss — big win on 16 GB shared).
- **CUDA/MPS:** if trading + bar inference ever need *true* concurrency (not time-slicing), enable **CUDA MPS** so two processes share the SM without serializing — but only if you measure contention; otherwise Ollama's queue is simpler and lower-maintenance.

## 2. Best models for this workload on a (shared) T4

VRAM budget: `phi4-trader` resident leaves roughly **6–9 GB** for the bar model.

| Use | Recommendation | Why on T4 |
|---|---|---|
| **Agentic tool-calling** (Hermes local fallback) | **Qwen2.5-14B-Instruct Q4_K_M** (~9 GB) if it fits alongside the trader's idle footprint; else **Qwen2.5-7B-Instruct Q4_K_M** (~5 GB) | Qwen2.5-Instruct is **non-thinking** with the most reliable tool-calling in this size class. `qwen3:4b` *thinking* mode is a trap (39-min derive, malformed output). |
| **Honcho deriver / extraction** | Qwen2.5-14B (off-hours) — already chosen | Non-thinking, good structured extraction; shares the one resident slot. |
| **Embeddings** | `nomic-embed-text` (local) | Tiny, keep resident — don't pay OpenAI 401s. |
| **Hard reasoning / planning** | **Grok-4 / Claude via Hermes** (cloud, not T4) | Don't burn T4 VRAM on what the cloud models do far better. |

On **Qwen3**: capable but **defaults to thinking mode** (slow/malformed agent output observed). If adopted, **force `/no_think`** (`enable_thinking=false`), pin a low `num_predict`, and re-verify on the RAG/tool-calling suite first. Until proven, **Qwen2.5-14B-Instruct is the safer agentic pick**, at **Q4_K_M** (VRAM headroom on a shared card beats marginal quality).

## 3. Hermes skills + Honcho memory patterns to make it adaptive

**Hermes-native skills to add** (each thin, delegating heavy reasoning to `ask_claude_code`/Grok, not the T4):
- `fleet-health` — sweep the Cube fleet over ADB, return a per-device/per-model health table. Feeds the diagnostics surface from the driver-separation plan.
- `deep-link-verify` — launch a game on a target Cube, then *verify* it reached `PlayerActivity` (the DPAD-advance trick), report pass/fail with captured `mCurrentFocus`.
- `stream-quality-watch` — periodic black-frame / audio-silence check → raise an event when a display goes bad.
- `game-launch` — "put the Packers game on the east TVs" → resolve channel/preset → route matrix → launch app → verify.

**Honcho memory patterns (where it gets smarter over time):**
- **Per-venue pattern observations:** feed the existing **`override-learn`** signal (bartender manual re-routes within 10 min of an allocation) + Atlas/Shure/SDR events into Honcho so the deriver extracts venue-specific facts.
- **Recurring-issue modeling:** when `fleet-health` logs the same Cube failing the same way, Honcho surfaces *"Cube `.48` drops nightly when its TV powers off — expected"* so it stops alarming.
- **Staff/user modeling:** model the on-shift bartender's preferences so shift-brief and AI Suggest bias toward what *that* person requests.
- **Dialectic for pre-game prep:** "what usually goes wrong on a busy game night here?" → synthesized from accumulated observations.

Gate all deriver work **off-hours** on the T4 (already done) so learning never competes with trading or game-time control.

## 4. Refactored snippets for the key fragile areas

**(a) ADB command queue with adaptive timeout, retry, and auto-reconnect** — highest-leverage reliability fix:

```typescript
// packages/firecube/src/adb-queue.ts
type AdbJob<T> = () => Promise<T>;

class AdbDeviceQueue {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private serial: string, private client: AdbClient) {}

  /** Serialize per device; never let two shell commands race the same Cube. */
  run<T>(job: AdbJob<T>, { retries = 2, timeoutMs = 5000 } = {}): Promise<T> {
    const exec = async (): Promise<T> => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.withTimeout(job(), timeoutMs);
        } catch (err) {
          if (attempt >= retries) throw err;
          await this.client.reconnect(this.serial).catch(() => {}); // dead socket → reconnect
          await sleep(300 * 2 ** attempt); // 300, 600ms backoff
        }
      }
    };
    const next = this.chain.then(exec, exec);
    this.chain = next.catch(() => {}); // a failed job must not poison the chain
    return next;
  }
  private withTimeout<T>(p: Promise<T>, ms: number) {
    return Promise.race([p, sleep(ms).then(() => { throw new Error(`ADB timeout ${ms}ms ${this.serial}`); })]) as Promise<T>;
  }
}
```
Key point: **dumps need ≥10 s, taps need ~3 s** — pass `timeoutMs` per call (the 3 s-truncation gotcha encoded as policy, not a global constant).

**(b) Per-family health/status contract** (the driver-separation plan's interface — adopt for Fire TV first):

```typescript
export interface FamilyDriver {
  family: 'firetv' | 'directv' | 'cable' | 'wolfpack' | 'atlas' | 'projector' | 'ir' | string;
  model?: string;          // "AFTR", "AZMP8"  ← model dimension
  firmware?: string;       // quirk handlers key off (family, model, firmwareRange)
  health(): Promise<{ ok: boolean; detail: string; lastSeen: number }>;
  status(): Promise<Record<string, unknown>>;
}
```
Quirk handling stays **data-driven, keyed by `(family, model, firmwareRange)`** — AFTR/PVFTV launcher-hosted Prime Video and Atlas-firmware-4.5 become registry rows, not scattered `if`s.

**(c) T4 Ollama serving config** (drop-in env on CT 212, respects the trader):
```bash
OLLAMA_MAX_LOADED_MODELS=2          # phi4-trader + one bar model
OLLAMA_KEEP_ALIVE=30m               # NOT -1 — avoids the swap-thrash incident
OLLAMA_KV_CACHE_TYPE=q8_0           # ~half the KV VRAM, negligible quality loss
OLLAMA_FLASH_ATTENTION=1            # FA1 on Turing, still a win
OLLAMA_NUM_PARALLEL=1               # serialize; no VRAM for batched concurrency here
```
Per-task `num_ctx`: deriver/extraction `4096`, planning `16384`. Don't set a global high ctx — KV cache is the scarcest VRAM.

## 5. Testing, monitoring, deployment for a live bar on the T4

- **Canary-first rollout:** Holmgren is the canary. Ship to `main` → Holmgren auto-updates → verify → fan out. Never all venues at once.
- **Playwright on every user-facing change** (standing rule): API 200s are *not* proof — drive the bartender remote in a real browser after each deploy.
- **`verify-install.sh` layers** as the deploy gate; extend with a **per-family health probe** layer once the driver-separation contract lands.
- **Self-healing already present** — Atlas drop/priority watchers, Shure RF, SDR carrier watchers, auto-update rollback tags. Add: an **ADB-fleet watcher** that auto-`reconnect`s dead Cubes and only alarms after N consecutive failures (rising-edge + cooldown — same shape as existing watchers, so it won't spam like the connection-manager logs did).
- **T4 monitoring:** scrape `nvidia-smi` (note: `ollama ps` reports `size_vram=0` even when GPU-loaded on the T4 — confirm residency with `nvidia-smi`/`intel_gpu_top`). Alert if `phi4-trader` is ever evicted (that's a trading incident).
- **Off-hours batch window** for the deriver + heavy planning — encoded so it can't collide with market hours.

## 6. Scaling + ADB security/reliability

**Scaling:**
- **Adding a second T4** is the cleanest scale: **dedicate one T4 to trading, one to the bar AI** — eliminates the contention that constrains everything above (no more off-hours-only deriver). T4s have **no NVLink**, so multi-GPU is PCIe + either `CUDA_VISIBLE_DEVICES` pinning (simplest) or vLLM tensor-parallel (only worth it for one big model you don't need).
- **Rented T4s (Vast/RunPod)** fit **bursty batch fleet tasks** (re-embedding RAG after a model bump, a full-fleet Scout extraction sweep) — keep all *control* local, ship only the batch job out, treat the rental as ephemeral (no secrets, no persistent venue data).

**ADB security/reliability in a production venue (real risk):**
- **ADB-over-TCP (5555) is unauthenticated** — anyone on the LAN can control or sideload to your Cubes. Put **all AV devices on an isolated management VLAN** and **firewall 5555 to only the controller host.** The single most important security fix.
- **Use ADB key pairing** (`adb pair` / authorized keys); **don't leave `adb tcpip` enabled** on devices the controller isn't actively managing.
- **Reliability:** Cubes sleep/drop — the `keepAwakeEnabled` window (already in `FireTVDevice`) + the reconnect-on-failure queue in §4(a) covers most of it. Treat "expected offline" devices (the `.48` Atmosphere case) as a *known state in Honcho*, not an alarm.
- **Human-in-the-loop fallback:** when `deep-link-verify` fails twice, don't silently retry forever — surface a one-tap "couldn't start the game, tap to retry / show me" card on the bartender remote (bartender-grade, no jargon).

## Net recommendation

The system is already well-architected for the split it needs (per-venue iGPU for control, central T4 for brain/memory). Highest-leverage moves:
1. The **ADB queue + reconnect** refactor (§4a).
2. **One resident Q4 model + `q8_0` KV cache** on the shared T4 (§1).
3. Route **hard reasoning to Grok-4/Claude via Hermes** instead of the T4 (§0, §2).
4. The **per-family driver/health/logging** separation (`docs/HARDWARE_DRIVER_SEPARATION_PLAN.md`).

If a second T4 is ever added, dedicating one to the bar removes the only real performance ceiling.
