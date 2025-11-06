
// Fire Cube App Discovery and Management

import { ADBClient } from './adb-client';
import { KNOWN_SPORTS_APPS, FireCubeApp, InstalledApp } from './types';
import { and, asc, create, deleteRecord, desc, eq, findMany, findUnique, or, updateMany } from '@/lib/db-helpers'
import { db } from '@/db'
import { fireCubeDevices, fireCubeApps } from '@/db/schema'
import { logger } from '@/lib/logger';

export class AppDiscoveryService {
  /**
   * Discover all installed apps on a Fire Cube
   */
  async discoverApps(deviceId: string, ipAddress: string): Promise<FireCubeApp[]> {
    const client = new ADBClient(ipAddress);
    const apps: FireCubeApp[] = [];

    try {
      await client.connect();

      // Get all installed packages
      const packages = await client.getInstalledPackages();

      // Process each package
      for (const packageName of packages) {
        try {
          const appInfo = await this.getAppDetails(client, packageName);
          
          if (appInfo) {
            const knownApp = KNOWN_SPORTS_APPS.find(
              app => app.packageName === packageName
            );

            const app: FireCubeApp = {
              id: '', // Will be set by database
              deviceId,
              packageName,
              appName: appInfo.appName,
              version: appInfo.version,
              versionCode: appInfo.versionCode,
              category: knownApp?.category || 'Other',
              iconUrl: knownApp?.iconUrl,
              isSystemApp: appInfo.isSystemApp,
              isSportsApp: !!knownApp,
              hasSubscription: false, // Will be checked separately
              subscriptionStatus: undefined,
              lastChecked: new Date(),
              installedAt: (appInfo as any).installedAt || new Date(),
              updatedAt: new Date()
            };

            apps.push(app);
          }
        } catch (error) {
          logger.error(`Failed to get details for ${packageName}:`, error);
        }
      }

      return apps;
    } catch (error) {
      logger.error('App discovery failed:', error);
      return [];
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Get detailed information about an app
   */
  private async getAppDetails(
    client: ADBClient,
    packageName: string
  ): Promise<InstalledApp | null> {
    try {
      const clientAny = client as any;
      const packageInfo = await clientAny.getPackageInfo?.(packageName);
      const appLabel = await clientAny.getAppLabel?.(packageName);
      const isSystemApp = await clientAny.isSystemApp?.(packageName);

      return {
        packageName,
        appName: appLabel || packageName,
        version: packageInfo?.versionName,
        versionCode: packageInfo?.versionCode,
        isSystemApp: isSystemApp || false
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Sync apps for a device to database
   */
  async syncAppsToDatabase(deviceId: string, apps: FireCubeApp[]): Promise<void> {
    try {
      // Get existing apps
      const existingApps = await findMany('fireCubeApps', {
        where: eq(fireCubeApps.deviceId, deviceId)
      });

      const existingPackages = new Set(
        existingApps.map(app => app.packageName)
      );

      // Add new apps
      for (const app of apps) {
        if (!existingPackages.has(app.packageName)) {
          await create('fireCubeApps', {
              id: crypto.randomUUID(),
              deviceId: app.deviceId,
              packageName: app.packageName,
              appName: app.appName,
              version: app.version || null,
              versionCode: app.versionCode || null,
              category: app.category || null,
              iconUrl: app.iconUrl || null,
              isSystemApp: app.isSystemApp,
              isSportsApp: app.isSportsApp,
              hasSubscription: app.hasSubscription,
              subscriptionStatus: app.subscriptionStatus || null,
              lastChecked: app.lastChecked?.toISOString() || null,
              installedAt: app.installedAt?.toISOString() || null,
              updatedAt: new Date().toISOString()
            });
        } else {
          // Update existing app
          await updateMany('fireCubeApps', {
            where: and(
              eq(fireCubeApps.deviceId, app.deviceId),
              eq(fireCubeApps.packageName, app.packageName)
            ),
            data: {
              appName: app.appName,
              version: app.version || null,
              versionCode: app.versionCode || null,
              lastChecked: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          });
        }
      }

      // Remove apps that are no longer installed
      const currentPackages = new Set(apps.map(app => app.packageName));
      for (const existingApp of existingApps) {
        if (!currentPackages.has(existingApp.packageName)) {
          await deleteRecord('fireCubeApps', {
            where: eq(fireCubeApps.id, existingApp.id)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to sync apps to database:', error);
      throw error;
    }
  }

  /**
   * Get apps for a device from database
   */
  async getDeviceApps(deviceId: string): Promise<FireCubeApp[]> {
    try {
      return await findMany('fireCubeApps', {
        where: eq(fireCubeApps.deviceId, deviceId),
        orderBy: [
          desc(fireCubeApps.isSportsApp),
          asc(fireCubeApps.appName)
        ]
      });
    } catch (error) {
      logger.error('Failed to get device apps:', error);
      return [];
    }
  }

  /**
   * Get sports apps across all devices
   */
  async getAllSportsApps(): Promise<FireCubeApp[]> {
    try {
      return await findMany('fireCubeApps', {
        where: eq(fireCubeApps.isSportsApp, true),
        orderBy: [
          desc(fireCubeApps.hasSubscription),
          asc(fireCubeApps.appName)
        ]
      });
    } catch (error) {
      logger.error('Failed to get sports apps:', error);
      return [];
    }
  }

  /**
   * Launch app on device
   */
  async launchApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await findUnique('fireCubeDevices', {
        where: eq(fireCubeDevices.id, deviceId)
      });

      if (!device) {
        throw new Error('Device not found');
      }

      const client = new ADBClient(device.ipAddress, device.port);
      await client.connect();
      const result = await client.launchApp(packageName);
      await client.disconnect();

      return result;
    } catch (error) {
      logger.error(`Failed to launch app ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Stop app on device
   */
  async stopApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await findUnique('fireCubeDevices', {
        where: eq(fireCubeDevices.id, deviceId)
      });

      if (!device) {
        throw new Error('Device not found');
      }

      const client = new ADBClient(device.ipAddress, device.port);
      await client.connect();
      const result = await client.stopApp(packageName);
      await client.disconnect();

      return result;
    } catch (error) {
      logger.error(`Failed to stop app ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Get app icon (placeholder for now)
   */
  async getAppIcon(packageName: string): Promise<string | null> {
    const knownApp = KNOWN_SPORTS_APPS.find(
      app => app.packageName === packageName
    );
    return knownApp?.iconUrl || null;
  }
}
