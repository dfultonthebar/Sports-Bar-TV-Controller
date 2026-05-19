#!/usr/bin/env node
/**
 * Mock Shure SLX-D receiver — TCP server that speaks the SLX-D ASCII
 * line protocol (port 2202) so the parser + RF watcher can be tested
 * without real hardware in front of you.
 *
 * Spec source: packages/shure-slxd/README.md + packages/shure-slxd/src/config.ts
 *
 * Framing: `< VERB CHAN PROP VAL... >` — literal `< ` open, ` >` close,
 * single space tokens, `{...}` wrapping for string values that may
 * contain spaces (CHAN_NAME, DEVICE_ID, FW_VER, GROUP_CHAN).
 *
 * Encoding: rfRssi / audPeak / audRms are dBm/dB offset by +120
 * (raw = dBm + 120, so -67 dBm → 053). FREQUENCY is 6-digit kHz.
 *
 * Each TCP connection gets its OWN state machine — no shared globals,
 * so multiple watcher tests can run in parallel.
 *
 * Usage:
 *   npx tsx scripts/mock-shure-receiver.ts --port=2202 --scenario=clean
 */

import * as net from 'net'

// ---------- CLI ----------

interface CliArgs {
  port: number
  scenario: ScenarioName
}

type ScenarioName =
  | 'clean'
  | 'interference-rising'
  | 'tx-battery-dying'
  | 'coalesced-frames'
  | 'partial-frames'
  | 'third-party-controls-disabled'

const SCENARIOS: ScenarioName[] = [
  'clean',
  'interference-rising',
  'tx-battery-dying',
  'coalesced-frames',
  'partial-frames',
  'third-party-controls-disabled',
]

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { port: 2202, scenario: 'clean' }
  for (const a of argv.slice(2)) {
    const m = a.match(/^--(\w[\w-]*)=(.+)$/)
    if (!m) continue
    if (m[1] === 'port') out.port = Number(m[2]) || 2202
    if (m[1] === 'scenario') {
      if (!SCENARIOS.includes(m[2] as ScenarioName)) {
        console.error(`[MOCK] Unknown scenario "${m[2]}". Valid: ${SCENARIOS.join(', ')}`)
        process.exit(2)
      }
      out.scenario = m[2] as ScenarioName
    }
  }
  return out
}

// ---------- Protocol helpers ----------

const FRAME_OPEN = '< '
const FRAME_CLOSE = ' >'

/** Build a `< ... >` frame from arbitrary tokens (caller supplies braces). */
function frame(...tokens: (string | number)[]): string {
  return FRAME_OPEN + tokens.map(String).join(' ') + FRAME_CLOSE
}

/** SLX-D encodes dB/dBm levels as raw = value + 120, zero-padded 3 digits. */
function encodeLevel(dbm: number): string {
  const raw = Math.max(0, Math.min(120, Math.round(dbm + 120)))
  return String(raw).padStart(3, '0')
}

/** FREQUENCY raw: kHz, 6 digits zero-padded. */
function encodeFreqKhz(mhz: number): string {
  return String(Math.round(mhz * 1000)).padStart(6, '0')
}

/** Tokenize a single inbound frame (already stripped of `< ` / ` >`). */
function tokenize(body: string): string[] {
  // Re-glue `{...}` runs so a CHAN_NAME with spaces stays one token.
  const tokens: string[] = []
  let i = 0
  while (i < body.length) {
    if (body[i] === ' ') { i++; continue }
    if (body[i] === '{') {
      const end = body.indexOf('}', i)
      if (end < 0) { tokens.push(body.slice(i)); break }
      tokens.push(body.slice(i + 1, end)) // strip braces
      i = end + 1
    } else {
      let j = i
      while (j < body.length && body[j] !== ' ') j++
      tokens.push(body.slice(i, j))
      i = j
    }
  }
  return tokens
}

// ---------- Per-channel state ----------

interface ChannelState {
  name: string
  freqMhz: number
  audioGain: number      // raw 0-60
  txType: 'SLXD1' | 'SLXD2' | 'UNKNOWN'
  battBars: number       // 0-5
  battMins: number
  groupChan: string      // e.g. "01,03" or "--,--"
  meterRateMs: number    // 0 = off
  audioOutSwitch: 'MIC' | 'LINE'
  rssiDbm: number        // current target RSSI for sampling
}

