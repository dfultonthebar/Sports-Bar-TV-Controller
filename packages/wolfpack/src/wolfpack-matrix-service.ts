/**
 * Wolfpack Matrix Routing Service
 * Handles routing Wolfpack video inputs to Matrix outputs for Atlas audio integration
 */

import { logger } from '@sports-bar/logger'

interface MatrixConfiguration {
  id: string
  ipAddress: string
  tcpPort: number
  udpPort: number
  protocol: string
  outputOffset?: number
  credentials?: { username: string; password: string }
  chassisId?: string | null
}

interface RoutingResult {
  success: boolean
  error?: string
  command?: string
  response?: string
}

/**
 * Makes an HTTP request using Node's native http module.
 * Bypasses Next.js fetch() override which interferes with session cookies
 * and request deduplication for hardware control.
 */
function httpRequest(options: {
  hostname: string
  path: string
  method: string
  headers?: Record<string, string>
  body?: string
  followRedirect?: boolean
}): Promise<{ statusCode: number; headers: Record<string, string | string[]>; body: string }> {
  const http = require('http')
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...(options.headers || {}) }
    if (options.body && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(options.body).toString()
    }
    const req = http.request(
      {
        hostname: options.hostname,
        port: 80,
        path: options.path,
        method: options.method,
        headers,
      },
      (res: any) => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          })
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(new Error('HTTP request timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

/**
 * Per-IP serialization for Wolf Pack HTTP sessions.
 *
 * The Wolf Pack `o2ox` command is a TOGGLE, and its firmware coordinates
 * session state poorly across CONCURRENT HTTP sessions — especially on
 * multi-card chassis (WP-36X36 with 4-output daughter cards at Greenville /
 * Appleton), where two simultaneous PHPSESSID sessions make a route-state
 * READ return a stale value. The scheduler / auto-reallocator's route WRITE
 * then pre-checks against that stale value, fires the toggle against an
 * already-correct route, and CLEARS it — the TV goes black. The real-world
 * trigger is the bartender Video tab's `loadCurrentRoutes()` GET opening a
 * second session while a scheduled route write is in flight.
 *
 * Fix: serialize EVERY Wolf Pack HTTP session per IP so a read and a write
 * never overlap on the firmware. Promise-chain mutex; the returned release()
 * resolves the next waiter. Hoisted to globalThis + Symbol.for() because
 * Next.js bundles each route handler separately, so a module-private map would
 * be per-bundle, not per-process (Gotcha #10) — and the Video-tab GET and the
 * scheduler POST run in DIFFERENT route bundles, which is exactly the pair we
 * must serialize.
 */
function acquireWolfPackHttpLock(ipAddress: string): Promise<() => void> {
  const KEY = Symbol.for('@sports-bar/wolfpack/http-session-locks')
  const g = globalThis as any
  if (!g[KEY]) g[KEY] = new Map<string, Promise<void>>()
  const locks: Map<string, Promise<void>> = g[KEY]
  const prev = locks.get(ipAddress) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>(resolve => { release = resolve })
  locks.set(ipAddress, prev.then(() => next))
  return prev.then(() => release)
}

/**
 * Sends an HTTP command to the Wolf Pack matrix via its web API.
 * The HTTP API uses 0-based indices for both input and output.
 * This function accepts 0-based indices directly.
 *
 * Uses Node's native http module instead of fetch() to avoid
 * Next.js fetch interception that breaks session-based auth.
 *
 * Serialized per-IP (see acquireWolfPackHttpLock) so it never runs concurrently
 * with a queryWolfpackRouteState() read on the same Wolf Pack.
 */
export async function sendHTTPCommand(
  ipAddress: string,
  input0Based: number,
  output0Based: number,
  credentials?: { username: string; password: string }
): Promise<RoutingResult> {
  const release = await acquireWolfPackHttpLock(ipAddress)
  try {
    return await sendHTTPCommandInner(ipAddress, input0Based, output0Based, credentials)
  } finally {
    release()
  }
}

async function sendHTTPCommandInner(
  ipAddress: string,
  input0Based: number,
  output0Based: number,
  credentials?: { username: string; password: string }
): Promise<RoutingResult> {
  try {
    const creds = credentials || { username: 'admin', password: 'admin' }

    // Step 1: Login to get PHP session cookie
    logger.info(`[WOLFPACK-HTTP] Logging in to http://${ipAddress}/login.php`)
    const loginResponse = await httpRequest({
      hostname: ipAddress,
      path: '/login.php',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`,
    })

    // Extract PHPSESSID from set-cookie header
    const setCookieHeader = loginResponse.headers['set-cookie']
    const setCookie = Array.isArray(setCookieHeader) ? setCookieHeader.join(', ') : (setCookieHeader || '')
    const sessionMatch = setCookie.match(/PHPSESSID=([^;]+)/)
    if (!sessionMatch) {
      logger.error('[WOLFPACK-HTTP] Login failed - no PHPSESSID in response')
      return {
        success: false,
        error: 'Login failed - no session cookie received',
      }
    }
    const sessionCookie = `PHPSESSID=${sessionMatch[1]}`
    logger.info(`[WOLFPACK-HTTP] Login successful, got session cookie`)

    // Step 1b: Follow redirect to index.php to finalize PHP session
    // Without this, the session is not fully authenticated and routing commands are ignored
    await httpRequest({
      hostname: ipAddress,
      path: '/index.php',
      method: 'GET',
      headers: { 'Cookie': sessionCookie },
    })

    // Step 1c: Query current routing state BEFORE sending the command.
    // The o2ox command is a TOGGLE — if the route is already set, sending
    // it again CLEARS the route instead of being a no-op. This was the root
    // cause of TV 1 randomly going black at multiple locations: the scheduler
    // or auto-reallocator re-sent the same route, Wolf Pack toggled it off,
    // and the TV lost its HDMI signal.
    const queryPath = '/get_json_cmd.php?cmd=o2ox'
    const queryResponse = await httpRequest({
      hostname: ipAddress,
      path: queryPath,
      method: 'GET',
      headers: { 'Cookie': sessionCookie },
    })
    try {
      let currentRoutes: number[] = JSON.parse(queryResponse.body)
      // Wolf Pack firmware quirk: the first o2ox query after a fresh login can
      // return 65535 (0xFFFF) for one or more outputs — especially output 1 —
      // as a session-init sentinel, NOT the real route. If we trust it and
      // proceed, the toggle-style prm command flips an already-correct route
      // OFF (TV 1 goes black). Mirrors the settle+requery in
      // queryWolfpackRouteState(). Triggers when the bartender Video tab opens
      // a new route-state query while the scheduler concurrently routes.
      if (currentRoutes[output0Based] === 65535) {
        logger.info(`[WOLFPACK-HTTP] Pre-check got 0xFFFF sentinel at output ${output0Based}, settling 600ms and re-querying`)
        await new Promise(resolve => setTimeout(resolve, 600))
        const retryResponse = await httpRequest({
          hostname: ipAddress,
          path: queryPath,
          method: 'GET',
          headers: { 'Cookie': sessionCookie },
        })
        const retry = JSON.parse(retryResponse.body)
        if (Array.isArray(retry) && retry.every((v: unknown) => typeof v === 'number')) {
          currentRoutes = retry as number[]
        }
      }
      if (currentRoutes[output0Based] === input0Based) {
        logger.info(`[WOLFPACK-HTTP] Output ${output0Based} already routed to input ${input0Based} — skipping to avoid toggle-off`)
        return {
          success: true,
          command: `HTTP o2ox: ${input0Based},${output0Based} (already set, skipped)`,
          response: queryResponse.body,
        }
      }
      if (currentRoutes[output0Based] === 65535) {
        // Re-query still returned the sentinel — firmware state is unknown.
        // Refuse to send the toggle command rather than risk flipping a good
        // route off. Caller (scheduler/auto-reallocator) will retry on its
        // next tick when the session has finished settling.
        logger.warn(`[WOLFPACK-HTTP] Sentinel persisted for output ${output0Based}, refusing to send toggle command`)
        return {
          success: false,
          error: `Wolf Pack firmware sentinel persisted at output ${output0Based} — route state unknown, retry next cycle`,
        }
      }
    } catch {
      // If query fails, proceed with the route command anyway
      logger.warn(`[WOLFPACK-HTTP] Could not pre-check current routes, proceeding with route command`)
    }

    // Step 2: Send routing command (only reaches here if route is NOT already set)
    const routePath = `/get_json_cmd.php?cmd=o2ox&prm=${input0Based},${output0Based}`
    logger.info(`[WOLFPACK-HTTP] Routing: input ${input0Based} -> output ${output0Based} (0-based)`)
    logger.info(`[WOLFPACK-HTTP] GET http://${ipAddress}${routePath}`)

    const routeResponse = await httpRequest({
      hostname: ipAddress,
      path: routePath,
      method: 'GET',
      headers: { 'Cookie': sessionCookie },
    })

    const responseText = routeResponse.body
    logger.info(`[WOLFPACK-HTTP] Response: ${responseText}`)

    // Step 3: Parse response
    let routingMap: number[]
    try {
      routingMap = JSON.parse(responseText)
    } catch {
      logger.error(`[WOLFPACK-HTTP] Failed to parse response as JSON: ${responseText}`)
      return {
        success: false,
        error: `Invalid JSON response: ${responseText}`,
        response: responseText,
      }
    }

    // The o2ox command applies the route AND returns the routing array.
    // Due to firmware timing, the returned array may show stale state for the
    // just-routed output. The route itself always succeeds if we get valid JSON back.
    const actual = routingMap[output0Based]
    if (actual === input0Based) {
      logger.info(`[WOLFPACK-HTTP] Verified: output ${output0Based} is now routed to input ${input0Based}`)
      return {
        success: true,
        command: `HTTP o2ox: ${input0Based},${output0Based}`,
        response: responseText,
      }
    }

    // o2ox can toggle: if route was already set, it clears it.
    // Retry once — the second call will re-set it.
    logger.info(`[WOLFPACK-HTTP] Verification missed (got ${routingMap[output0Based]}), retrying...`)
    const retryResponse = await httpRequest({
      hostname: ipAddress,
      path: routePath,
      method: 'GET',
      headers: { 'Cookie': sessionCookie },
    })
    const retryText = retryResponse.body
    logger.info(`[WOLFPACK-HTTP] Retry response: ${retryText}`)

    let retryMap: number[]
    try {
      retryMap = JSON.parse(retryText)
    } catch {
      return { success: false, error: `Invalid JSON on retry: ${retryText}`, response: retryText }
    }

    if (retryMap[output0Based] === input0Based) {
      logger.info(`[WOLFPACK-HTTP] Verified on retry: output ${output0Based} is now routed to input ${input0Based}`)
      return {
        success: true,
        command: `HTTP o2ox: ${input0Based},${output0Based}`,
        response: retryText,
      }
    } else {
      const actual = retryMap[output0Based]
      logger.error(`[WOLFPACK-HTTP] Verification FAILED after retry: output ${output0Based} is routed to input ${actual}, expected ${input0Based}`)
      return {
        success: false,
        error: `Route verification failed: output ${output0Based} mapped to input ${actual}, expected ${input0Based}`,
        command: `HTTP o2ox: ${input0Based},${output0Based}`,
        response: retryText,
      }
    }
  } catch (error) {
    logger.error('[WOLFPACK-HTTP] Error:', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'HTTP request failed',
    }
  }
}

/**
 * Routes a Wolfpack input to a Matrix output
 * Matrix outputs 1-4 on Wolfpack correspond to Matrix inputs 1-4 on Atlas
 */
export async function routeWolfpackToMatrix(
  config: MatrixConfiguration,
  wolfpackInputNumber: number,
  matrixOutputNumber: number,
  inputLabel: string
): Promise<RoutingResult> {
  try {
    logger.info(`Routing Wolfpack input ${wolfpackInputNumber} (${inputLabel}) to Matrix output ${matrixOutputNumber}`)

    // HTTP API path: convert 1-based system indices to 0-based wire indices
    if (config.protocol === 'HTTP') {
      const offset = config.outputOffset || 0
      const wolfpackOutput = offset + matrixOutputNumber
      const input0Based = wolfpackInputNumber - 1
      const output0Based = wolfpackOutput - 1

      logger.info(`[WOLFPACK-HTTP] Converting: input ${wolfpackInputNumber}->0b:${input0Based}, output ${wolfpackOutput}->0b:${output0Based}`)

      const result = await sendHTTPCommand(config.ipAddress, input0Based, output0Based, config.credentials)

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to send HTTP command to Wolfpack',
          command: result.command,
        }
      }

      logger.info(`Successfully routed ${inputLabel} to Matrix ${matrixOutputNumber} via HTTP`)
      return result
    }

    // TCP/UDP path (legacy)
    // Build the routing command using correct Wolfpack protocol
    // Format: "[input]X[output]." (period required, \r\n added by sendWolfpackCommand)
    // outputOffset handles multi-card matrices (e.g., Graystone uses +32 for audio outputs 33-36)
    const offset = config.outputOffset || 0
    const wolfpackOutput = offset + matrixOutputNumber
    const command = `${wolfpackInputNumber}X${wolfpackOutput}.`

    logger.info(`Sending command to Wolfpack: ${command}`)

    // Send the command via TCP/UDP
    const result = await sendWolfpackCommand(config, command)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send command to Wolfpack',
        command
      }
    }

    logger.info(`Successfully routed ${inputLabel} to Matrix ${matrixOutputNumber}`)

    return {
      success: true,
      command,
      response: result.response
    }

  } catch (error) {
    logger.error('Error in routeWolfpackToMatrix:', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sends a command to the Wolfpack matrix switcher
 */
async function sendWolfpackCommand(
  config: MatrixConfiguration,
  command: string
): Promise<RoutingResult> {
  try {
    logger.info(`Sending to ${config.ipAddress}:${config.tcpPort} via ${config.protocol}`)
    logger.info(`Command: ${command}`)

    const port = config.protocol === 'TCP' ? config.tcpPort : config.udpPort

    if (config.protocol === 'TCP') {
      return await sendTCPCommand(config.ipAddress, port, command)
    } else {
      return await sendUDPCommand(config.ipAddress, port, command)
    }

  } catch (error) {
    logger.error('Error sending Wolfpack command:', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      command
    }
  }
}

/**
 * Sends a TCP command to the Wolfpack matrix switcher
 */
async function sendTCPCommand(
  ipAddress: string,
  port: number,
  command: string
): Promise<RoutingResult> {
  const net = require('net')

  return new Promise((resolve) => {
    // Wave 3c TCP-close fix: single `resolved` guard + guaranteed destroy() on
    // every exit path (mirrors sendUDPCommand). Prevents the 'data'-then-'close'
    // double-resolve and the leaked half-open socket on 'error' that the verify
    // loop's rapid re-issue would otherwise accumulate. Result VALUES unchanged.
    let resolved = false
    let response = ''
    let client: any

    const finish = (result: RoutingResult) => {
      if (resolved) return
      resolved = true
      try { client?.destroy() } catch { /* socket already gone */ }
      resolve(result)
    }

    client = net.createConnection({ port, host: ipAddress }, () => {
      logger.info(`TCP Connected to Wolfpack at ${ipAddress}:${port}`)
      logger.info(`Sending command: "${command}" (with \\r\\n)`)
      client.write(command + '\r\n')
    })

    client.setTimeout(10000) // 10 second timeout

    client.on('data', (data: Buffer) => {
      response += data.toString()
      logger.info(`Wolfpack TCP response: ${response}`)
      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        if (response.includes('OK')) {
          finish({ success: true, response: response.trim(), command })
        } else {
          logger.error(`Wolfpack command failed: ${response}`)
          finish({ success: false, error: `Command failed: ${response.trim()}`, response: response.trim(), command })
        }
      }
    })

    client.on('timeout', () => {
      logger.error(`TCP connection timeout. Response so far: "${response}"`)
      finish({ success: false, error: `Command timeout (10000ms). Response: ${response}`, response: response.trim(), command })
    })

    client.on('error', (err: Error) => {
      logger.error('TCP connection error:', { error: err.message })
      finish({ success: false, error: `TCP error: ${err.message}`, command })
    })

    client.on('close', () => {
      // Fallback only when the device closed without an in-band OK/ERR — preserve
      // the prior "any response byte = success" semantic.
      logger.info(`Connection closed. Response received: "${response}"`)
      finish({ success: response.length > 0, response: response.trim(), command })
    })
  })
}

/**
 * Sends a UDP command to the Wolfpack matrix switcher
 */
async function sendUDPCommand(
  ipAddress: string,
  port: number,
  command: string
): Promise<RoutingResult> {
  const dgram = require('dgram')

  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4')

    // Add \r\n for proper protocol
    const commandWithLineEnding = command + '\r\n'
    const message = Buffer.from(commandWithLineEnding)

    client.send(message, port, ipAddress, (err: Error | null) => {
      if (err) {
        logger.error('UDP send error:', { error: err.message })
        client.close()
        resolve({
          success: false,
          error: `UDP send error: ${err.message}`,
          command
        })
        return
      }

      logger.info(`UDP command sent to Wolfpack at ${ipAddress}:${port}: ${command}`)
    })

    // Listen for response
    client.on('message', (data: Buffer, rinfo: { address: string; port: number }) => {
      const response = data.toString().trim()
      logger.info(`Wolfpack UDP response from ${rinfo.address}:${rinfo.port}: ${response}`)

      client.close()

      // Wolfpack returns "OK" for success, "ERR" for failure
      if (response.includes('OK')) {
        resolve({
          success: true,
          response,
          command
        })
      } else {
        logger.error(`Wolfpack command failed: ${response}`)
        resolve({
          success: false,
          error: `Command failed: ${response}`,
          response,
          command
        })
      }
    })

    client.on('error', (err: Error) => {
      logger.error('UDP error:', { error: err.message })
      client.close()
      resolve({
        success: false,
        error: `UDP error: ${err.message}`,
        command
      })
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      logger.error('UDP response timeout')
      client.close()
      resolve({
        success: false,
        error: 'UDP response timeout (5000ms)',
        command
      })
    }, 5000)
  })
}

