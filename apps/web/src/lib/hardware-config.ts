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