function makeChannel(name: string, freqMhz: number): ChannelState {
  return {
    name,
    freqMhz,
    audioGain: 30,
    txType: 'SLXD2',
    battBars: 4,
    battMins: 240,
    groupChan: '01,03',
    meterRateMs: 0,
    audioOutSwitch: 'LINE',
    rssiDbm: -70,
  }
}

// ---------- Connection-scoped session ----------

interface Session {
  socket: net.Socket
  remote: string
  scenario: ScenarioName
  rxFwVer: string
  rxModel: string
  rxDeviceId: string
  rxBand: string
  rxLock: 'OFF' | 'MENU' | 'ALL'
  channels: Record<1 | 2, ChannelState>
  meterTimers: Partial<Record<1 | 2, NodeJS.Timeout>>
  scenarioTimers: NodeJS.Timeout[]
  scenarioStart: number
  buffer: string
  closed: boolean
  // Single per-session partial-frame queue. Concurrent send() calls
  // (e.g. seed flood + a SAMPLE timer firing) MUST share this queue so
  // their writes don't interleave halves of different frames into the
  // socket stream — otherwise the parser sees `< REP 0 FW<SAMPLE 1 ...`
  // and silently drops the corrupted frame.
  partialQueue: string[]
  partialDraining: boolean
}

function newSession(socket: net.Socket, scenario: ScenarioName): Session {
  return {
    socket,
    remote: `${socket.remoteAddress}:${socket.remotePort}`,
    scenario,
    rxFwVer: '2.1.5',
    rxModel: 'SLXD4D',
    rxDeviceId: 'MockSLXD',
    rxBand: 'G58',
    rxLock: 'OFF',
    channels: {
      1: makeChannel('Mic A', 537.125),
      2: makeChannel('Mic B', 539.500),
    },
    meterTimers: {},
    scenarioTimers: [],
    scenarioStart: Date.now(),
    buffer: '',
    closed: false,
    partialQueue: [],
    partialDraining: false,
  }
}

// ---------- Emit (with scenario hooks for coalesced / partial) ----------

function send(session: Session, frames: string[]) {
  if (session.closed) return
  const log = frames.map((f) => `  -> ${f}`).join('\n')
  console.log(`[MOCK] tx to ${session.remote}:\n${log}`)

  if (session.scenario === 'coalesced-frames') {
    // Glue every emit batch together in one write — and if a single
    // frame, append the next outbound by waiting 5ms.
    session.socket.write(frames.join(''))
    return
  }
  if (session.scenario === 'partial-frames') {
    // Append to the per-session queue and kick the drain. A single
    // drain loop owns the socket so concurrent send() calls (seed
    // flood + SAMPLE timer fires) can never interleave halves of
    // different frames.
    for (const f of frames) session.partialQueue.push(f)
    drainPartialQueue(session)
    return
  }
  session.socket.write(frames.join(''))
}

function drainPartialQueue(session: Session) {
  if (session.partialDraining || session.closed) return
  session.partialDraining = true
  const step = () => {
    if (session.closed) { session.partialDraining = false; return }
    const f = session.partialQueue.shift()
    if (f === undefined) { session.partialDraining = false; return }
    const mid = Math.max(2, Math.floor(f.length / 2))
    session.socket.write(f.slice(0, mid))
    setTimeout(() => {
      if (session.closed) { session.partialDraining = false; return }
      session.socket.write(f.slice(mid))
      setTimeout(step, 5)
    }, 50)
  }
  step()
}

// ---------- Seed flood on GET 0 ALL ----------

function emitFullSeed(session: Session) {
  const frames: string[] = []
  frames.push(frame('REP', 0, 'FW_VER', `{${session.rxFwVer}}`))
  frames.push(frame('REP', 0, 'MODEL', session.rxModel))
  frames.push(frame('REP', 0, 'DEVICE_ID', `{${session.rxDeviceId}}`))
  frames.push(frame('REP', 0, 'RF_BAND', session.rxBand))
  frames.push(frame('REP', 0, 'LOCK_STATUS', session.rxLock))
  for (const ch of [1, 2] as const) {
    const c = session.channels[ch]
    frames.push(frame('REP', ch, 'CHAN_NAME', `{${c.name}}`))
    frames.push(frame('REP', ch, 'FREQUENCY', encodeFreqKhz(c.freqMhz)))
    frames.push(frame('REP', ch, 'AUDIO_GAIN', String(c.audioGain).padStart(2, '0')))
    frames.push(frame('REP', ch, 'TX_TYPE', c.txType))
    frames.push(frame('REP', ch, 'TX_BATT_BARS', String(c.battBars)))
    frames.push(frame('REP', ch, 'TX_BATT_MINS', String(c.battMins)))
    frames.push(frame('REP', ch, 'GROUP_CHAN', `{${c.groupChan}}`))
    frames.push(frame('REP', ch, 'METER_RATE', String(c.meterRateMs).padStart(5, '0')))
    frames.push(frame('REP', ch, 'AUDIO_OUT_LVL_SWITCH', c.audioOutSwitch))
  }
  send(session, frames)
}

