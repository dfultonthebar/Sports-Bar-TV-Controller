/**
 * Command Scheduler Service
 * Executes scheduled commands at specified intervals
 */

import { db } from '@/db'
import { scheduledCommands, scheduledCommandLogs, matrixOutputs } from '@/db/schema'
import { eq, lte, and } from 'drizzle-orm'
import { exec } from 'child_process'
import { promisify } from 'util'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec)

interface ScheduledCommandExecution {
  commandId: string
  name: string
  commandType: string
  targets: any[]
  commandSequence: any[]
  executedAt: Date
  results: any[]
}

class CommandScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private checkIntervalMs = 60000 // Check every minute

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logger.info('Scheduler is already running')
      return
    }

    logger.info('Starting command scheduler...')
    this.isRunning = true

    // Clear existing interval if any to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    // Run immediately on start
    this.checkAndExecute()

    // Then run at interval
    this.intervalId = setInterval(() => {
      this.checkAndExecute()
    }, this.checkIntervalMs)

    logger.info(`Scheduler started (checking every ${this.checkIntervalMs / 1000}s)`)
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    logger.info('Scheduler stopped')
  }

  /**
   * Check for and execute due commands
   */
  private async checkAndExecute() {
    if (!this.isRunning) return

    try {
      const now = new Date().toISOString()

      // Find all enabled commands that are due for execution
      const dueCommands = await db
        .select()
        .from(scheduledCommands)
        .where(
          and(
            eq(scheduledCommands.enabled, true),
            lte(scheduledCommands.nextExecution, now)
          )
        )

      if (dueCommands.length === 0) {
        return
      }

      logger.info(`Found ${dueCommands.length} command(s) due for execution`)

      // Execute each command
      for (const command of dueCommands) {
        await this.executeCommand(command)
      }
    } catch (error) {
      logger.error('Error in scheduler check:', error)
    }
  }

  /**
   * Execute a scheduled command
   */
  private async executeCommand(command: any) {
    const startTime = Date.now()
    const executedAt = new Date()

    try {
      logger.info(`Executing scheduled command: ${command.name}`)

      let targets, commandSequence
      try {
        targets = JSON.parse(command.targets || '[]')
      } catch (parseError) {
        logger.error('Failed to parse command targets:', { data: { parseError, targets: command.targets?.substring(0, 100) } })
        targets = []
      }

      try {
        commandSequence = JSON.parse(command.commandSequence || '[]')
      } catch (parseError) {
        logger.error('Failed to parse command sequence:', { data: { parseError, sequence: command.commandSequence?.substring(0, 100) } })
        commandSequence = []
      }

      const results: any[] = []
      let commandsSent = 0
      let commandsFailed = 0

      // Execute based on command type
      switch (command.commandType) {
        case 'tv_power':
          const powerResults = await this.executeTVPowerCommands(targets, commandSequence)
          results.push(...powerResults.results)
          commandsSent = powerResults.sent
          commandsFailed = powerResults.failed
          break

        case 'cec':
          const cecResults = await this.executeCECCommands(targets, commandSequence)
          results.push(...cecResults.results)
          commandsSent = cecResults.sent
          commandsFailed = cecResults.failed
          break

        case 'matrix':
          const matrixResults = await this.executeMatrixCommands(targets, commandSequence)
          results.push(...matrixResults.results)
          commandsSent = matrixResults.sent
          commandsFailed = matrixResults.failed
          break

        case 'custom':
          const customResults = await this.executeCustomCommands(targets, commandSequence)
          results.push(...customResults.results)
          commandsSent = customResults.sent
          commandsFailed = customResults.failed
          break

        default:
          throw new Error(`Unknown command type: ${command.commandType}`)
      }

      const success = commandsFailed === 0
      const executionTime = Date.now() - startTime

      // Log execution
      await db.insert(scheduledCommandLogs).values({
        scheduledCommandId: command.id,
        executedAt: executedAt.toISOString(),
        success,
        commandsSent,
        commandsFailed,
        executionTime,
        details: JSON.stringify(results),
        targetResults: JSON.stringify(results),
      })

      // Update command execution stats and next execution time
      let scheduleData
      try {
        scheduleData = JSON.parse(command.scheduleData || '{}')
      } catch (parseError) {
        logger.error('Failed to parse schedule data:', { data: { parseError, data: command.scheduleData?.substring(0, 100) }
          })
        scheduleData = {}
      }
      const nextExecution = this.calculateNextExecution(
        command.scheduleType,
        scheduleData,
        command.timezone
      )

      await db
        .update(scheduledCommands)
        .set({
          lastExecuted: executedAt.toISOString(),
          nextExecution,
          executionCount: command.executionCount + 1,
          failureCount: success ? command.failureCount : command.failureCount + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledCommands.id, command.id))

      logger.info(
        `Command "${command.name}" executed: ${commandsSent} sent, ${commandsFailed} failed`
      )
    } catch (error: any) {
      logger.error(`Error executing command "${command.name}":`, error)

      // Log failed execution
      await db.insert(scheduledCommandLogs).values({
        scheduledCommandId: command.id,
        executedAt: executedAt.toISOString(),
        success: false,
        commandsSent: 0,
        commandsFailed: 1,
        executionTime: Date.now() - startTime,
        errorMessage: error.message,
        details: JSON.stringify({ error: error.message }),
      })

      // Update failure count
      await db
        .update(scheduledCommands)
        .set({
          failureCount: command.failureCount + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledCommands.id, command.id))
    }
  }

  /**
   * Execute TV power commands (CEC-based)
   */
  private async executeTVPowerCommands(targets: any[], commands: any[]) {
    const results = []
    let sent = 0
    let failed = 0

    for (const target of targets) {
      for (const cmd of commands) {
        try {
          const cecAddress = target.cecAddress || '0.0.0.0'
          const powerCmd = cmd.action === 'on' ? '04' : '36' // Standby=36, On=04

          const cecCommand = `echo 'tx ${cecAddress.replace(':', '')} ${powerCmd}' | cec-client -s -d 1`
          const { stdout } = await execAsync(cecCommand, { timeout: 5000 })

          results.push({
            target: target.name || target.id,
            command: cmd.action,
            success: true,
            output: stdout,
          })
          sent++
        } catch (error: any) {
          results.push({
            target: target.name || target.id,
            command: cmd.action,
            success: false,
            error: error.message,
          })
          failed++
        }
      }
    }

    return { results, sent, failed }
  }

  /**
   * Execute CEC commands
   */
  private async executeCECCommands(targets: any[], commands: any[]) {
    const results = []
    let sent = 0
    let failed = 0

    for (const target of targets) {
      for (const cmd of commands) {
        try {
          const cecCommand = `echo '${cmd.cecCommand}' | cec-client -s -d 1`
          const { stdout } = await execAsync(cecCommand, { timeout: 5000 })

          results.push({
            target: target.name || target.id,
            command: cmd.cecCommand,
            success: true,
            output: stdout,
          })
          sent++
        } catch (error: any) {
          results.push({
            target: target.name || target.id,
            command: cmd.cecCommand,
            success: false,
            error: error.message,
          })
          failed++
        }
      }
    }

    return { results, sent, failed }
  }

  /**
   * Execute matrix switching commands
   */
  private async executeMatrixCommands(targets: any[], commands: any[]) {
    const results = []
    let sent = 0
    let failed = 0

    // Get matrix configuration
    const matrixIP = process.env.MATRIX_IP || '192.168.1.100'
    const matrixPort = parseInt(process.env.MATRIX_PORT || '23')

    for (const target of targets) {
      for (const cmd of commands) {
        try {
          // Send matrix command via TCP
          const { stdout } = await execAsync(
            `echo '${cmd.matrixCommand}' | nc ${matrixIP} ${matrixPort}`,
            { timeout: 3000 }
          )

          results.push({
            target: target.name || target.id,
            command: cmd.matrixCommand,
            success: true,
            output: stdout,
          })
          sent++
        } catch (error: any) {
          results.push({
            target: target.name || target.id,
            command: cmd.matrixCommand,
            success: false,
            error: error.message,
          })
          failed++
        }
      }
    }

    return { results, sent, failed }
  }

  /**
   * Execute custom commands
   */
  private async executeCustomCommands(targets: any[], commands: any[]) {
    const results = []
    let sent = 0
    let failed = 0

    for (const target of targets) {
      for (const cmd of commands) {
        try {
          // Execute custom bash command (with security validation)
          const { stdout, stderr } = await execAsync(cmd.command, {
            timeout: cmd.timeout || 10000,
          })

          results.push({
            target: target.name || target.id,
            command: cmd.command,
            success: true,
            output: stdout,
            stderr,
          })
          sent++
        } catch (error: any) {
          results.push({
            target: target.name || target.id,
            command: cmd.command,
            success: false,
            error: error.message,
          })
          failed++
        }
      }
    }

    return { results, sent, failed }
  }

  /**
   * Calculate next execution time based on schedule type
   */
  private calculateNextExecution(scheduleType: string, scheduleData: any, timezone: string): string {
    const now = new Date()
    let nextExec = new Date(now)

    switch (scheduleType) {
      case 'once':
        // One-time: Disable after execution
        return new Date('2099-12-31').toISOString()

      case 'daily':
        const [hours, minutes] = scheduleData.time.split(':').map(Number)
        nextExec.setDate(nextExec.getDate() + 1)
        nextExec.setHours(hours, minutes, 0, 0)
        break

      case 'weekly':
        const daysOfWeek = scheduleData.daysOfWeek || []
        const [wHours, wMinutes] = scheduleData.time.split(':').map(Number)

        // Find next occurrence
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(now)
          checkDate.setDate(checkDate.getDate() + i)
          checkDate.setHours(wHours, wMinutes, 0, 0)

          if (daysOfWeek.includes(checkDate.getDay())) {
            nextExec = checkDate
            break
          }
        }
        break

      case 'monthly':
        const dayOfMonth = scheduleData.dayOfMonth || 1
        const [mHours, mMinutes] = scheduleData.time.split(':').map(Number)

        nextExec.setMonth(nextExec.getMonth() + 1)
        nextExec.setDate(dayOfMonth)
        nextExec.setHours(mHours, mMinutes, 0, 0)
        break

      default:
        // Default to next hour
        nextExec.setHours(nextExec.getHours() + 1, 0, 0, 0)
    }

    return nextExec.toISOString()
  }

  /**
   * Manually trigger a scheduled command
   */
  async triggerCommand(commandId: string) {
    const [command] = await db
      .select()
      .from(scheduledCommands)
      .where(eq(scheduledCommands.id, commandId))

    if (!command) {
      throw new Error('Command not found')
    }

    await this.executeCommand(command)
  }
}

// Export singleton instance
export const commandScheduler = new CommandScheduler()
