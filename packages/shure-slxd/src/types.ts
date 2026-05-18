/**
 * Shure SLX-D shared types.
 */

import type { ShureSlxdModel } from './config'

export interface ShureSlxdClientConfig {
  ipAddress: string
  port?: number
  /** Per-receiver model — informs channel count + which queries apply */
  model?: ShureSlxdModel
  /** Receiver identifier for log/event correlation */
  receiverId?: string
  /** Human-friendly receiver name for logs/UI */
  receiverName?: string
  connectionTimeout?: number
  /** Auto-reconnect when socket drops */
  autoReconnect?: boolean
}

/**
 * Per-channel state cache mirroring the receiver's REP-on-change stream
 * (plus the SAMPLE stream when metering is active). Populated by the
 * parser as frames arrive. Sync accessors read from here — no fresh
 * GET on every read.
 *
 * Property names match SLX-D Command Strings spec exactly so they're
 * grep-able against the Shure documentation.
 */
export interface ShureChannelState {
  channel: number              // 1-based channel number
  frequencyMhz?: number        // current TX frequency, MHz (from FREQUENCY)
  rssiDbm?: number             // most recent RSSI sample, combined (SLX-D has no per-antenna split)
  audioPeakDbfs?: number       // peak audio level, from SAMPLE
  audioRmsDbfs?: number        // rms audio level, from SAMPLE
  audioGainDb?: number         // receiver-side audio gain (from AUDIO_GAIN, offset -18)
  audioOutSwitch?: 'MIC' | 'LINE' | string  // physical rear switch, from AUDIO_OUT_LVL_SWITCH (read-only)
  txType?: string              // 'SLXD1' (bodypack) | 'SLXD2' (handheld) | 'UNKNOWN' (TX off)
  txBattBars?: number          // 0-5, 255 = unknown
  txBattRuntimeMin?: number    // minutes, lithium TX only; 65535/65534/65533 sentinels
  channelName?: string         // operator-set 31-char label (from CHAN_NAME, braces stripped)
  groupChannel?: string        // group + channel pair, e.g. '6,6' or '--,--' (manual freq)
  lockStatus?: 'OFF' | 'MENU' | 'ALL' | string  // front-panel lock state
  lastSampleAt?: number        // unix sec of most recent SAMPLE
  lastRepAt?: number           // unix sec of most recent REP
}

/**
 * Receiver-scope state (channel = 0). Tracks properties that aren't
 * per-channel — model, firmware, RF band, etc.
 */
export interface ShureReceiverState {
  model?: string               // 'SLXD4' | 'SLXD4D' etc.
  deviceId?: string            // user-set name from DEVICE_ID
  rfBand?: string              // 'G58' | 'H55' | 'J52' etc.
  firmwareVersion?: string     // from FW_VER
  lockStatus?: 'OFF' | 'MENU' | 'ALL' | string
}

/**
 * Parsed frame from the receiver.
 */
export interface ShureFrame {
  verb: 'REP' | 'SAMPLE' | string
  channel: number              // 0 if global, 1+ otherwise
  property: string             // e.g. 'RSSI', 'FREQUENCY', 'TX_TYPE', 'ALL'
  /** Token list AFTER the property — for braced strings the curly
   *  braces are stripped and the string content is joined into a
   *  single element. For numeric/enum values each token stays
   *  separate. */
  values: string[]
  raw: string                  // the full original message for debugging
}

/**
 * Public events emitted by ShureSlxdClient.
 */
export interface ShureClientEvents {
  connected: () => void
  disconnected: () => void
  error: (err: Error) => void
  /** Any frame, useful for raw debugging / passthrough logging */
  frame: (frame: ShureFrame) => void
  /** Channel state cache updated (post-merge of a REP/SAMPLE) */
  stateChange: (channel: number, state: ShureChannelState) => void
  /** Receiver-scope state updated */
  receiverChange: (state: ShureReceiverState) => void
}
