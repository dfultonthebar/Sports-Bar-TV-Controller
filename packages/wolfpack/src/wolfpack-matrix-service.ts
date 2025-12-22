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
}

interface RoutingResult {
  success: boolean
  error?: string
  command?: string
  response?: string
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

    // Wolfpack Matrix outputs are typically channels 33-36 (or configured range)
    // This maps to Matrix 1-4 outputs
    const wolfpackMatrixOutput = 32 + matrixOutputNumber // 33, 34, 35, 36

    // Build the routing command using correct Wolfpack protocol
    // Format: "[input]X[output]." (period required, \r\n added by sendWolfpackCommand)
    const command = `${wolfpackInputNumber}X${wolfpackMatrixOutput}.`

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
