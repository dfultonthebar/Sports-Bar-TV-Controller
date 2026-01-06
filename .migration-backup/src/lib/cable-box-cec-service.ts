/**
 * Cable Box CEC Controller Service
 *
 * Manages multiple Pulse-Eight USB CEC adapters for cable box control.
 * Each adapter is dedicated to controlling one cable box.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { enhancedLogger } from './enhanced-logger'
import { SPECTRUM_COMMANDS, buildChannelSequence, CEC_DELAYS, buildCECCommand, CEC_USER_CONTROL_CODES } from './cec-commands'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec)

export interface CableBoxDevice {
  id: string
  name: string
  devicePath: string
  provider: string
  model: string
  isOnline: boolean
  lastChannel?: string
  matrixInputId?: string
}

export interface CECCommandResult {
  success: boolean
  executionTime: number
  deviceResponded: boolean
  output: string
  error?: string
  cecCode?: string
}

export class CableBoxCECService {
  private static instance: CableBoxCECService
  private commandQueues: Map<string, Promise<any>> = new Map()
  private cecClientPath = 'cec-client'

  private constructor() {}

  static getInstance(): CableBoxCECService {
    if (!CableBoxCECService.instance) {
      CableBoxCECService.instance = new CableBoxCECService()
    }
    return CableBoxCECService.instance
  }

  /**
   * Discover all connected Pulse-Eight USB CEC adapters
   */
  async discoverAdapters(): Promise<{ devicePath: string; info: string }[]> {
    try {
      const { stdout } = await execAsync(`${this.cecClientPath} -l`)
      const adapters: { devicePath: string; info: string }[] = []

      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes('com port:')) {
          const match = line.match(/com port:\s*(.+)/)
          if (match) {
            adapters.push({
              devicePath: match[1].trim(),
              info: line,
            })
          }
        }
      }

      return adapters
    } catch (error: any) {
      logger.error('Error discovering CEC adapters:', error.message)
      return []
    }
  }

  /**
   * Get all configured cable boxes from database
   */
  async getCableBoxes(): Promise<CableBoxDevice[]> {
    try {
      const results = await db
        .select({
          id: schema.cableBoxes.id,
          name: schema.cableBoxes.name,
          devicePath: schema.cecDevices.devicePath,
          provider: schema.cableBoxes.provider,
          model: schema.cableBoxes.model,
          isOnline: schema.cableBoxes.isOnline,
          lastChannel: schema.cableBoxes.lastChannel,
          matrixInputId: schema.cableBoxes.matrixInputId,
        })
        .from(schema.cableBoxes)
        .leftJoin(schema.cecDevices, eq(schema.cableBoxes.cecDeviceId, schema.cecDevices.id))
        .where(eq(schema.cecDevices.isActive, true))
        .execute()

      return results.map((row) => ({
        id: row.id,
        name: row.name,
        devicePath: row.devicePath || '',
        provider: row.provider,
        model: row.model,
        isOnline: Boolean(row.isOnline),
        lastChannel: row.lastChannel || undefined,
        matrixInputId: row.matrixInputId || undefined,
      }))
    } catch (error: any) {
      logger.error('Error fetching cable boxes:', error.message)
      return []
    }
  }

  /**
   * Get a specific cable box by ID
   */
  async getCableBox(id: string): Promise<CableBoxDevice | null> {
    const boxes = await this.getCableBoxes()
    return boxes.find((box) => box.id === id) || null
  }

  /**
   * Send a raw CEC command to a specific device
   */
  private async sendCECCommand(
    devicePath: string,
    command: string,
    timeout: number = 5000
  ): Promise<CECCommandResult> {
    const startTime = Date.now()

    try {
      const { stdout, stderr } = await execAsync(
        `echo '${command}' | ${this.cecClientPath} -d 1 -s ${devicePath}`,
        { timeout }
      )

      const executionTime = Date.now() - startTime

      // Parse output for device responses (same logic as cec-client.ts)
      const deviceResponded =
        stdout.includes('TRAFFIC') ||        // Traffic on CEC bus
        stdout.includes('>> ') ||             // Outgoing command
        stdout.includes('<< ') ||             // Incoming response
        stdout.includes('key pressed:') ||    // Key press acknowledgment
        stdout.includes('waiting for input')  // Command sent successfully

      const success = !stderr.includes('ERROR') && !stdout.includes('TRANSMIT_FAILED')

      return {
        success,
        executionTime,
        deviceResponded,
        output: stdout,
        cecCode: command,
        error: success ? undefined : stderr || 'Command transmission failed',
      }
    } catch (error: any) {
      const partialOutput = error.stdout || ''
      const deviceResponded = partialOutput.includes('TRAFFIC') || partialOutput.includes('<<')

      return {
        success: false,
        executionTime: Date.now() - startTime,
        deviceResponded,
        output: partialOutput,
        error: error.message,
      }
    }
  }

  /**
   * Queue a command for a specific device to prevent concurrent commands
   */
  private async queueCommand<T>(
    devicePath: string,
    command: () => Promise<T>
  ): Promise<T> {
    // Wait for any existing command on this device to complete
    const existingQueue = this.commandQueues.get(devicePath)
    if (existingQueue) {
      await existingQueue.catch(() => {}) // Ignore errors from previous commands
    }

    // Execute the new command
    const promise = command()
    this.commandQueues.set(devicePath, promise)

    try {
      return await promise
    } finally {
      // Clean up if this was the last command
      if (this.commandQueues.get(devicePath) === promise) {
        this.commandQueues.delete(devicePath)
      }
    }
  }

  /**
   * Log command execution to database and enhanced logger
   */
  private async logCommand(
    cableBoxId: string,
    command: string,
    result: CECCommandResult,
    params?: any
  ): Promise<void> {
    try {
      const box = await this.getCableBox(cableBoxId)
      if (!box) return

      // Get CEC device ID
      const cecDevice = await db
        .select()
        .from(schema.cecDevices)
        .where(eq(schema.cecDevices.devicePath, box.devicePath))
        .limit(1)
        .execute()

      if (cecDevice.length === 0) return

      // Log to CECCommandLog table for CEC-specific analytics
      await db.insert(schema.cecCommandLogs).values({
        cecDeviceId: cecDevice[0].id,
        command,
        cecCode: result.cecCode,
        params: params ? JSON.stringify(params) : undefined,
        success: result.success,
        responseTime: result.executionTime,
        errorMessage: result.error,
      })

      // Log to enhanced-logger for System Admin analytics
      await enhancedLogger.log({
        level: result.success ? 'info' : 'error',
        category: 'cec',
        source: 'cable-box-cec-service',
        action: command,
        message: `CEC ${command} command to cable box ${box.name} ${result.success ? 'succeeded' : 'failed'}`,
        details: {
          cableBoxId: box.id,
          cableBoxName: box.name,
          devicePath: box.devicePath,
          provider: box.provider,
          deviceResponded: result.deviceResponded,
          params,
          errorMessage: result.error
        },
        deviceType: 'tv',  // Using 'tv' device type for cable boxes (same category)
        deviceId: cecDevice[0].id,
        success: result.success,
        duration: result.executionTime,
        errorStack: result.error
      })
    } catch (error: any) {
      logger.error('Error logging CEC command:', error.message)
    }
  }

  /**
   * Tune cable box to a specific channel
   */
  async tuneChannel(cableBoxId: string, channel: string): Promise<CECCommandResult> {
    const box = await this.getCableBox(cableBoxId)
    if (!box) {
      return {
        success: false,
        executionTime: 0,
        deviceResponded: false,
        output: '',
        error: `Cable box ${cableBoxId} not found`,
      }
    }

    if (!box.devicePath) {
      return {
        success: false,
        executionTime: 0,
        deviceResponded: false,
        output: '',
        error: `No CEC device path configured for ${box.name}`,
      }
    }

    return this.queueCommand(box.devicePath, async () => {
      const startTime = Date.now()
      const commands = buildChannelSequence(channel)

      logger.info(`[CEC] Tuning ${box.name} to channel ${channel} (${commands.length} commands)`)

      let lastResult: CECCommandResult = { success: true, executionTime: 0, deviceResponded: false, output: '' }

      // Send each digit with appropriate delay
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i]
        const isLastCommand = i === commands.length - 1

        lastResult = await this.sendCECCommand(box.devicePath, command)

        if (!lastResult.success) {
          logger.error(`[CEC] Failed to send command ${i + 1}/${commands.length}:`, lastResult.error)
          break
        }

        // Add delay between commands (longer after ENTER)
        if (!isLastCommand) {
          const delay = isLastCommand ? CEC_DELAYS.AFTER_ENTER : CEC_DELAYS.BETWEEN_DIGITS
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      const totalExecutionTime = Date.now() - startTime

      // Update last channel in database if successful
      if (lastResult.success) {
        await db
          .update(schema.cableBoxes)
          .set({ lastChannel: channel, updatedAt: new Date().toISOString() })
          .where(eq(schema.cableBoxes.id, cableBoxId))
          .execute()
      }

      const finalResult = {
        ...lastResult,
        executionTime: totalExecutionTime,
      }

      // Log the command
      await this.logCommand(cableBoxId, 'tune_channel', finalResult, { channel })

      return finalResult
    })
  }

  /**
   * Send a navigation command (up, down, left, right, select, etc.)
   */
  async sendNavigationCommand(
    cableBoxId: string,
    command: keyof typeof SPECTRUM_COMMANDS
  ): Promise<CECCommandResult> {
    const box = await this.getCableBox(cableBoxId)
    if (!box) {
      return {
        success: false,
        executionTime: 0,
        deviceResponded: false,
        output: '',
        error: `Cable box ${cableBoxId} not found`,
      }
    }

    return this.queueCommand(box.devicePath, async () => {
      const cecCommand = SPECTRUM_COMMANDS[command]
      if (!cecCommand) {
        return {
          success: false,
          executionTime: 0,
          deviceResponded: false,
          output: '',
          error: `Unknown command: ${command}`,
        }
      }

      const cmdResult = typeof cecCommand === 'function' ? cecCommand() : cecCommand

      // Handle array of commands (for channel tuning)
      if (Array.isArray(cmdResult)) {
        return this.tuneChannel(cableBoxId, '') // This shouldn't happen for navigation commands
      }

      const result = await this.sendCECCommand(box.devicePath, cmdResult)
      await this.logCommand(cableBoxId, command, result)
      return result
    })
  }

  /**
   * Send a custom CEC user control code
   */
  async sendCustomCommand(
    cableBoxId: string,
    userControlCode: string
  ): Promise<CECCommandResult> {
    const box = await this.getCableBox(cableBoxId)
    if (!box) {
      return {
        success: false,
        executionTime: 0,
        deviceResponded: false,
        output: '',
        error: `Cable box ${cableBoxId} not found`,
      }
    }

    return this.queueCommand(box.devicePath, async () => {
      const cecCommand = buildCECCommand(userControlCode)
      const result = await this.sendCECCommand(box.devicePath, cecCommand)
      await this.logCommand(cableBoxId, 'custom_command', result, { userControlCode })
      return result
    })
  }

  /**
   * Test connectivity to a cable box
   */
  async testConnection(cableBoxId: string): Promise<CECCommandResult> {
    const box = await this.getCableBox(cableBoxId)
    if (!box) {
      return {
        success: false,
        executionTime: 0,
        deviceResponded: false,
        output: '',
        error: `Cable box ${cableBoxId} not found`,
      }
    }

    try {
      // Try to scan for devices on this adapter
      const startTime = Date.now()
      const { stdout, stderr } = await execAsync(
        `echo "scan" | ${this.cecClientPath} -d 1 -s ${box.devicePath}`,
        { timeout: 10000 }
      )

      const executionTime = Date.now() - startTime
      const success = !stderr.includes('ERROR') && stdout.includes('device')
      const deviceResponded = stdout.includes('device #')

      // Update online status
      await db
        .update(schema.cableBoxes)
        .set({ isOnline: success, updatedAt: new Date().toISOString() })
        .where(eq(schema.cableBoxes.id, cableBoxId))
        .execute()

      return {
        success,
        executionTime,
        deviceResponded,
        output: stdout,
        error: success ? undefined : 'No CEC device detected on this adapter',
      }
    } catch (error: any) {
      const partialOutput = error.stdout || ''
      return {
        success: false,
        executionTime: 0,
        deviceResponded: partialOutput.includes('device #'),
        output: partialOutput,
        error: error.message,
      }
    }
  }

  /**
   * Get command history for a cable box
   */
  async getCommandHistory(
    cableBoxId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const box = await this.getCableBox(cableBoxId)
      if (!box) return []

      const cecDevice = await db
        .select()
        .from(schema.cecDevices)
        .where(eq(schema.cecDevices.devicePath, box.devicePath))
        .limit(1)
        .execute()

      if (cecDevice.length === 0) return []

      const history = await db
        .select()
        .from(schema.cecCommandLogs)
        .where(eq(schema.cecCommandLogs.cecDeviceId, cecDevice[0].id))
        .orderBy(schema.cecCommandLogs.timestamp)
        .limit(limit)
        .execute()

      return history
    } catch (error: any) {
      logger.error('Error fetching command history:', error.message)
      return []
    }
  }
}
