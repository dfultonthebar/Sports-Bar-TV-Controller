/**
 * Keep-Awake Scheduler for Fire Cubes
 *
 * Manages scheduled wake/sleep cycles for Fire TV devices.
 * Uses dependency injection for database and connection management.
 */

import cron from 'node-cron'
import { ADBClient } from './adb-client'
import {
  ConnectionManagerAdapter,
  FireCubeRepository,
  FireCubeDevice,
  KeepAwakeStatus,
  KeepAwakeLog
} from './scheduler-types'
import { logger } from '@sports-bar/logger'

export interface KeepAwakeSchedulerConfig {
  repository: FireCubeRepository
  connectionManager: ConnectionManagerAdapter
}

export class KeepAwakeScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map()
  private repository: FireCubeRepository
  private connectionManager: ConnectionManagerAdapter

  constructor(config: KeepAwakeSchedulerConfig) {
    this.repository = config.repository
    this.connectionManager = config.connectionManager
  }

  /**
   * Initialize keep-awake schedules for all enabled devices
   */
  async initializeSchedules(): Promise<void> {
    try {
      const devices = await this.repository.devices.findWithKeepAwakeEnabled()
      const onlineDevices = devices.filter(d => d.status === 'online')

      for (const device of onlineDevices) {
        if (device.keepAwakeStart && device.keepAwakeEnd) {
          await this.scheduleDevice(device.id, device.keepAwakeStart, device.keepAwakeEnd)
        }
      }

      logger.info(`[KEEP-AWAKE] Initialized schedules for ${onlineDevices.length} devices`)
    } catch (error) {
      logger.error('[KEEP-AWAKE] Failed to initialize schedules:', { error })
    }
  }

  /**
   * Schedule keep-awake for a specific device
   */
  async scheduleDevice(
    deviceId: string,
    startTime: string,
    endTime: string
  ): Promise<void> {
    try {
      // Cancel existing schedule if any
      this.cancelSchedule(deviceId)

      const device = await this.repository.devices.findById(deviceId)

      if (!device) {
        throw new Error('Device not found')
      }

      // Parse start and end times (format: HH:MM)
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const [endHour, endMinute] = endTime.split(':').map(Number)

      // Schedule wake-up at start time
      const wakeUpCron = `${startMinute} ${startHour} * * *`
      const wakeUpTask = cron.schedule(wakeUpCron, async () => {
        await this.wakeUpDevice(deviceId)
      })

      // Schedule sleep at end time
      const sleepCron = `${endMinute} ${endHour} * * *`
      const sleepTask = cron.schedule(sleepCron, async () => {
        await this.allowSleepDevice(deviceId)
      })

      // Schedule periodic keep-alive during active hours (every 5 minutes)
      const keepAliveTask = cron.schedule('*/5 * * * *', async () => {
        await this.checkAndKeepAwake(deviceId, startHour, startMinute, endHour, endMinute)
      })

      // Store tasks
      this.scheduledTasks.set(`${deviceId}_wakeup`, wakeUpTask)
      this.scheduledTasks.set(`${deviceId}_sleep`, sleepTask)
      this.scheduledTasks.set(`${deviceId}_keepalive`, keepAliveTask)

      logger.info(`[KEEP-AWAKE] Scheduled device ${device.name} (${startTime} - ${endTime})`)
    } catch (error) {
      logger.error(`[KEEP-AWAKE] Failed to schedule device ${deviceId}:`, { error })
      throw error
    }
  }

  /**
   * Check if current time is within active hours and keep device awake
   */
  private async checkAndKeepAwake(
    deviceId: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number
  ): Promise<void> {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute
    const startTimeMinutes = startHour * 60 + startMinute
    let endTimeMinutes = endHour * 60 + endMinute

    // Handle overnight schedules (e.g., 7am to 1am)
    if (endTimeMinutes < startTimeMinutes) {
      endTimeMinutes += 24 * 60
      if (currentTime < startTimeMinutes) {
        // We're in the early morning hours
        if (currentTime <= endTimeMinutes - 24 * 60) {
          await this.keepDeviceAwake(deviceId)
        }
      } else {
        // We're in the evening/night hours
        await this.keepDeviceAwake(deviceId)
      }
    } else {
      // Normal same-day schedule
      if (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes) {
        await this.keepDeviceAwake(deviceId)
      }
    }
  }

  /**
   * Cancel schedule for a device
   */
  cancelSchedule(deviceId: string): void {
    const wakeUpTask = this.scheduledTasks.get(`${deviceId}_wakeup`)
    const sleepTask = this.scheduledTasks.get(`${deviceId}_sleep`)
    const keepAliveTask = this.scheduledTasks.get(`${deviceId}_keepalive`)

    if (wakeUpTask) {
      wakeUpTask.stop()
      this.scheduledTasks.delete(`${deviceId}_wakeup`)
    }

    if (sleepTask) {
      sleepTask.stop()
      this.scheduledTasks.delete(`${deviceId}_sleep`)
    }

    if (keepAliveTask) {
      keepAliveTask.stop()
      this.scheduledTasks.delete(`${deviceId}_keepalive`)
    }
  }

  /**
   * Wake up a device
   */
  private async wakeUpDevice(deviceId: string): Promise<void> {
    try {
      const device = await this.repository.devices.findById(deviceId)

      if (!device) {
        throw new Error('Device not found')
      }

      const client = await this.connectionManager.getOrCreateConnection(
        device.id,
        device.ipAddress,
        device.port
      )
      const success = await client.keepAwake(true)

      await this.logAction(deviceId, 'wake_up', Boolean(success))

      if (success) {
        logger.info(`[KEEP-AWAKE] Woke up device ${device.name}`)
      } else {
        logger.error(`[KEEP-AWAKE] Failed to wake up device ${device.name}`)
      }
    } catch (error) {
      logger.error(`[KEEP-AWAKE] Error waking up device ${deviceId}:`, { error })
      await this.logAction(deviceId, 'wake_up', false, (error as Error).message)
    }
  }

  /**
   * Keep device awake (periodic check)
   */
  private async keepDeviceAwake(deviceId: string): Promise<void> {
    try {
      const device = await this.repository.devices.findById(deviceId)

      if (!device || !device.keepAwakeEnabled) {
        return
      }

      const client = await this.connectionManager.getOrCreateConnection(
        device.id,
        device.ipAddress,
        device.port
      )

      // Check screen state
      const clientAny = client as any
      const screenState = await clientAny.getScreenState?.()

      if (screenState === 'off') {
        await client.keepAwake(true)
        await this.logAction(deviceId, 'keep_awake', true)
      }
    } catch (error) {
      // Silently fail for periodic checks
      logger.debug(`[KEEP-AWAKE] Keep-awake check failed for device ${deviceId}`)
    }
  }

  /**
   * Allow device to sleep
   */
  private async allowSleepDevice(deviceId: string): Promise<void> {
    try {
      const device = await this.repository.devices.findById(deviceId)

      if (!device) {
        throw new Error('Device not found')
      }

      const client = await this.connectionManager.getOrCreateConnection(
        device.id,
        device.ipAddress,
        device.port
      )
      const clientAny = client as any
      const success = await clientAny.allowSleep?.() || false

      await this.logAction(deviceId, 'allow_sleep', success)

      if (success) {
        logger.info(`[KEEP-AWAKE] Allowed sleep for device ${device.name}`)
      } else {
        logger.error(`[KEEP-AWAKE] Failed to allow sleep for device ${device.name}`)
      }
    } catch (error) {
      logger.error(`[KEEP-AWAKE] Error allowing sleep for device ${deviceId}:`, { error })
      await this.logAction(deviceId, 'allow_sleep', false, (error as Error).message)
    }
  }

  /**
   * Log keep-awake action
   */
  private async logAction(
    deviceId: string,
    action: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.repository.logs.create({
        deviceId,
        action,
        success,
        errorMessage: errorMessage || null,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('[KEEP-AWAKE] Failed to log action:', { error })
    }
  }

  /**
   * Update device schedule
   */
  async updateDeviceSchedule(
    deviceId: string,
    enabled: boolean,
    startTime?: string,
    endTime?: string
  ): Promise<void> {
    try {
      await this.repository.devices.updateKeepAwakeSettings(
        deviceId,
        enabled,
        startTime,
        endTime
      )

      if (enabled && startTime && endTime) {
        await this.scheduleDevice(deviceId, startTime, endTime)
      } else {
        this.cancelSchedule(deviceId)
      }
    } catch (error) {
      logger.error('[KEEP-AWAKE] Failed to update device schedule:', { error })
      throw error
    }
  }

  /**
   * Get keep-awake logs for a device
   */
  async getDeviceLogs(deviceId: string, limit: number = 100): Promise<KeepAwakeLog[]> {
    try {
      return await this.repository.logs.findByDeviceId(deviceId, limit)
    } catch (error) {
      logger.error('[KEEP-AWAKE] Failed to get device logs:', { error })
      return []
    }
  }

  /**
   * Get keep-awake status for all devices
   */
  async getKeepAwakeStatus(): Promise<KeepAwakeStatus[]> {
    try {
      const devices = await this.repository.devices.findWithKeepAwakeEnabled()
      const status: KeepAwakeStatus[] = []

      for (const device of devices) {
        const recentLogs = await this.repository.logs.findByDeviceId(device.id, 1)

        status.push({
          deviceId: device.id,
          deviceName: device.name,
          enabled: device.keepAwakeEnabled,
          schedule: `${device.keepAwakeStart || '?'} - ${device.keepAwakeEnd || '?'}`,
          lastAction: recentLogs[0] || null,
          isScheduled: this.scheduledTasks.has(`${device.id}_keepalive`)
        })
      }

      return status
    } catch (error) {
      logger.error('[KEEP-AWAKE] Failed to get status:', { error })
      return []
    }
  }

  /**
   * Stop all schedules
   */
  stopAll(): void {
    for (const [key, task] of this.scheduledTasks.entries()) {
      task.stop()
    }
    this.scheduledTasks.clear()
    logger.info('[KEEP-AWAKE] Stopped all schedules')
  }
}

// Factory function for creating scheduler with injected dependencies
export function createKeepAwakeScheduler(config: KeepAwakeSchedulerConfig): KeepAwakeScheduler {
  return new KeepAwakeScheduler(config)
}
