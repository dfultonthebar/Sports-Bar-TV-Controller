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
 * Sends an HTTP command to the Wolf Pack matrix via its web API.
 * The HTTP API uses 0-based indices for both input and output.
 * This function accepts 0-based indices directly.
 *
 * Uses Node's native http module instead of fetch() to avoid
 * Next.js fetch interception that breaks session-based auth.
 */
export async function sendHTTPCommand(
  ipAddress: string,
  input0Based: number,
  output0Based: number
): Promise<RoutingResult> {
  try {
    // Step 1: Login to get PHP session cookie
    logger.info(`[WOLFPACK-HTTP] Logging in to http://${ipAddress}/login.php`)
    const loginResponse = await httpRequest({
      hostname: ipAddress,
      path: '/login.php',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin',
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

    // Step 2: Send routing command
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

    // Step 3: Parse and verify
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

    // Verify the route took effect
    if (routingMap[output0Based] === input0Based) {
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

      const result = await sendHTTPCommand(config.ipAddress, input0Based, output0Based)

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
    let responseReceived = false
    let response = ''

    const client = net.createConnection({ port, host: ipAddress }, () => {
      logger.info(`TCP Connected to Wolfpack at ${ipAddress}:${port}`)
      // Add \r\n for proper Telnet/TCP protocol
      const commandWithLineEnding = command + '\r\n'
      logger.info(`Sending command: "${command}" (with \\r\\n)`)
      client.write(commandWithLineEnding)
    })

    client.setTimeout(10000) // 10 second timeout

    client.on('data', (data: Buffer) => {
      response += data.toString()
      logger.info(`Wolfpack TCP response: ${response}`)

      // Check for response completion
      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        responseReceived = true
        client.end()

        // Wolfpack returns "OK" for success, "ERR" for failure
        if (response.includes('OK')) {
          resolve({
            success: true,
            response: response.trim(),
            command
          })
        } else {
          logger.error(`Wolfpack command failed: ${response}`)
          resolve({
            success: false,
            error: `Command failed: ${response.trim()}`,
            response: response.trim(),
            command
          })
        }
      }
    })

    client.on('timeout', () => {
      logger.error(`TCP connection timeout. Response so far: "${response}"`)
      client.destroy()
      resolve({
        success: false,
        error: `Command timeout (10000ms). Response: ${response}`,
        response: response.trim(),
        command
      })
    })

    client.on('error', (err: Error) => {
      logger.error('TCP connection error:', { error: err.message })
      resolve({
        success: false,
        error: `TCP error: ${err.message}`,
        command
      })
    })

    client.on('close', () => {
      if (!responseReceived && response.length > 0) {
        logger.info(`Connection closed. Response received: "${response}"`)
        // If we got some response but no explicit OK/ERR, consider it based on content
        resolve({
          success: response.length > 0,
          response: response.trim(),
          command
        })
      }
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
 * Gets the current routing state for all Matrix outputs
 */
export async function getMatrixRoutingState(): Promise<{
  [matrixOutput: number]: {
    wolfpackInput: number | null
    inputLabel: string | null
  }
}> {
  // This would query the Wolfpack device for current routing state
  // For now, return empty state
  return {
    1: { wolfpackInput: null, inputLabel: null },
    2: { wolfpackInput: null, inputLabel: null },
    3: { wolfpackInput: null, inputLabel: null },
    4: { wolfpackInput: null, inputLabel: null }
  }
}

// Export types for external use
export type { MatrixConfiguration, RoutingResult }