// ---------- METER_RATE → SAMPLE pump ----------

function startMetering(session: Session, ch: 1 | 2, rateMs: number) {
  if (session.meterTimers[ch]) clearInterval(session.meterTimers[ch]!)
  if (rateMs === 0) return
  const safeRate = Math.max(50, Math.min(60000, rateMs))
  session.meterTimers[ch] = setInterval(() => {
    if (session.closed) return
    const c = session.channels[ch]
    // Audio peak/RMS = small randomness around -45 / -55 dB when TX present.
    const audPeak = c.txType === 'UNKNOWN' ? -90 : -45 + (Math.random() * 6 - 3)
    const audRms  = c.txType === 'UNKNOWN' ? -95 : -55 + (Math.random() * 4 - 2)
    // RSSI: jitter ±2 dB around c.rssiDbm.
    const rssi = c.rssiDbm + (Math.random() * 4 - 2)
    const f = frame('SAMPLE', ch, 'ALL', encodeLevel(audPeak), encodeLevel(audRms), encodeLevel(rssi))
    send(session, [f])
  }, safeRate)
}

// ---------- Scenario kickoff ----------

function runScenario(session: Session) {
  // Baseline RSSI per channel for whichever scenario.
  for (const ch of [1, 2] as const) {
    session.channels[ch].rssiDbm = -67 - Math.floor(Math.random() * 5) // -67..-71
  }
  if (session.scenario === 'clean') return

  if (session.scenario === 'interference-rising') {
    // After 10s, ch1 TX_TYPE → UNKNOWN, RSSI ramp -71 → -78 over 5s.
    session.scenarioTimers.push(setTimeout(() => {
      session.channels[1].txType = 'UNKNOWN'
      send(session, [frame('REP', 1, 'TX_TYPE', 'UNKNOWN')])
      const startRssi = session.channels[1].rssiDbm
      const targetRssi = -78
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        session.scenarioTimers.push(setTimeout(() => {
          session.channels[1].rssiDbm = startRssi + (targetRssi - startRssi) * (i / steps)
        }, (5000 * i) / steps))
      }
      // Hold 30s then drop to noise floor.
      session.scenarioTimers.push(setTimeout(() => {
        session.channels[1].rssiDbm = -100
      }, 5000 + 30000))
    }, 10_000))
    return
  }

  if (session.scenario === 'tx-battery-dying') {
    const minsByBars = [5, 30, 60, 120, 180, 240]
    session.channels[1].battBars = 5
    session.channels[1].battMins = 240
    send(session, [
      frame('REP', 1, 'TX_BATT_BARS', '5'),
      frame('REP', 1, 'TX_BATT_MINS', '240'),
    ])
    for (let i = 1; i <= 5; i++) {
      session.scenarioTimers.push(setTimeout(() => {
        const bars = 5 - i
        const mins = minsByBars[bars]
        session.channels[1].battBars = bars
        session.channels[1].battMins = mins
        send(session, [
          frame('REP', 1, 'TX_BATT_BARS', String(bars)),
          frame('REP', 1, 'TX_BATT_MINS', String(mins)),
        ])
      }, 20_000 * i))
    }
    return
  }

  // coalesced-frames / partial-frames: just lean on send() wrappers; nothing
  // else to schedule.
  // third-party-controls-disabled: handled in handleCommand (silent drop).
}

// ---------- Command dispatch ----------

