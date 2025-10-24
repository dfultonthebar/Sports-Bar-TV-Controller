
// Keep-Awake Scheduler for Fire Cubes

import cron from 'node-cron';
import { ADBClient } from './adb-client';
import { and, asc, create, desc, eq, findMany, findUnique, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger';

// Using singleton prisma from @/lib/prisma;

export class KeepAwakeScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize keep-awake schedules for all enabled devices
   */
  async initializeSchedules(): Promise<void> {
    try {
      const devices = await prisma.fireCubeDevice.findMany({
        where: {
          keepAwakeEnabled: true,
          status: 'online'
        }
      });

      for (const device of devices) {
        await this.scheduleDevice(device.id, device.keepAwakeStart, device.keepAwakeEnd);
      }

      logger.debug(`Initialized keep-awake schedules for ${devices.length} devices`);
    } catch (error) {
      logger.error('Failed to initialize keep-awake schedules:', error);
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
      this.cancelSchedule(deviceId);

      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Parse start and end times (format: HH:MM)
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      // Schedule wake-up at start time
      const wakeUpCron = `${startMinute} ${startHour} * * *`;
      const wakeUpTask = cron.schedule(wakeUpCron, async () => {
        await this.wakeUpDevice(deviceId);
      });

      // Schedule sleep at end time
      const sleepCron = `${endMinute} ${endHour} * * *`;
      const sleepTask = cron.schedule(sleepCron, async () => {
        await this.allowSleepDevice(deviceId);
      });

      // Schedule periodic keep-alive during active hours (every 5 minutes)
      const keepAliveTask = cron.schedule('*/5 * * * *', async () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;
        const startTimeMinutes = startHour * 60 + startMinute;
        let endTimeMinutes = endHour * 60 + endMinute;

        // Handle overnight schedules (e.g., 7am to 1am)
        if (endTimeMinutes < startTimeMinutes) {
          endTimeMinutes += 24 * 60;
          if (currentTime < startTimeMinutes) {
            // We're in the early morning hours
            if (currentTime <= endTimeMinutes - 24 * 60) {
              await this.keepDeviceAwake(deviceId);
            }
          } else {
            // We're in the evening/night hours
            await this.keepDeviceAwake(deviceId);
          }
        } else {
          // Normal same-day schedule
          if (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes) {
            await this.keepDeviceAwake(deviceId);
          }
        }
      });

      // Store tasks
      this.scheduledTasks.set(`${deviceId}_wakeup`, wakeUpTask);
      this.scheduledTasks.set(`${deviceId}_sleep`, sleepTask);
      this.scheduledTasks.set(`${deviceId}_keepalive`, keepAliveTask);

      logger.debug(`Scheduled keep-awake for device ${device.name} (${startTime} - ${endTime})`);
    } catch (error) {
      logger.error(`Failed to schedule device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel schedule for a device
   */
  cancelSchedule(deviceId: string): void {
    const wakeUpTask = this.scheduledTasks.get(`${deviceId}_wakeup`);
    const sleepTask = this.scheduledTasks.get(`${deviceId}_sleep`);
    const keepAliveTask = this.scheduledTasks.get(`${deviceId}_keepalive`);

    if (wakeUpTask) {
      wakeUpTask.stop();
      this.scheduledTasks.delete(`${deviceId}_wakeup`);
    }

    if (sleepTask) {
      sleepTask.stop();
      this.scheduledTasks.delete(`${deviceId}_sleep`);
    }

    if (keepAliveTask) {
      keepAliveTask.stop();
      this.scheduledTasks.delete(`${deviceId}_keepalive`);
    }
  }

  /**
   * Wake up a device
   */
  private async wakeUpDevice(deviceId: string): Promise<void> {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        throw new Error('Device not found');
      }

      const client = new ADBClient(device.ipAddress, device.port);
      await client.connect();
      const success = await client.keepAwake();
      await client.disconnect();

      await this.logAction(deviceId, 'wake_up', success);

      if (success) {
        logger.debug(`Woke up device ${device.name}`);
      } else {
        logger.error(`Failed to wake up device ${device.name}`);
      }
    } catch (error) {
      logger.error(`Error waking up device ${deviceId}:`, error);
      await this.logAction(deviceId, 'wake_up', false, (error as Error).message);
    }
  }

  /**
   * Keep device awake (periodic check)
   */
  private async keepDeviceAwake(deviceId: string): Promise<void> {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
      });

      if (!device || !device.keepAwakeEnabled) {
        return;
      }

      const client = new ADBClient(device.ipAddress, device.port);
      await client.connect();
      
      // Check screen state
      const screenState = await client.getScreenState();
      
      if (screenState === 'off') {
        // Wake up the device
        await client.keepAwake();
        await this.logAction(deviceId, 'keep_awake', true);
      }
      
      await client.disconnect();
    } catch (error) {
      // Silently fail for periodic checks
      console.debug(`Keep-awake check failed for device ${deviceId}`);
    }
  }

  /**
   * Allow device to sleep
   */
  private async allowSleepDevice(deviceId: string): Promise<void> {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        throw new Error('Device not found');
      }

      const client = new ADBClient(device.ipAddress, device.port);
      await client.connect();
      const success = await client.allowSleep();
      await client.disconnect();

      await this.logAction(deviceId, 'allow_sleep', success);

      if (success) {
        logger.debug(`Allowed sleep for device ${device.name}`);
      } else {
        logger.error(`Failed to allow sleep for device ${device.name}`);
      }
    } catch (error) {
      logger.error(`Error allowing sleep for device ${deviceId}:`, error);
      await this.logAction(deviceId, 'allow_sleep', false, (error as Error).message);
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
      await create('fireCubeKeepAwakeLogs', {
          deviceId,
          action,
          success,
          errorMessage,
          timestamp: new Date()
        });
    } catch (error) {
      logger.error('Failed to log keep-awake action:', error);
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
      const updateData: any = { keepAwakeEnabled: enabled };
      
      if (startTime) updateData.keepAwakeStart = startTime;
      if (endTime) updateData.keepAwakeEnd = endTime;

      await prisma.fireCubeDevice.update({
        where: { id: deviceId },
        data: updateData
      });

      if (enabled && startTime && endTime) {
        await this.scheduleDevice(deviceId, startTime, endTime);
      } else {
        this.cancelSchedule(deviceId);
      }
    } catch (error) {
      logger.error('Failed to update device schedule:', error);
      throw error;
    }
  }

  /**
   * Get keep-awake logs for a device
   */
  async getDeviceLogs(deviceId: string, limit: number = 100): Promise<any[]> {
    try {
      return await prisma.fireCubeKeepAwakeLog.findMany({
        where: { deviceId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error('Failed to get device logs:', error);
      return [];
    }
  }

  /**
   * Get keep-awake status for all devices
   */
  async getKeepAwakeStatus(): Promise<any[]> {
    try {
      const devices = await prisma.fireCubeDevice.findMany({
        where: { keepAwakeEnabled: true }
      });

      const status = [];

      for (const device of devices) {
        const recentLogs = await prisma.fireCubeKeepAwakeLog.findMany({
          where: { deviceId: device.id },
          orderBy: { timestamp: 'desc' },
          take: 1
        });

        status.push({
          deviceId: device.id,
          deviceName: device.name,
          enabled: device.keepAwakeEnabled,
          schedule: `${device.keepAwakeStart} - ${device.keepAwakeEnd}`,
          lastAction: recentLogs[0] || null,
          isScheduled: this.scheduledTasks.has(`${device.id}_keepalive`)
        });
      }

      return status;
    } catch (error) {
      logger.error('Failed to get keep-awake status:', error);
      return [];
    }
  }

  /**
   * Stop all schedules
   */
  stopAll(): void {
    for (const [key, task] of this.scheduledTasks.entries()) {
      task.stop();
    }
    this.scheduledTasks.clear();
    logger.debug('Stopped all keep-awake schedules');
  }
}

// Singleton instance
let schedulerInstance: KeepAwakeScheduler | null = null;

export function getKeepAwakeScheduler(): KeepAwakeScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new KeepAwakeScheduler();
  }
  return schedulerInstance;
}
