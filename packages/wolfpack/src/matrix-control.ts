/**
 * Wolf Pack Matrix Control - Shared routing logic
 */

import { db, schema, eq, withTransaction } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { randomUUID } from 'crypto'

/**
 * Route matrix input to output
 */
export async function routeMatrix(inputNum: number, outputNum: number): Promise<boolean> {
  try {
    // Validate input parameters
    if (!inputNum || !outputNum || inputNum < 1 || outputNum < 1 || inputNum > 32 || outputNum > 32) {
      logger.error(`Invalid input (${inputNum}) or output (${outputNum}) channel`)
      return false
    }

    // Get active matrix configuration
    const activeConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!activeConfig) {
      logger.error('No active matrix configuration found')
      return false
    }

    // IMPORTANT: Hardware commands must happen OUTSIDE the transaction because they are async.
    // Step 1: Send the Wolf Pack command first (async operation)
    const wolfPackCommand = `${inputNum}X${outputNum}.`
    const commandSuccess = await sendWolfPackCommand(
      activeConfig.ipAddress,
      activeConfig.protocol === 'UDP' ? (activeConfig.udpPort || 4000) : (activeConfig.tcpPort || 5000),
      wolfPackCommand,
      activeConfig.protocol || 'TCP'
    )

    if (!commandSuccess) {
      logger.error(`Failed to send Wolf Pack command: ${wolfPackCommand}`)
      return false
    }

    // Step 2: Update database in synchronous transaction (hardware command succeeded)
    const result = withTransaction((tx) => {
      const now = new Date().toISOString()

      // Check if route already exists
      const existingRoute = tx.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.outputNum, outputNum))
        .limit(1)
        .get()

      if (existingRoute) {
        // Update existing route
        tx.update(schema.matrixRoutes)
          .set({
            inputNum: inputNum,
            isActive: true,
            updatedAt: now
          })
          .where(eq(schema.matrixRoutes.id, existingRoute.id))
          .run()
      } else {
        // Create new route
        tx.insert(schema.matrixRoutes)
          .values({
            id: randomUUID(),
            inputNum: inputNum,
            outputNum: outputNum,
            isActive: true,
            createdAt: now,
            updatedAt: now
          })
          .run()
      }

      logger.info(`Successfully routed input ${inputNum} to output ${outputNum}`)
      return true
    }, {
      name: `matrix-route-${inputNum}-to-${outputNum}`,
      maxRetries: 2
    })

    return result

  } catch (error) {
    logger.error('Error routing signal:', { error })
    return false
  }
}

/**
 * Send command to Wolf Pack matrix
 */
async function sendWolfPackCommand(ipAddress: string, port: number, command: string, protocol: string = 'TCP'): Promise<boolean> {
  logger.debug(`Sending Wolf Pack command: ${command} to ${ipAddress}:${port} via ${protocol}`)

  if (protocol.toLowerCase() === 'udp') {
    return await sendUDPCommand(ipAddress, port, command)
  } else {
    return await sendTCPCommand(ipAddress, port, command)
  }
}

/**
 * TCP Communication with Wolf Pack
 */
async function sendTCPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  const net = require('net')

  return new Promise((resolve, reject) => {
    let responseReceived = false
    let response = ''

    const client = net.createConnection({ port, host: ipAddress }, () => {
      logger.debug(`TCP Connected to Wolf Pack at ${ipAddress}:${port}`)
      const commandWithLineEnding = command + '\r\n'
      logger.debug(`Sending command: "${command}" (with \\r\\n)`)
      client.write(commandWithLineEnding)
    })

    client.setTimeout(10000) // 10 second timeout

    client.on('data', (data: Buffer) => {
      response += data.toString()
      logger.debug(`Wolf Pack TCP response: ${response}`)

      if (response.includes('OK') || response.includes('ERR') || response.includes('Error')) {
        responseReceived = true
        client.end()

        if (response.includes('OK')) {
          resolve(true)
        } else {
          logger.error(`Wolf Pack command failed: ${response}`)
          resolve(false)
        }
      }
    })

    client.on('timeout', () => {
      logger.error(`TCP connection timeout. Response so far: "${response}"`)
      client.destroy()
      resolve(false)
    })

    client.on('error', (err: Error) => {
      logger.error('TCP connection error:', { error: err.message })
      resolve(false)
    })

    client.on('close', () => {
      if (!responseReceived && response.length > 0) {
        logger.debug(`Connection closed. Response received: "${response}"`)
        resolve(response.length > 0)
      }
    })
  })
}

/**
 * UDP Communication with Wolf Pack
 */
async function sendUDPCommand(ipAddress: string, port: number, command: string): Promise<boolean> {
  const dgram = require('dgram')

  return new Promise((resolve) => {
    let resolved = false // Flag to prevent double resolution
    const client = dgram.createSocket('udp4')

    const commandWithLineEnding = command + '\r\n'
    const message = Buffer.from(commandWithLineEnding)

    client.send(message, port, ipAddress, (err: Error | null) => {
      if (err) {
        logger.error('UDP send error:', { error: err.message })
        client.close()
        if (!resolved) {
          resolved = true
          resolve(false)
        }
        return
      }

      logger.debug(`UDP command sent to Wolf Pack at ${ipAddress}:${port}: ${command}`)
    })

    client.on('message', (data: Buffer, rinfo: { address: string; port: number }) => {
      if (resolved) return // Prevent double resolution
      resolved = true

      const response = data.toString().trim()
      logger.debug(`Wolf Pack UDP response from ${rinfo.address}:${rinfo.port}: ${response}`)

      clearTimeout(timeoutId)
      client.close()

      if (response.includes('OK')) {
        resolve(true)
      } else {
        logger.error(`Wolf Pack command failed: ${response}`)
        resolve(false)
      }
    })

    client.on('error', (err: Error) => {
      if (resolved) return // Prevent double resolution
      resolved = true

      logger.error('UDP error:', { error: err.message })
      clearTimeout(timeoutId)
      client.close()
      resolve(false)
    })

    // Timeout after 5 seconds
    const timeoutId = setTimeout(() => {
      if (resolved) return // Prevent double resolution
      resolved = true

      logger.error('UDP response timeout')
      client.close()
      resolve(false)
    }, 5000)
  })
}
