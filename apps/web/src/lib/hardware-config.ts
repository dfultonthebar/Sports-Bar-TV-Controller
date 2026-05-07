/**
 * Centralized Hardware Configuration
 * Single source of truth for all device IPs, ports, and processor IDs.
 * Update this file when hardware changes — no more hunting through 15+ files.
 */

export const HARDWARE_CONFIG = {
  atlas: {
    processorIp: '',
    processorId: '',
    tcpPort: 5321,
    httpPort: 80,
  },
  wolfpack: {
    audioOutputStart: 0,
    audioOutputCount: 0,
    audioOutputSlots: [] as number[],
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
    timeout: 300000,
  },
  venue: {
    timezone: 'America/Chicago',
    name: 'Leg Lamp',
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