/**
 * Query the Wolf Pack matrix for its full live routing state via the HTTP API.
 *
 * Calls `/get_json_cmd.php?cmd=o2ox` with NO `prm` parameter — on the Wolf Pack
 * FM36S and similar, this is a read-only state query that returns the current
 * routing array without toggling anything. When `prm` is present the command
 * applies (or toggles) a route; when absent it reports.
 *
 * Returns an array of length `outputCount` where each element is the 0-based
 * input currently routed to that 0-based output position. Callers convert to
 * 1-based numbering and apply `outputOffset` themselves if needed.
 *
 * Throws on network failure, login failure, or malformed response so the
 * caller can fall back to a DB cache or surface the error. Do NOT swallow
 * errors here — the "Routing tab shows stale cache" problem we had before
 * was exactly because failures were silently returning an empty state.
 */
export async function queryWolfpackRouteState(
  config: Pick<MatrixConfiguration, 'ipAddress' | 'credentials'>
): Promise<number[]> {
  // Serialized per-IP (see acquireWolfPackHttpLock): this READ must never open
  // a second concurrent Wolf Pack session while a sendHTTPCommand() WRITE is in
  // flight, or the firmware returns stale route state and the write toggles a
  // good route off (TV goes black — the Greenville/Appleton Video-tab symptom).
  const release = await acquireWolfPackHttpLock(config.ipAddress)
  try {
    return await queryWolfpackRouteStateInner(config)
  } finally {
    release()
  }
}

