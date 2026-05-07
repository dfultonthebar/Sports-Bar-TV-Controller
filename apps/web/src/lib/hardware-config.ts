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
    // v2.32.64 — bumped from llama3.1:8b → qwen2.5:14b for better
    // structured-reasoning quality on AI Suggest. ~2x latency on the
    // Iris Xe iGPU stack (~14 tok/s → ~7 tok/s) — AI Suggest goes from
    // ~100s to ~200s end-to-end, still inside the 300s Nginx
    // proxy_read_timeout. Bartenders trade some wait for noticeably
    // better game-allocation suggestions. Switch back to llama3.1:8b
    // here if a location's iGPU can't keep up. install.sh + ollama-setup.sh
    // pull both models so the swap is always possible.
    model: 'qwen2.5:14b',
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
