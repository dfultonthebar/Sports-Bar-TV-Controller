/**
 * Shure SLX-D TCP Client
 *
 * Persistent TCP socket to a single SLX-D receiver. Implements Shure's
 * ASCII `< VERB CHAN PROP VAL >` line protocol on port 2202.
 *
 * Design choices, with the corresponding QLX-D Python reference holes
 * closed (see packages/shure-slxd/README.md "References"):
 *
 * - Frame accumulator (the QLX-D ref split recv() naively and silently
 *   corrupted on coalesced/partial frames; we scan for `<`/`>` and
 *   only dispatch complete frames)
 * - Curly-brace string handling — CHAN_NAME, DEVICE_ID, FW_VER and
 *   GROUP_CHAN wrap their value in `{…}`. The parser must extract the
 *   braced span as one logical token, otherwise spaces inside names
 *   break naïve whitespace splitting (the Python ref hacked around
 *   this with a magic byte slice — we do it properly)
 * - Exponential-backoff reconnect with cap (the ref had none)
 * - SO_KEEPALIVE on the socket so half-open TCPs surface quickly
 * - 30s heartbeat via `GET 1 METER_RATE` with 60s deadline — matches
 *   the Bitfocus production module, which is the only public SLX-D
 *   implementation that's been battle-tested in live shows
 * - intentionalDisconnect flag so close-handler doesn't loop into
 *   reconnect (same lesson as Atlas v2.33.51)
 *
 * RSSI on SLX-D is COMBINED (one value), SAMPLE-only. There is no
 * per-antenna A/B split, and there's no per-property `< REP x RSSI ... >`
 * push — RSSI arrives only inside SAMPLE messages. ULX/QLX/AD differ
 * in this regard; don't carry their patterns over.
 *
 * The receiver SILENTLY DROPS malformed/unknown/out-of-range commands —
 * no ERR/NAK frame exists in the protocol. Validate post-SET via the
 * matching REP echo if you need certainty.
 */

import { Socket } from 'net'
import { EventEmitter } from 'events'
import { logger } from '@sports-bar/logger'
import {
  SHURE_NETWORK_CONFIG,
  SHURE_PROTOCOL,
  frequencyMhzToRaw,
  rssiRawToDbm,
  frequencyRawToMhz,
} from './config'
import type {
  ShureSlxdClientConfig,
  ShureFrame,
  ShureChannelState,
  ShureReceiverState,
  ShureClientEvents,
} from './types'

// Watchdog: if SAMPLE subscription active but no frame in this window,
// reconnect. Set comfortably above our heartbeat period.
const SILENT_RECEIVER_WATCHDOG_MS = 90_000

export class ShureSlxdClient extends EventEmitter {
  private config: Required<Omit<ShureSlxdClientConfig, 'model' | 'receiverName'>>
  private socket: Socket | null = null
  private connected = false
  private intentionalDisconnect = false
  private rxBuffer = ''
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private watchdogTimer: NodeJS.Timeout | null = null
  private lastFrameAt = 0
  private meterRateMs = 0 // 0 = not subscribed
  private state: Map<number, ShureChannelState> = new Map()
  private receiverState: ShureReceiverState = {}
  public readonly receiverName: string

  constructor(config: ShureSlxdClientConfig) {
    super()
    this.config = {
      ipAddress: config.ipAddress,
      port: config.port ?? SHURE_NETWORK_CONFIG.TCP_PORT,
      receiverId: config.receiverId ?? config.ipAddress,
      connectionTimeout: config.connectionTimeout ?? SHURE_NETWORK_CONFIG.CONNECTION_TIMEOUT_MS,
      autoReconnect: config.autoReconnect ?? true,
    }
    this.receiverName = config.receiverName ?? config.ipAddress
  }

