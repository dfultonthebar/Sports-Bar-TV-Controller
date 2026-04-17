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
    model: 'llama3.1:8b',
    timeout: 180000,
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
