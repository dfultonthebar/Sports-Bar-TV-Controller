/**
 * Wolf Pack Matrix Control - Shared routing logic
 */

import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from './logger'
import { randomUUID } from 'crypto'
import { withTransaction } from './db/transaction-wrapper'

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

    // Use transaction to ensure atomicity between hardware command and database update
    return await withTransaction(async (tx) => {
      const now = new Date().toISOString()

      // First, send the Wolf Pack command
      const wolfPackCommand = `${inputNum}X${outputNum}.`
      const commandSuccess = await sendWolfPackCommand(
        activeConfig.ipAddress,
        activeConfig.protocol === 'UDP' ? (activeConfig.udpPort || 4000) : (activeConfig.tcpPort || 5000),
        wolfPackCommand,
        activeConfig.protocol || 'TCP'
      )

      if (!commandSuccess) {
        // Command failed - rollback transaction
        throw new Error(`Failed to send Wolf Pack command: ${wolfPackCommand}`)
      }

      // Command succeeded - update/create the route in database
      const existingRoute = await tx.select()
        .from(schema.matrixRoutes)
        .where(eq(schema.matrixRoutes.outputNum, outputNum))
        .limit(1)
        .get()

      if (existingRoute) {
        // Update existing route
        await tx.update(schema.matrixRoutes)
          .set({
            inputNum: inputNum,
            isActive: true,
            updatedAt: now
          })
          .where(eq(schema.matrixRoutes.id, existingRoute.id))
          .run()
      } else {
        // Create new route
        await tx.insert(schema.matrixRoutes)
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
      maxRetries: 2 // Hardware commands shouldn't retry too many times
    })

  } catch (error) {
    logger.error('Error routing signal:', error)
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

    client.on('data', (data) => {
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

    client.on('error', (err) => {
      logger.error('TCP connection error:', err.message)
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

  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4')

    const commandWithLineEnding = command + '\r\n'
    const message = Buffer.from(commandWithLineEnding)

    client.send(message, port, ipAddress, (err) => {
      if (err) {
        logger.error('UDP send error:', err.message)
        client.close()
        resolve(false)
        return
      }

      logger.debug(`UDP command sent to Wolf Pack at ${ipAddress}:${port}: ${command}`)
    })

    client.on('message', (data, rinfo) => {
      const response = data.toString().trim()
      logger.debug(`Wolf Pack UDP response from ${rinfo.address}:${rinfo.port}: ${response}`)

      client.close()

      if (response.includes('OK')) {
        resolve(true)
      } else {
        logger.error(`Wolf Pack command failed: ${response}`)
        resolve(false)
      }
    })

    client.on('error', (err) => {
      logger.error('UDP error:', err.message)
      client.close()
      resolve(false)
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      logger.error('UDP response timeout')
      client.close()
      resolve(false)
    }, 5000)
  })
}
