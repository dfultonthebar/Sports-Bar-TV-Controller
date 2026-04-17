/**
 * Centralized Hardware Configuration — PER LOCATION
 *
 * This file is per-location; values below describe the PHYSICAL hardware at
 * THIS deployment, not any other. Merges from main must NOT overwrite this
 * file — it is listed in LOCATION_PATHS_OURS in scripts/auto-update.sh so
 * `git checkout --ours` is used on every merge.
 *
 * If you're reading this on a location branch and the values look wrong
 * (e.g., an Atlas IP on a dbx-only site), update them here. Audio and
 * matrix code now reads device details from the database (AudioProcessor /
 * MatrixConfiguration tables), so a slightly-stale value here only affects
 * `venue.name` / `venue.timezone` and a few code paths that still read the
 * module-level constants. The long-term plan is to drain these into DB
 * lookups keyed by LOCATION_ID and leave this file with nothing but
 * envvar-driven generic config (same pattern as packages/config/).
 *
 * When onboarding a new location, copy this file template from main and
 * replace the values before the first auto-update.
 */

export const HARDWARE_CONFIG = {
  atlas: {
    // Lucky's 1313 uses dbx ZonePRO (not Atlas). Values below are unused at
    // runtime — audio control reads from the AudioProcessor DB table — but
    // kept to satisfy any legacy importers. dbx info lives in the DB
    // (ipAddress=192.168.10.50, processorType='dbx-zonepro').
    processorIp: '',
    processorId: '',
    tcpPort: 5321,
    httpPort: 80,
  },
  wolfpack: {
    // Lucky's has a single-card WP-36X36; audio routes through dbx, not
    // Wolf Pack outputs, so there are NO audio output slots on the matrix.
    // See CLAUDE.md §5a for per-location matrix config rules.
    audioOutputStart: 0,
    audioOutputCount: 0,
    audioOutputSlots: [] as number[],
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
    baseUrl: `http://127.0.0.1:${process.env.PORT || 3001}`,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    timeout: 180000,
  },
  venue: {
    timezone: process.env.LOCATION_TIMEZONE || 'America/Chicago',
    name: process.env.LOCATION_NAME || "Lucky's 1313",
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
