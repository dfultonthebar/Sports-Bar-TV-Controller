/**
 * Shared hardware/runtime config (location-neutral)
 *
 * IMPORTANT — read this before adding fields:
 * This file is checked into shared package code and ships unchanged to every
 * location. It must NEVER contain location-specific values (per-bar IPs,
 * processor IDs, venue names, output slot ranges, etc.). Anything that
 * differs between Holmgren Way / Stoneyard / future locations belongs in
 * `apps/web/src/lib/hardware-config.ts`, which is overridden per location
 * branch, OR in the database, OR in `.env`.
 *
 * Historical bug: this file used to be a "mirror" of the app-level config
 * with Holmgren-specific defaults (atlas IP `10.11.3.246`, name "Holmgren
 * Way", wolfpack slots 37-40). The defaults silently shipped to every new
 * install via `@sports-bar/config` and were impossible to override without
 * editing package source. Anything we don't truly share lives in the app
 * file now — this file only carries fields that are identical across all
 * locations.
 *
 * What lives here:
 *   - ollama: local LLM endpoint (always localhost:11434, model name)
 *   - venue.timezone: shared default IANA tz (overridable via `.env`)
 *
 * What does NOT live here (and should NOT be added back):
 *   - atlas.processorIp / processorId — per-location, in app config
 *   - wolfpack audio output slots — per-location chassis size
 *   - api.port / baseUrl — read from `process.env.PORT` directly at the call site
 *   - venue.name — per-location, in `.env` as `LOCATION_NAME`
 *   - scheduler tuning — currently only used by app code, lives in app config
 *
 * Usage:
 *   import { HARDWARE_CONFIG } from '@sports-bar/config'
 *   const ollamaUrl = process.env.OLLAMA_BASE_URL || HARDWARE_CONFIG.ollama.baseUrl
 *   const tz = HARDWARE_CONFIG.venue.timezone
 */

export const HARDWARE_CONFIG = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
    timeout: 60000,
  },
  venue: {
    timezone: process.env.LOCATION_TIMEZONE || 'America/Chicago',
  },
} as const

export type HardwareConfig = typeof HARDWARE_CONFIG
