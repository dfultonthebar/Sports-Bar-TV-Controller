
// App Sideloading Service for Fire Cubes

import { ADBClient } from './adb-client';
import { and, asc, create, desc, eq, findFirst, findMany, findUnique, or, update, upsert } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Using singleton prisma from @/lib/prisma;
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

export class SideloadService {
  private apkCacheDir = '/tmp/firecube-apks';

  constructor() {
    this.ensureCacheDir();
  }

  /**
   * Ensure APK cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      if (!await exists(this.apkCacheDir)) {
        await mkdir(this.apkCacheDir, { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to create APK cache directory:', error);
    }
  }

  /**
   * Sideload app from one device to others
   */
  async sideloadApp(
    sourceDeviceId: string,
    targetDeviceIds: string[],
    packageName: string
  ): Promise<string> {
    try {
      // Get source device
      const sourceDevice = await prisma.fireCubeDevice.findUnique({
        where: { id: sourceDeviceId }
      });

      if (!sourceDevice) {
        throw new Error('Source device not found');
      }

      // Get app info
      const app = await prisma.fireCubeApp.findFirst({
        where: {
          deviceId: sourceDeviceId,
          packageName
        }
      });

      if (!app) {
        throw new Error('App not found on source device');
      }

      // Create sideload operation
      const operation = await create('fireCubeSideloadOperations', {
          sourceDeviceId,
          targetDeviceIds: JSON.stringify(targetDeviceIds),
          packageName,
          appName: app.appName,
          status: 'pending',
          progress: 0,
          totalDevices: targetDeviceIds.length,
          completedDevices: 0,
          failedDevices: 0,
          startedAt: new Date()
        });

      // Start sideload process asynchronously
      this.performSideload(operation.id, sourceDevice, targetDeviceIds, packageName, app.appName)
        .catch(error => {
          logger.error('Sideload operation failed:', error);
        });

      return operation.id;
    } catch (error) {
      logger.error('Failed to initiate sideload:', error);
      throw error;
    }
  }

  /**
   * Perform the actual sideload operation
   */
  private async performSideload(
    operationId: string,
    sourceDevice: any,
    targetDeviceIds: string[],
    packageName: string,
    appName: string
  ): Promise<void> {
    const errorLog: string[] = [];

    try {
      // Update status to in_progress
      await this.updateOperationStatus(operationId, 'in_progress', 5);

      // Step 1: Backup APK from source device
      const apkPath = path.join(this.apkCacheDir, `${packageName}.apk`);
      const sourceClient = new ADBClient(sourceDevice.ipAddress, sourceDevice.port);
      
      await sourceClient.connect();
      const backupSuccess = await sourceClient.backupApk(packageName, apkPath);
      await sourceClient.disconnect();

      if (!backupSuccess) {
        throw new Error('Failed to backup APK from source device');
      }

      await this.updateOperationStatus(operationId, 'in_progress', 20);

      // Step 2: Install APK on target devices
      let completedDevices = 0;
      let failedDevices = 0;

      for (let i = 0; i < targetDeviceIds.length; i++) {
        const targetDeviceId = targetDeviceIds[i];
        
        try {
          const targetDevice = await prisma.fireCubeDevice.findUnique({
            where: { id: targetDeviceId }
          });

          if (!targetDevice) {
            errorLog.push(`Target device ${targetDeviceId} not found`);
            failedDevices++;
            continue;
          }

          const targetClient = new ADBClient(targetDevice.ipAddress, targetDevice.port);
          await targetClient.connect();
          
          const installSuccess = await targetClient.installApk(apkPath);
          
          if (installSuccess) {
            completedDevices++;
            
            // Update app in database
            await prisma.fireCubeApp.upsert({
              where: {
                deviceId_packageName: {
                  deviceId: targetDeviceId,
                  packageName
                }
              },
              create: {
                deviceId: targetDeviceId,
                packageName,
                appName,
                isSystemApp: false,
                isSportsApp: false,
                hasSubscription: false,
                installedAt: new Date(),
                updatedAt: new Date()
              },
              update: {
                updatedAt: new Date()
              }
            });
          } else {
            errorLog.push(`Failed to install on ${targetDevice.name}`);
            failedDevices++;
          }
          
          await targetClient.disconnect();
        } catch (error: any) {
          errorLog.push(`Error installing on device ${targetDeviceId}: ${error.message}`);
          failedDevices++;
        }

        // Update progress
        const progress = 20 + Math.floor((i + 1) / targetDeviceIds.length * 75);
        await this.updateOperationStatus(
          operationId,
          'in_progress',
          progress,
          completedDevices,
          failedDevices
        );
      }

      // Step 3: Clean up APK file
      try {
        if (await exists(apkPath)) {
          fs.unlinkSync(apkPath);
        }
      } catch (error) {
        logger.error('Failed to clean up APK file:', error);
      }

      // Step 4: Update final status
      const finalStatus = failedDevices === 0 ? 'completed' : 
                         completedDevices === 0 ? 'failed' : 'partial';

      await prisma.fireCubeSideloadOperation.update({
        where: { id: operationId },
        data: {
          status: finalStatus,
          progress: 100,
          completedDevices,
          failedDevices,
          errorLog: errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          completedAt: new Date()
        }
      });

      logger.debug(`Sideload operation ${operationId} completed: ${completedDevices} succeeded, ${failedDevices} failed`);
    } catch (error: any) {
      logger.error('Sideload operation failed:', error);
      
      await prisma.fireCubeSideloadOperation.update({
        where: { id: operationId },
        data: {
          status: 'failed',
          errorLog: JSON.stringify([...errorLog, error.message]),
          completedAt: new Date()
        }
      });
    }
  }