function handleCommand(session: Session, raw: string) {
  console.log(`[MOCK] rx <- ${session.remote}: ${raw}`)

  if (session.scenario === 'third-party-controls-disabled') {
    // Receiver-side gate OFF: TCP accepted, every command silently dropped.
    return
  }

  // Strip `< ` / ` >`.
  const body = raw.replace(/^<\s*/, '').replace(/\s*>$/, '')
  const tokens = tokenize(body)
  if (tokens.length < 3) return // silently drop malformed (per spec)
  const verb = tokens[0]
  const chan = Number(tokens[1])
  const prop = tokens[2]
  const val = tokens[3]

  if (verb === 'GET' && chan === 0 && prop === 'ALL') {
    emitFullSeed(session)
    // Start metering wherever rate was already set.
    for (const ch of [1, 2] as const) {
      if (session.channels[ch].meterRateMs > 0) {
        startMetering(session, ch, session.channels[ch].meterRateMs)
      }
    }
    return
  }

  if (verb === 'GET' && (chan === 0 || chan === 1 || chan === 2) && prop === 'METER_RATE') {
    const targetChannels: (1 | 2)[] = chan === 0 ? [1, 2] : [chan as 1 | 2]
    const reps = targetChannels.map((c) =>
      frame('REP', c, 'METER_RATE', String(session.channels[c].meterRateMs).padStart(5, '0')),
    )
    send(session, reps)
    return
  }

  if (verb === 'SET' && (chan === 0 || chan === 1 || chan === 2) && prop === 'METER_RATE') {
    // Spec: chan=0 broadcasts to all channels. The real receiver
    // applies METER_RATE to each channel independently when given 0.
    const rateMs = Number(val)
    if (!Number.isFinite(rateMs) || (rateMs !== 0 && (rateMs < 50 || rateMs > 60000))) {
      return // silently drop out-of-range
    }
    const targetChannels: (1 | 2)[] = chan === 0 ? [1, 2] : [chan as 1 | 2]
    for (const c of targetChannels) {
      session.channels[c].meterRateMs = rateMs
      send(session, [frame('REP', c, 'METER_RATE', String(rateMs).padStart(5, '0'))])
      startMetering(session, c, rateMs)
    }
    return
  }

  if (verb === 'SET' && (chan === 1 || chan === 2) && prop === 'FREQUENCY') {
    const khz = Number(val)
    if (!Number.isFinite(khz) || val.length !== 6) return
    const mhz = khz / 1000
    const c = session.channels[chan as 1 | 2]
    c.freqMhz = mhz
    c.groupChan = '--,--' // manual freq blanks group per spec
    send(session, [
      frame('REP', chan, 'FREQUENCY', encodeFreqKhz(mhz)),
      frame('REP', chan, 'GROUP_CHAN', `{${c.groupChan}}`),
    ])
    return
  }

  if (verb === 'GET' && chan === 0 && prop === 'FW_VER') {
    send(session, [frame('REP', 0, 'FW_VER', `{${session.rxFwVer}}`)])
    return
  }

  // Anything else: silent drop (matches receiver behavior).
}

// ---------- Frame accumulator ----------

function ingest(session: Session, chunk: Buffer) {
  session.buffer += chunk.toString('ascii')
  while (true) {
    const start = session.buffer.indexOf('<')
    if (start < 0) { session.buffer = ''; return }
    const end = session.buffer.indexOf('>', start)
    if (end < 0) {
      // partial frame; keep waiting.
      session.buffer = session.buffer.slice(start)
      return
    }
    const frameStr = session.buffer.slice(start, end + 1)
    session.buffer = session.buffer.slice(end + 1)
    handleCommand(session, frameStr)
  }
}

// ---------- Server ----------

function main() {
  const args = parseArgs(process.argv)
  const sessions = new Set<Session>()

  const server = net.createServer((socket) => {
    const session = newSession(socket, args.scenario)
    sessions.add(session)
    console.log(`[MOCK] connect from ${session.remote} (scenario=${args.scenario})`)

    socket.on('data', (data) => ingest(session, data))
    socket.on('close', () => {
      session.closed = true
      for (const t of Object.values(session.meterTimers)) if (t) clearInterval(t)
      for (const t of session.scenarioTimers) clearTimeout(t)
      sessions.delete(session)
      console.log(`[MOCK] disconnect ${session.remote}`)
    })
    socket.on('error', (err) => {
      console.log(`[MOCK] socket error ${session.remote}: ${err.message}`)
    })

    runScenario(session)
  })

  server.on('error', (err) => {
    console.error(`[MOCK] server error: ${(err as Error).message}`)
    process.exit(1)
  })
  server.listen(args.port, () => {
    console.log(`[MOCK] Shure SLX-D mock listening on tcp/${args.port} scenario=${args.scenario}`)
  })

  const shutdown = (sig: string) => {
    console.log(`[MOCK] ${sig} received, shutting down...`)
    for (const s of sessions) {
      s.closed = true
      for (const t of Object.values(s.meterTimers)) if (t) clearInterval(t)
      for (const t of s.scenarioTimers) clearTimeout(t)
      s.socket.destroy()
    }
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main()
