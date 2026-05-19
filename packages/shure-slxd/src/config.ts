/**
 * Shure SLX-D Configuration
 *
 * Protocol constants for the SLX-D wireless mic receiver family
 * (SLXD4, SLXD4D, SLXD24/SM58, SLXD24/B87A, SLXD14, etc.). Same
 * `< VERB CHAN PROP VAL >` framing applies across the family —
 * model-specific differences are channel count and band, not
 * protocol.
 *
 * Primary references:
 * - Shure SLX-D Command Strings (canonical): https://pubs.shure.com/command-strings/SLXD/en-US
 * - PDF mirror: https://shop.ccisolutions.com/StoreFront/jsp/pdf/SHU-SLXD_commandStrings.pdf
 * - Production reference impl (MIT-licensed, used in live shows worldwide):
 *   https://github.com/bitfocus/companion-module-shure-wireless
 *
 * Front-panel gate: `Menu → Advanced → Network → Allow Third-Party
 * Controls → Enable` MUST be on or port 2202 accepts the connection
 * but silently drops every command. Defaults to BLOCKED on new
 * receivers and sometimes resets to BLOCKED after a firmware update.
 */

export const SHURE_NETWORK_CONFIG = {
  TCP_PORT: 2202,
  CONNECTION_TIMEOUT_MS: 5_000,
  COMMAND_TIMEOUT_MS: 3_000,
  /** Receiver-side idle timeout is not documented; treat 30s as the
   *  conservative ping interval (matches Bitfocus reference impl). */
  HEARTBEAT_INTERVAL_MS: 30_000,
  HEARTBEAT_TIMEOUT_MS: 60_000,
  RECONNECT_DELAY_MS: 2_000,
  MAX_RECONNECT_ATTEMPTS: 10,
} as const

export const SHURE_PROTOCOL = {
  // Frame delimiters. SLX-D Command Strings spec: each message is
  // `< VERB CHAN PROP VAL... >` — literal `< ` (less-than + space) at
  // the start, ` >` (space + greater-than) at the end, single space
  // between tokens.
  FRAME_OPEN: '< ',
  FRAME_CLOSE: ' >',
  FRAME_START_CHAR: '<',
  FRAME_END_CHAR: '>',
  TOKEN_SEP: ' ',
  // String values that may contain spaces are wrapped in {…} curly
  // braces (CHAN_NAME, DEVICE_ID, FW_VER, GROUP_CHAN). The parser
  // strips them.
  STRING_OPEN: '{',
  STRING_CLOSE: '}',

  // Channel scope. 0 = all channels (SLXD24D both, SLXD4 the single
  // channel). 1, 2 = individual channels on SLXD24D / SLXD4D.
  CHANNEL_ALL: 0,

  VERB: {
    GET: 'GET',
    SET: 'SET',
    REPORT: 'REP',
    SAMPLE: 'SAMPLE',
  } as const,

  /** METER_RATE units: milliseconds. Range 50-60000 (per Bitfocus
   *  HELP.md). 0 disables. Aggressively low values (<500ms) can lock
   *  the receiver's web UI. Recommended baseline 5000 ms. */
  METER_RATE_MIN_MS: 50,
  METER_RATE_MAX_MS: 60_000,
  METER_RATE_DEFAULT_MS: 5_000,
  METER_RATE_DISABLED: '0',
} as const

/**
 * Known SLX-D model channel counts. Used to bound channel iteration.
 */
export const SHURE_SLXD_MODELS = {
  SLXD4: { channels: 1, label: 'SLXD4 (single rx)' },
  SLXD4D: { channels: 2, label: 'SLXD4D (dual rx)' },
  SLXD24: { channels: 1, label: 'SLXD24 (handheld combo)' },
  SLXD24D: { channels: 2, label: 'SLXD24D (dual handheld combo)' },
  SLXD14: { channels: 1, label: 'SLXD14 (bodypack combo)' },
  SLXD14D: { channels: 2, label: 'SLXD14D (dual bodypack combo)' },
} as const

export type ShureSlxdModel = keyof typeof SHURE_SLXD_MODELS

/**
 * RSSI raw-to-dBm conversion. SLX-D reports RSSI inside SAMPLE
 * messages only, range 0-120 (raw) mapping to -120 to 0 dBm.
 * Formula: dBm = raw - 120. So raw 037 = -83 dBm.
 *
 * Note: SLX-D RSSI is COMBINED (not per-antenna A/B). The receiver
 * does the diversity switching internally and reports the best.
 * Per-antenna RSSI exists on ULX-D/QLX-D/AD but NOT SLX-D.
 */
export function rssiRawToDbm(raw: number): number {
  return raw - 120
}

/**
 * FREQUENCY raw-to-MHz conversion. SLX-D reports FREQUENCY as a
 * 6-digit value in kHz: e.g. 537125 → 537.125 MHz. Always 6 digits
 * for the US bands (G58 470-514, H55 514-558, J52 558-602 MHz).
 */
export function frequencyRawToMhz(raw: number): number {
  return raw / 1_000
}

export function frequencyMhzToRaw(mhz: number): number {
  return Math.round(mhz * 1_000)
}

/**
 * Interference-detection thresholds informed by Shure best-practices
 * and RF coordination convention (RF Venue + Shure troubleshooting
 * docs). RSSI is dBm.
 *
 * The "classic ghost-carrier-from-somebody-else" signature:
 *   TX_TYPE == 'UNKNOWN' (no decoded pilot — our TX absent)
 *   AND RSSI >= -85 dBm (someone else is louder than the noise floor
 *     on our frequency)
 *
 * Above -90 dBm with no TX is suspicious; -85 to -70 dBm with no TX
 * is the textbook co-channel interference signature.
 *
 * Hysteresis prevents flapping on brief peaks. Tunable per location
 * later if needed.
 */
export const INTERFERENCE_THRESHOLDS = {
  ACTIVATE_RSSI_DBM: -85,
  DEACTIVATE_RSSI_DBM: -95,
  ABOVE_SAMPLES_TO_ACTIVATE: 3,
  BELOW_SAMPLES_TO_DEACTIVATE: 3,
} as const

/**
 * TX_BATT_MINS sentinel values (from Bitfocus ref impl).
 * 65535 = unknown (alkaline TX, not lithium)
 * 65534 = calculating (~2 min after TX power-on)
 * 65533 = comm error between TX and battery
 */
export const TX_BATT_MINS_SENTINEL = {
  UNKNOWN: 65535,
  CALCULATING: 65534,
  COMM_ERROR: 65533,
} as const