async function queryWolfpackRouteStateInner(
  config: Pick<MatrixConfiguration, 'ipAddress' | 'credentials'>
): Promise<number[]> {
  const creds = config.credentials || { username: 'admin', password: 'admin' }

  const loginResponse = await httpRequest({
    hostname: config.ipAddress,
    path: '/login.php',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`,
  })

  const setCookieHeader = loginResponse.headers['set-cookie']
  const setCookie = Array.isArray(setCookieHeader) ? setCookieHeader.join(', ') : (setCookieHeader || '')
  const sessionMatch = setCookie.match(/PHPSESSID=([^;]+)/)
  if (!sessionMatch) {
    throw new Error(`[WOLFPACK-HTTP] Login failed - no PHPSESSID in response from ${config.ipAddress}`)
  }
  const sessionCookie = `PHPSESSID=${sessionMatch[1]}`

  await httpRequest({
    hostname: config.ipAddress,
    path: '/index.php',
    method: 'GET',
    headers: { 'Cookie': sessionCookie },
  })

  const queryResponse = await httpRequest({
    hostname: config.ipAddress,
    path: '/get_json_cmd.php?cmd=o2ox',
    method: 'GET',
    headers: { 'Cookie': sessionCookie },
  })

  let routingArray: unknown
  try {
    routingArray = JSON.parse(queryResponse.body)
  } catch {
    throw new Error(`[WOLFPACK-HTTP] Query returned non-JSON body: ${queryResponse.body.slice(0, 200)}`)
  }

  if (!Array.isArray(routingArray) || routingArray.some(v => typeof v !== 'number')) {
    throw new Error(`[WOLFPACK-HTTP] Query returned unexpected shape: ${queryResponse.body.slice(0, 200)}`)
  }

  // Wolf Pack firmware quirk: immediately after a route change, the o2ox array
  // can return 65535 (0xFFFF) at the just-changed output's index as a "pending /
  // not yet committed" sentinel while the internal HDMI crossbar settles
  // (~500ms window per switch). If we pass that through to the UI it becomes
  // inputNum 65536, which matches no real input and makes the output look
  // unrouted. Normalize 65535 to -1 so /api/matrix/routes can filter those
  // positions out of its response.
  //
  // The sentinel is benign and self-clearing — the next query (once the
  // firmware commits) returns the real input index. Logging was originally at
  // WARN level while we were diagnosing the stuck-output-1 symptom at Stoneyard
  // Appleton; now that we understand this is normal firmware behavior during
  // the ~500ms post-route settling window, it's been demoted to DEBUG so it
  // stops spamming the PM2 log. If you need to see it, set LOG_LEVEL=DEBUG in
  // .env (ecosystem.config.js reads that through). Persistent 65535 (same
  // output repeatedly across many seconds of queries with no route commands
  // issued) WOULD indicate a real firmware hang and should be investigated —
  // but you'll need to raise the log level to see it first.
  let rawArray = routingArray as number[]

  // Wolf Pack firmware quirk: the first o2ox query after login + index.php
  // often returns 65535 (0xFFFF) for one or more outputs — especially output 1.
  // This is NOT from a route change; it's the firmware's "session init" settling.
  // Retry with backoff: a single 600ms re-query covers the common settling
  // window, but Holmgren has reproduced cases where the firmware stays stuck
  // 2-3s. Up to 3 retries (600ms, 1.2s, 2.4s, total ~4.2s worst case)
  // catches all observed cases without forcing the DB-fallback path. After
  // the last retry, any remaining sentinel falls through to the existing
  // 65535→-1 normalization and DB fallback in /api/matrix/routes.
  const RETRY_DELAYS_MS = [600, 1200, 2400]
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (!rawArray.some(v => v === 65535)) break

    const delay = RETRY_DELAYS_MS[attempt]
    if (attempt === 0) {
      const sentinelOutputs = rawArray
        .map((v, i) => (v === 65535 ? i + 1 : -1))
        .filter(i => i > 0)
      logger.info(`[WOLFPACK-HTTP] Initial query has 0xFFFF sentinel(s) at output(s) ${sentinelOutputs.join(',')} — re-querying with backoff (up to ${RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)}ms)`)
    }

    await new Promise(resolve => setTimeout(resolve, delay))

    const retryResponse = await httpRequest({
      hostname: config.ipAddress,
      path: '/get_json_cmd.php?cmd=o2ox',
      method: 'GET',
      headers: { 'Cookie': sessionCookie },
    })

    try {
      const retryArray = JSON.parse(retryResponse.body)
      if (Array.isArray(retryArray) && retryArray.every(v => typeof v === 'number')) {
        rawArray = retryArray
        const stillSentinel = rawArray.filter(v => v === 65535).length
        if (stillSentinel === 0) {
          logger.info(`[WOLFPACK-HTTP] Sentinels cleared after attempt ${attempt + 1} (${delay}ms)`)
          break
        }
        if (attempt === RETRY_DELAYS_MS.length - 1) {
          logger.warn(`[WOLFPACK-HTTP] ${stillSentinel} sentinel(s) persist after ${RETRY_DELAYS_MS.length} retries — falling through to DB fallback`)
        }
      }
    } catch {
      logger.warn(`[WOLFPACK-HTTP] Retry ${attempt + 1} returned non-JSON, continuing`)
    }
  }

  const normalized = rawArray.map(v => (v === 65535 ? -1 : v))
  logger.info(`[WOLFPACK-HTTP] Queried route state from ${config.ipAddress}: ${normalized.length} outputs`)
  return normalized
}

/**
 * Legacy 4-output state shim — kept for compatibility with older callers that
 * only cared about the 4 Atlas-feed outputs. New callers should use
 * queryWolfpackRouteState() directly and index by the full output range.
 */
export async function getMatrixRoutingState(): Promise<{
  [matrixOutput: number]: {
    wolfpackInput: number | null
    inputLabel: string | null
  }
}> {
  return {
    1: { wolfpackInput: null, inputLabel: null },
    2: { wolfpackInput: null, inputLabel: null },
    3: { wolfpackInput: null, inputLabel: null },
    4: { wolfpackInput: null, inputLabel: null }
  }
}

// Export types for external use
export type { MatrixConfiguration, RoutingResult }
