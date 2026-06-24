/**
 * Centralized Hardware Configuration
 * Single source of truth for all device IPs, ports, and processor IDs.
 * Update this file when hardware changes — no more hunting through 15+ files.
 */

export const HARDWARE_CONFIG = {
  // Per-location atlas + wolfpack values are kept on the location branch.
  // Main ships generic empty defaults so a new location's first deploy
  // doesn't accidentally inherit Stoneyard's processor IP / Holmgren's
  // wolfpack slot layout. Each location overrides on its own branch.
  atlas: {
    processorIp: '',
    processorId: '',
    tcpPort: 5321,
    httpPort: 80,
  },
  wolfpack: {
    audioOutputStart: 0,
    audioOutputCount: 0,
    audioOutputSlots: [],
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
    baseUrl: `http://127.0.0.1:${process.env.PORT || 3001}`,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    // v2.32.65 — model is now env-overridable. Default is llama3.1:8b.
    //
    // History: v2.32.64 attempted qwen2.5:14b as the default for better
    // reasoning, but the IPEX-LLM Ollama 0.16.2 SYCL backend at Holmgren
    // didn't accelerate the qwen2 family (model loaded but render engine
    // stayed at 0%; AI Suggest ran on CPU at ~300s). qwen2 SYCL kernels
    // weren't backported to the IPEX-LLM fork. Locations on CPU-only
    // boxes (graystone) also can't run 14b at usable speeds.
    //
    // Locations that have a working qwen-on-SYCL path (or accept slower
    // CPU inference) can override via .env: OLLAMA_MODEL=qwen2.5:14b.
    // Operators on the Iris Xe path should keep llama3.1:8b until the
    // IPEX-LLM stack supports newer model families.
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    // v2.55.56 — timeout + output-token ceiling are now per-box env-tunable.
    // Generation time ≈ num_predict / tok_s. Box iGPU throughput varies
    // (Holmgren ~11 tok/s, Graystone ~6.7), so the default 2048-token cap is
    // ~183s on a fast box but ~306s on Graystone — over the 300s timeout. A
    // slow box sets OLLAMA_TIMEOUT_MS higher and/or OLLAMA_NUM_PREDICT lower.
    // [LLM-PERF] logs (llm-perf-YYYY-MM-DD.log) capture real eval_count +
    // done_reason so these get set from data, not guesses.
    timeout: Number(process.env.OLLAMA_TIMEOUT_MS) || 300000,
    numPredict: Number(process.env.OLLAMA_NUM_PREDICT) || 2048,
    // v2.82.31 — keep the sports-bar model pinned resident so AI Suggest et al never
    // pay the ~30s cold-load (operator: "it should always be warm"). Default -1 = pin
    // forever; a RAM-tight box can set OLLAMA_KEEP_ALIVE='20m' (duration string) instead.
    // Forwarded as `keep_alive` on every ollamaGenerate call + by the startup warmer.
    keepAlive: ((v) => (v === undefined || v === '' ? -1 : /^-?\d+$/.test(v) ? Number(v) : v))(process.env.OLLAMA_KEEP_ALIVE),
  },
  venue: {
    timezone: 'America/Chicago',
    // v2.28.5 — read per-location LOCATION_NAME from .env instead of hardcoding
    // a single bar name into the shared codebase. Every location already has
    // LOCATION_NAME populated via ecosystem.config.js, so the shift brief
    // (and any other venue-name consumer) now renders the correct site.
    // Generic fallback if the env is somehow missing — never show another
    // location's name to the wrong bar.
    name: process.env.LOCATION_NAME || 'Sports Bar',
  },
  scheduler: {
    earlyBufferSeconds: 300,
    maxDelaySeconds: 1800,
    checkIntervalMs: 60000,
    fastPollIntervalMs: 15000,
    tvStatusPollMs: 300000,
  },
} as const

export type HardwareConfig = typeof HARDWARE_CONFIG