  /**
   * Update operation status
   */
  private async updateOperationStatus(
    operationId: string,
    status: string,
    progress: number,
    completedDevices?: number,
    failedDevices?: number
  ): Promise<void> {
    const updateData: any = { status, progress };
    
    if (completedDevices !== undefined) {
      updateData.completedDevices = completedDevices;
    }
    
    if (failedDevices !== undefined) {
      updateData.failedDevices = failedDevices;
    }

    await prisma.fireCubeSideloadOperation.update({
      where: { id: operationId },
      data: updateData
    });
  }

  /**
   * Get sideload operation status
   */
  async getOperationStatus(operationId: string): Promise<any> {
    try {
      const operation = await prisma.fireCubeSideloadOperation.findUnique({
        where: { id: operationId }
      });

      if (!operation) {
        throw new Error('Operation not found');
      }

      return {
        ...operation,
        targetDeviceIds: JSON.parse(operation.targetDeviceIds),
        errorLog: operation.errorLog ? JSON.parse(operation.errorLog) : []
      };
    } catch (error) {
      logger.error('Failed to get operation status:', error);
      throw error;
    }
  }

  /**
   * Get all sideload operations
   */
  async getAllOperations(limit: number = 50): Promise<any[]> {
    try {
      const operations = await prisma.fireCubeSideloadOperation.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit
      });

      return operations.map(op => ({
        ...op,
        targetDeviceIds: JSON.parse(op.targetDeviceIds),
        errorLog: op.errorLog ? JSON.parse(op.errorLog) : []
      }));
    } catch (error) {
      logger.error('Failed to get operations:', error);
      return [];
    }
  }

  /**
   * Clone all apps from one device to another
   */
  async cloneDevice(sourceDeviceId: string, targetDeviceId: string): Promise<string> {
    try {
      // Get all non-system apps from source device
      const apps = await prisma.fireCubeApp.findMany({
        where: {
          deviceId: sourceDeviceId,
          isSystemApp: false
        }
      });

      if (apps.length === 0) {
        throw new Error('No apps to clone');
      }

      // Create a batch sideload operation for all apps
      const operations: string[] = [];

      for (const app of apps) {
        try {
          const operationId = await this.sideloadApp(
            sourceDeviceId,
            [targetDeviceId],
            app.packageName
          );
          operations.push(operationId);
        } catch (error) {
          logger.error(`Failed to sideload ${app.packageName}:`, error);
        }
      }

      return JSON.stringify(operations);
    } catch (error) {
      logger.error('Failed to clone device:', error);
      throw error;
    }
  }

  /**
   * Sync app to all devices
   */
  async syncAppToAllDevices(sourceDeviceId: string, packageName: string): Promise<string> {
    try {
      // Get all devices except source
      const devices = await prisma.fireCubeDevice.findMany({
        where: {
          id: { not: sourceDeviceId },
          status: 'online'
        }
      });

      const targetDeviceIds = devices.map(d => d.id);

      if (targetDeviceIds.length === 0) {
        throw new Error('No target devices available');
      }

      return await this.sideloadApp(sourceDeviceId, targetDeviceIds, packageName);
    } catch (error) {
      logger.error('Failed to sync app to all devices:', error);
      throw error;
    }
  }

  /**
   * Cancel sideload operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    try {
      const operation = await prisma.fireCubeSideloadOperation.findUnique({
        where: { id: operationId }
      });

      if (!operation) {
        throw new Error('Operation not found');
      }

      if (operation.status === 'completed' || operation.status === 'failed') {
        throw new Error('Cannot cancel completed or failed operation');
      }

      await prisma.fireCubeSideloadOperation.update({
        where: { id: operationId },
        data: {
          status: 'failed',
          errorLog: JSON.stringify(['Operation cancelled by user']),
          completedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to cancel operation:', error);
      throw error;
    }
  }
}
