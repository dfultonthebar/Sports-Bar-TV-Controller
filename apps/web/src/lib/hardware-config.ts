/**
 * Centralized Hardware Configuration
 * Single source of truth for all device IPs, ports, and processor IDs.
 * Update this file when hardware changes — no more hunting through 15+ files.
 */

export const HARDWARE_CONFIG = {
  atlas: {
    processorIp: '10.11.3.246',
    processorId: '3641dcba-98b8-4f7c-b0ae-d4c7dbecaed9',
    tcpPort: 5321,
    httpPort: 80,
  },
  wolfpack: {
    audioOutputStart: 37,
    audioOutputCount: 4,
    audioOutputSlots: [37, 38, 39, 40],
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
    baseUrl: `http://127.0.0.1:${process.env.PORT || 3001}`,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2:3b',
    timeout: 60000,
  },
  venue: {
    timezone: 'America/Chicago',
    name: 'Holmgren Way',
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
