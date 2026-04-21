/**
 * Centralized Hardware Configuration
 * Single source of truth for all device IPs, ports, and processor IDs.
 * Update this file when hardware changes — no more hunting through 15+ files.
 */

export const HARDWARE_CONFIG = {
  atlas: {
    processorIp: '10.40.10.102',
    processorId: 'atlas-stoneyard',
    tcpPort: 5321,
    httpPort: 80,
  },
  wolfpack: {
    audioOutputStart: 33,
    audioOutputCount: 4,
    audioOutputSlots: [33, 34, 35, 36],
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
    baseUrl: `http://127.0.0.1:${process.env.PORT || 3001}`,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1:8b',
    timeout: 180000,
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