  /**
   * Open the TCP socket. Resolves once `connect` fires or rejects on
   * timeout/error. Side effects: emits 'connected', seeds state cache
   * via `< GET 0 ALL >`, and starts the 30s heartbeat.
   */
  async connect(): Promise<void> {
    if (this.connected && this.socket && !this.socket.destroyed) return
    this.intentionalDisconnect = false
    return new Promise((resolve, reject) => {
      const sock = new Socket()
      sock.setKeepAlive(true, 10_000)
      sock.setNoDelay(true)

      // Promise must settle exactly once — guards against the close
      // handler calling reject() after we already resolved on a
      // successful connect, or vice versa. Without this, an unexpected
      // disconnect with autoReconnect=false would silently swallow
      // the rejection because Node ignores second-settle on a Promise.
      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      const onConnectTimer = setTimeout(() => {
        sock.destroy()
        settle(() => reject(new Error(`Shure SLX-D ${this.config.ipAddress}:${this.config.port} connect timeout`)))
      }, this.config.connectionTimeout)

      sock.once('connect', () => {
        clearTimeout(onConnectTimer)
        this.socket = sock
        this.connected = true
        this.reconnectAttempts = 0
        this.lastFrameAt = Date.now()
        logger.info(`[SHURE-SLXD] Connected to ${this.receiverName} (${this.config.ipAddress}:${this.config.port})`)
        this.emit('connected')
        // Seed cache. REP-on-change is opportunistic, not historical,
        // so always replay state at connect time.
        this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET 0 ALL${SHURE_PROTOCOL.FRAME_CLOSE}`)
        // GET 0 ALL covers channel-scope properties. Device-scope
        // (FW_VER, MODEL, RF_BAND, DEVICE_ID) needs explicit GETs
        // WITHOUT a channel field — `< GET 0 FW_VER >` returns
        // `< REP ERR >` on SLXD4D firmware 1.4.7.0. Without this the
        // receiver state's model/firmwareVersion/rfBand stay
        // undefined, breaks preflight detection + the admin tile's
        // "fw / band" subtitle.
        this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET FW_VER${SHURE_PROTOCOL.FRAME_CLOSE}`)
        this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET MODEL${SHURE_PROTOCOL.FRAME_CLOSE}`)
        this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET RF_BAND${SHURE_PROTOCOL.FRAME_CLOSE}`)
        this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET DEVICE_ID${SHURE_PROTOCOL.FRAME_CLOSE}`)
        this.startHeartbeat()
        if (this.meterRateMs > 0) {
          // Re-issue subscription — METER_RATE does NOT survive reconnect.
          setTimeout(() => this.startMetering(this.meterRateMs).catch(() => {}), 200)
        }
        settle(() => resolve())
      })

      sock.on('data', (chunk: Buffer) => this.onData(chunk))

      sock.on('error', (err: Error) => {
        clearTimeout(onConnectTimer)
        logger.warn(`[SHURE-SLXD] Socket error for ${this.receiverName}: ${err.message}`)
        this.emit('error', err)
        // 'close' will fire next; reconnect logic lives there.
      })

      sock.on('close', () => {
        if (this.socket === sock) this.socket = null
        const wasConnected = this.connected
        this.connected = false
        this.clearHeartbeat()
        this.clearWatchdog()
        if (wasConnected) {
          logger.info(`[SHURE-SLXD] Disconnected from ${this.receiverName}`)
          this.emit('disconnected')
        }
        if (this.intentionalDisconnect) {
          this.intentionalDisconnect = false
          return
        }
        if (this.config.autoReconnect) {
          this.scheduleReconnect()
        } else {
          settle(() => reject(new Error(`Shure SLX-D ${this.config.ipAddress} closed before connect`)))
        }
      })

      sock.connect(this.config.port, this.config.ipAddress)
    })
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    this.clearReconnect()
    this.clearHeartbeat()
    this.clearWatchdog()
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected && !!this.socket && !this.socket.destroyed
  }

  /**
   * Subscribe to SAMPLE pushes. `rateMs` is the per-channel cadence
   * (50-60000 ms; 0 disables). On SLXD24D you get one SAMPLE per
   * channel per tick.
   *
   * Bitfocus reference recommends ≥5000 ms baseline because very low
   * rates can lock the receiver's web UI. Use the default unless you
   * specifically need faster RF interference detection.
   */
  async startMetering(rateMs: number = SHURE_PROTOCOL.METER_RATE_DEFAULT_MS): Promise<void> {
    const clamped = Math.max(
      SHURE_PROTOCOL.METER_RATE_MIN_MS,
      Math.min(SHURE_PROTOCOL.METER_RATE_MAX_MS, Math.round(rateMs)),
    )
    this.meterRateMs = clamped
    // Channel 0 = all channels. SLXD24D applies it independently to
    // both ch 1 and ch 2.
    this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}SET 0 METER_RATE ${clamped}${SHURE_PROTOCOL.FRAME_CLOSE}`)
    this.armWatchdog()
  }

  async stopMetering(): Promise<void> {
    this.meterRateMs = 0
    this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}SET 0 METER_RATE ${SHURE_PROTOCOL.METER_RATE_DISABLED}${SHURE_PROTOCOL.FRAME_CLOSE}`)
    this.clearWatchdog()
  }

  /**
   * Set the receiver's TX frequency for a channel. MHz in; converted to
   * the spec's 6-digit kHz format.
   *
   * Gotcha: SET FREQUENCY also blanks GROUP_CHAN to `--,--` (front
   * panel displays "Manual" until the operator picks a group again).
   * Also produces an immediate audio click on the channel.
   */
  async setFrequencyMhz(channel: number, mhz: number): Promise<void> {
    const raw = frequencyMhzToRaw(mhz)
    this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}SET ${channel} FREQUENCY ${raw}${SHURE_PROTOCOL.FRAME_CLOSE}`)
  }

  /** Flash the receiver's front-panel LEDs for visual ID (~30s auto-off). */
  async flash(): Promise<void> {
    this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}SET 0 FLASH ON${SHURE_PROTOCOL.FRAME_CLOSE}`)
  }

  /** Get cached state for a channel (1-based). Undefined if no frame yet. */
  getChannelState(channel: number): ShureChannelState | undefined {
    return this.state.get(channel)
  }

  getAllChannelStates(): Map<number, ShureChannelState> {
    return new Map(this.state)
  }

  getReceiverState(): ShureReceiverState {
    return { ...this.receiverState }
  }

  // ---------- internals ----------

  private sendRaw(line: string): void {
    if (!this.socket || this.socket.destroyed) {
      logger.debug(`[SHURE-SLXD] sendRaw dropped (socket closed): ${line}`)
      return
    }
    this.socket.write(line + '\r\n')
  }

  /**
   * Accumulate incoming bytes and dispatch each complete `< ... >`
   * frame. Receiver may coalesce multiple frames per packet, or split
   * one across packets — handle both. Also tolerate `\r\n` /
   * whitespace between frames.
   */
  private onData(chunk: Buffer): void {
    this.rxBuffer += chunk.toString('ascii')
    let start = this.rxBuffer.indexOf(SHURE_PROTOCOL.FRAME_START_CHAR)
    while (start !== -1) {
      const end = this.rxBuffer.indexOf(SHURE_PROTOCOL.FRAME_END_CHAR, start + 1)
      if (end === -1) {
        // Incomplete tail — keep from `start` onward.
        this.rxBuffer = this.rxBuffer.slice(start)
        return
      }
      const raw = this.rxBuffer.slice(start, end + 1)
      this.rxBuffer = this.rxBuffer.slice(end + 1)
      this.handleFrame(raw)
      start = this.rxBuffer.indexOf(SHURE_PROTOCOL.FRAME_START_CHAR)
    }
  }

  private handleFrame(raw: string): void {
    this.lastFrameAt = Date.now()
    const frame = this.parseFrame(raw)
    if (!frame) return
    this.emit('frame', frame)

    if (frame.verb === 'REP') {
      this.applyRep(frame)
    } else if (frame.verb === 'SAMPLE') {
      this.applySample(frame)
    }
  }

  /**
   * Parse `< VERB CHAN PROP VAL... >` into structured form. Handles
   * braced string values: `< REP 0 FW_VER {2.1.5} >` produces values
   * `['2.1.5']`; `< REP 1 CHAN_NAME {Lead Vocal} >` produces
   * `['Lead Vocal']`. For non-braced values, ordinary whitespace
   * splitting applies.
   */
  private parseFrame(raw: string): ShureFrame | null {
    const inner = raw.replace(/^</, '').replace(/>$/, '').trim()
    if (!inner) return null

    // Pull out a single braced span if present (per spec there's at
    // most one per frame — it's always the value field).
    let working = inner
    let bracedValue: string | null = null
    const openIdx = working.indexOf(SHURE_PROTOCOL.STRING_OPEN)
    if (openIdx !== -1) {
      const closeIdx = working.indexOf(SHURE_PROTOCOL.STRING_CLOSE, openIdx + 1)
      if (closeIdx !== -1) {
        bracedValue = working.slice(openIdx + 1, closeIdx)
        working = (working.slice(0, openIdx) + working.slice(closeIdx + 1)).trim()
      }
    }

    const tokens = working.split(/\s+/).filter((t) => t.length > 0)
    if (tokens.length < 2) return null
    // Two REP shapes seen on real SLXD4D firmware 1.4.7.0 at Holmgren:
    //   Channel-scope: < REP <chan> <PROP> [value...] >   (3+ tokens)
    //   Device-scope:  < REP <PROP> {value} >             (2 tokens)
    // Older code required 3 tokens and silently dropped device-scope REPs,
    // which is why FW_VER, MODEL, RF_BAND, DEVICE_ID never populated the
    // receiver state on real hardware. Disambiguate by trying to parse
    // the second token as a channel number — if it's numeric, channel-scope;
    // otherwise device-scope (channel=0).
    const [verb, secondToken, ...rest] = tokens
    const chanMaybe = parseInt(secondToken, 10)
    let channel: number
    let property: string
    let values: string[]
    if (Number.isFinite(chanMaybe) && String(chanMaybe) === secondToken && rest.length >= 1) {
      channel = chanMaybe
      property = rest[0]
      values = rest.slice(1)
    } else {
      channel = 0
      property = secondToken
      values = rest
    }
    if (bracedValue !== null) values.push(bracedValue)
    return { verb, channel, property, values, raw }
  }

  /**
   * Merge a `< REP chan PROP val >` frame into the appropriate state
   * cache. Emits 'stateChange'/'receiverChange' iff something actually
   * changed (deduping REP echoes of our own SETs).
   */
  private applyRep(frame: ShureFrame): void {
    // Receiver-scope (channel 0) properties first.
    if (frame.channel === 0) {
      const prev = { ...this.receiverState }
      const next: ShureReceiverState = { ...prev }
      let changed = false

      const setStr = (key: keyof ShureReceiverState, s: string | undefined) => {
        if (s === undefined) return
        // Trim the trailing-space padding Shure applies to braced
        // string values (FW_VER "1.4.7.0 ", MODEL "SLXD4D ", etc).
        const trimmed = s.trim()
        if (prev[key] !== trimmed) {
          (next as any)[key] = trimmed
          changed = true
        }
      }

      switch (frame.property) {
        case 'MODEL':    setStr('model', frame.values.join(' ')); break
        case 'DEVICE_ID': setStr('deviceId', frame.values.join(' ')); break
        case 'RF_BAND': setStr('rfBand', frame.values.join(' ')); break
        case 'FW_VER':  setStr('firmwareVersion', frame.values.join(' ')); break
        case 'LOCK_STATUS': setStr('lockStatus', frame.values.join(' ')); break
        default:
          // Some properties (CHAN_NAME, FREQUENCY, METER_RATE, …) come
          // back with channel=0 in response to a `< GET 0 ALL >` seed
          // — for those, fan out to BOTH channels in the per-channel
          // handler below.
          this.applyRepToChannels(frame, [1, 2])
          return
      }
      if (changed) {
        this.receiverState = next
        this.emit('receiverChange', next)
      }
      return
    }

    this.applyRepToChannels(frame, [frame.channel])
  }

  private applyRepToChannels(frame: ShureFrame, channels: number[]): void {
    for (const ch of channels) {
      const prev = this.state.get(ch) ?? { channel: ch }
      const next: ShureChannelState = { ...prev, lastRepAt: Math.floor(Date.now() / 1000) }
      let changed = false

      const setNum = (key: keyof ShureChannelState, n: number | undefined) => {
        if (n === undefined || Number.isNaN(n)) return
        if (prev[key] !== n) {
          (next as any)[key] = n
          changed = true
        }
      }
      const setStr = (key: keyof ShureChannelState, s: string | undefined) => {
        if (s === undefined) return
        // Shure firmware pads braced string values (CHAN_NAME, GROUP_CHAN,
        // FW_VER, etc.) to a fixed width with trailing spaces — e.g.
        // CHAN_NAME comes through as "Shure1                         ".
        // Trim once at the storage layer so every downstream consumer
        // (snapshot, UI tile, log line) gets the operator-meaningful
        // value without each having to .trim() defensively.
        const trimmed = s.trim()
        if (prev[key] !== trimmed) {
          (next as any)[key] = trimmed
          changed = true
        }
      }

      switch (frame.property) {
        case 'FREQUENCY': {
          const raw = parseInt(frame.values[0], 10)
          if (Number.isFinite(raw)) setNum('frequencyMhz', frequencyRawToMhz(raw))
          break
        }
        case 'AUDIO_GAIN': {
          const raw = parseInt(frame.values[0], 10)
          if (Number.isFinite(raw)) setNum('audioGainDb', raw - 18)
          break
        }
        case 'AUDIO_OUT_LVL_SWITCH': {
          setStr('audioOutSwitch', frame.values.join(' '))
          break
        }
        case 'TX_TYPE': {
          setStr('txType', frame.values.join(' '))
          break
        }
        case 'TX_BATT_BARS': {
          const raw = parseInt(frame.values[0], 10)
          if (Number.isFinite(raw)) setNum('txBattBars', raw)
          break
        }
        case 'TX_BATT_MINS': {
          const raw = parseInt(frame.values[0], 10)
          if (Number.isFinite(raw)) setNum('txBattRuntimeMin', raw)
          break
        }
        case 'CHAN_NAME': {
          setStr('channelName', frame.values.join(' '))
          break
        }
        case 'GROUP_CHAN': {
          setStr('groupChannel', frame.values.join(' '))
          break
        }
        case 'LOCK_STATUS': {
          setStr('lockStatus', frame.values.join(' '))
          break
        }
        case 'METER_RATE': {
          // Just a confirmation REP after our SET; no state effect.
          break
        }
        case 'FLASH':
        case 'ALL':
        default:
          // Unknown or non-state property — keep raw frame visible via
          // 'frame' event, no state mutation.
          return
      }

      if (changed) {
        this.state.set(ch, next)
        this.emit('stateChange', ch, next)
      } else {
        this.state.set(ch, next)
      }
    }
  }

  /**
   * Merge a `< SAMPLE ch ALL audPeak audRms rfRssi >` frame (SLX
   * format — three numeric fields after the flags token). SLX-D RSSI
   * is combined (no antenna A/B), so the rfRssi value goes to
   * rssiDbm directly.
   *
   * AD/ULX/QLX use a different SAMPLE layout; do not reuse this
   * parser for those families.
   */
  private applySample(frame: ShureFrame): void {
    const ch = frame.channel
    if (ch < 1) return
    const prev = this.state.get(ch) ?? { channel: ch }
    const next: ShureChannelState = { ...prev, lastSampleAt: Math.floor(Date.now() / 1000) }
    let changed = false

    // values[0] is the 'ALL' flags token — skip if non-numeric.
    let idx = 0
    if (frame.values[0] && Number.isNaN(parseInt(frame.values[0], 10))) idx = 1

    const nums = frame.values.slice(idx).map((v) => parseInt(v, 10))
    const [audPeak, audRms, rfRssi] = nums

    if (Number.isFinite(audPeak)) {
      const v = audPeak - 120
      if (prev.audioPeakDbfs !== v) { next.audioPeakDbfs = v; changed = true }
    }
    if (Number.isFinite(audRms)) {
      const v = audRms - 120
      if (prev.audioRmsDbfs !== v) { next.audioRmsDbfs = v; changed = true }
    }
    if (Number.isFinite(rfRssi)) {
      const v = rssiRawToDbm(rfRssi)
      if (prev.rssiDbm !== v) { next.rssiDbm = v; changed = true }
    }

    this.state.set(ch, next)
    if (changed) this.emit('stateChange', ch, next)
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      // Bitfocus-style: GET a cheap property and rely on REP arrival
      // resetting lastFrameAt. Watchdog handles the no-reply case.
      this.sendRaw(`${SHURE_PROTOCOL.FRAME_OPEN}GET 1 METER_RATE${SHURE_PROTOCOL.FRAME_CLOSE}`)
    }, SHURE_NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectAttempts += 1
    if (this.reconnectAttempts > SHURE_NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`[SHURE-SLXD] Max reconnect attempts hit for ${this.receiverName} — giving up`)
      return
    }
    const backoffMs = Math.min(
      30_000,
      SHURE_NETWORK_CONFIG.RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1),
    )
    logger.info(`[SHURE-SLXD] Reconnecting to ${this.receiverName} in ${backoffMs}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch((err) => {
        logger.debug(`[SHURE-SLXD] Reconnect failed for ${this.receiverName}: ${err.message}`)
      })
    }, backoffMs)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private armWatchdog(): void {
    this.clearWatchdog()
    this.watchdogTimer = setInterval(() => {
      if (this.meterRateMs === 0) return
      const gap = Date.now() - this.lastFrameAt
      if (gap > SILENT_RECEIVER_WATCHDOG_MS) {
        logger.warn(`[SHURE-SLXD] No frames from ${this.receiverName} in ${Math.round(gap / 1000)}s with metering active — reconnecting`)
        this.intentionalDisconnect = false
        if (this.socket) this.socket.destroy()
      }
    }, SILENT_RECEIVER_WATCHDOG_MS / 2)
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }
}

export function createShureSlxdClient(config: ShureSlxdClientConfig): ShureSlxdClient {
  return new ShureSlxdClient(config)
}

export type { ShureClientEvents }
