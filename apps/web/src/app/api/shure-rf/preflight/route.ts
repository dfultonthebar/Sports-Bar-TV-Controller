/**
 * POST /api/shure-rf/preflight
 *
 * Pre-install check for a Shure SLX-D receiver. Run by the operator
 * BEFORE saving the receiver row in Device Config — catches the #1
 * install failure (front-panel "Allow Third-Party Controls" gate
 * defaults BLOCKED; without it, port 2202 accepts the TCP connection
 * but silently drops every command).
 *
 * Body: { ip: string, port?: number }
 *
 * Response checklist (each item green/red with detail):
 *   - tcpReachable      — net.Socket connects within 3s
 *   - thirdPartyControlsEnabled — receiver REPs to GET FW_VER within 2s
 *   - firmwareAtLeast110 — parsed FW_VER ≥ 1.1.0 (network control min)
 *   - modelDetected     — receiver REPs to GET MODEL
 *
 * Uses a one-shot client (no manager registration, no metering, no
 * heartbeat) — connect, query, disconnect, done. ~3s total wall time
 * for a healthy receiver.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Socket } from 'net'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@sports-bar/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'
import { requireAuth } from '@/lib/auth'
import { SHURE_NETWORK_CONFIG, SHURE_PROTOCOL } from '@sports-bar/shure-slxd'

const preflightSchema = z.object({
  ip: z.string().min(1).max(64),
  port: z.number().int().min(1).max(65535).optional(),
})

type CheckResult = { name: string; passed: boolean; detail: string }

const REPLY_TIMEOUT_MS = 2_000

interface PreflightOutcome {
  tcpReachable: boolean
  thirdPartyControlsEnabled: boolean
  firmwareAtLeast110: boolean
  modelDetected: boolean
  firmwareVersion: string | null
  model: string | null
  rfBand: string | null
  rawFrames: string[]
}

async function runPreflight(ip: string, port: number): Promise<PreflightOutcome> {
  const outcome: PreflightOutcome = {
    tcpReachable: false,
    thirdPartyControlsEnabled: false,
    firmwareAtLeast110: false,
    modelDetected: false,
    firmwareVersion: null,
    model: null,
    rfBand: null,
    rawFrames: [],
  }

  return new Promise((resolve) => {
    const sock = new Socket()
    let buffer = ''
    let connected = false
    let resolved = false
    const settle = () => {
      if (resolved) return
      resolved = true
      try { sock.destroy() } catch {/* ignore */}
      resolve(outcome)
    }

    const connectTimer = setTimeout(() => settle(), SHURE_NETWORK_CONFIG.CONNECTION_TIMEOUT_MS)
    const replyTimer = setTimeout(() => settle(), SHURE_NETWORK_CONFIG.CONNECTION_TIMEOUT_MS + REPLY_TIMEOUT_MS)

    sock.setNoDelay(true)
    sock.once('connect', () => {
      clearTimeout(connectTimer)
      connected = true
      outcome.tcpReachable = true
      // Fire all the probes we care about. The receiver will REP each.
      sock.write(`${SHURE_PROTOCOL.FRAME_OPEN}GET 0 FW_VER${SHURE_PROTOCOL.FRAME_CLOSE}\r\n`)
      sock.write(`${SHURE_PROTOCOL.FRAME_OPEN}GET 0 MODEL${SHURE_PROTOCOL.FRAME_CLOSE}\r\n`)
      sock.write(`${SHURE_PROTOCOL.FRAME_OPEN}GET 0 RF_BAND${SHURE_PROTOCOL.FRAME_CLOSE}\r\n`)
    })

    sock.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('ascii')
      let start = buffer.indexOf('<')
      while (start !== -1) {
        const end = buffer.indexOf('>', start + 1)
        if (end === -1) {
          buffer = buffer.slice(start)
          break
        }
        const raw = buffer.slice(start, end + 1)
        buffer = buffer.slice(end + 1)
        outcome.rawFrames.push(raw)
        outcome.thirdPartyControlsEnabled = true

        // Parse just enough to populate the checklist. Mirrors the
        // client's parseFrame logic but without the cache/event surface.
        const inner = raw.replace(/^</, '').replace(/>$/, '').trim()
        const bracedMatch = inner.match(/\{([^}]*)\}/)
        const bracedValue = bracedMatch ? bracedMatch[1] : null
        const withoutBraces = inner.replace(/\{[^}]*\}/, '').trim()
        const tokens = withoutBraces.split(/\s+/).filter(Boolean)
        if (tokens.length < 3) continue
        const [verb, _chan, property, ...rest] = tokens
        if (verb !== 'REP') continue
        const value = bracedValue ?? rest.join(' ')

        if (property === 'FW_VER') {
          outcome.firmwareVersion = value
          const match = value.match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
          if (match) {
            const major = parseInt(match[1], 10)
            const minor = parseInt(match[2], 10)
            outcome.firmwareAtLeast110 = major > 1 || (major === 1 && minor >= 1)
          }
        } else if (property === 'MODEL') {
          outcome.model = value.trim()
          outcome.modelDetected = outcome.model.startsWith('SLXD')
        } else if (property === 'RF_BAND') {
          outcome.rfBand = value.trim()
        }

        // Bail early if we have all four pieces of info.
        if (
          outcome.tcpReachable &&
          outcome.firmwareAtLeast110 &&
          outcome.modelDetected &&
          outcome.rfBand
        ) {
          clearTimeout(replyTimer)
          settle()
          return
        }
      }
    })

    sock.on('error', () => {
      clearTimeout(connectTimer)
      clearTimeout(replyTimer)
      settle()
    })

    sock.on('close', () => {
      clearTimeout(connectTimer)
      // Give replies a moment to arrive even after close on a flaky
      // network — let replyTimer settle.
      if (!connected) settle()
    })

    sock.connect(port, ip)
  })
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // ADMIN-gated: this endpoint opens an outbound TCP socket to an
  // operator-supplied IP:port. Without auth, an unauthenticated LAN
  // caller could use it to probe arbitrary TCP services on the bar's
  // network. Device Config (where the operator invokes this) requires
  // ADMIN already, so this is the matching server-side gate.
  const authCheck = await requireAuth(request, 'ADMIN', { auditAction: 'shure_preflight' })
  if (!authCheck.allowed) return authCheck.response!

  const bodyValidation = await validateRequestBody(request, preflightSchema)
  if (!bodyValidation.success) return bodyValidation.error
  const { ip, port } = bodyValidation.data

  const targetPort = port ?? SHURE_NETWORK_CONFIG.TCP_PORT
  logger.info(`[SHURE-PREFLIGHT] Running pre-install check on ${ip}:${targetPort}`)

  let outcome: PreflightOutcome
  try {
    outcome = await runPreflight(ip, targetPort)
  } catch (err) {
    logger.error('[SHURE-PREFLIGHT] Probe threw:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    )
  }

  const checks: CheckResult[] = [
    {
      name: 'tcpReachable',
      passed: outcome.tcpReachable,
      detail: outcome.tcpReachable
        ? `TCP ${ip}:${targetPort} accepted connection`
        : `Could not connect to ${ip}:${targetPort} within ${SHURE_NETWORK_CONFIG.CONNECTION_TIMEOUT_MS}ms — check VLAN routing + receiver power`,
    },
    {
      name: 'thirdPartyControlsEnabled',
      passed: outcome.thirdPartyControlsEnabled,
      detail: outcome.thirdPartyControlsEnabled
        ? 'Receiver responded to commands — third-party controls enabled'
        : 'TCP connected but no replies received — enable on receiver: Menu → Advanced → Network → Allow Third-Party Controls → Enable',
    },
    {
      name: 'firmwareAtLeast110',
      passed: outcome.firmwareAtLeast110,
      detail: outcome.firmwareVersion
        ? (outcome.firmwareAtLeast110
            ? `Firmware ${outcome.firmwareVersion} (≥ 1.1.0 required for network control)`
            : `Firmware ${outcome.firmwareVersion} too old — upgrade to ≥ 1.1.0`)
        : 'Firmware version not reported',
    },
    {
      name: 'modelDetected',
      passed: outcome.modelDetected,
      detail: outcome.model
        ? `Model: ${outcome.model}${outcome.rfBand ? ` (band ${outcome.rfBand})` : ''}`
        : 'Model not reported — receiver may not be a Shure SLX-D family unit',
    },
  ]

  const allPassed = checks.every((c) => c.passed)

  return NextResponse.json({
    success: true,
    ready: allPassed,
    checks,
    receiver: {
      model: outcome.model,
      firmwareVersion: outcome.firmwareVersion,
      rfBand: outcome.rfBand,
    },
    rawFrames: outcome.rawFrames,
  })
}
