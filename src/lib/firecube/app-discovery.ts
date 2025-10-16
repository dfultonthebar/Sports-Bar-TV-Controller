
// Fire Cube App Discovery and Management

import { ADBClient } from './adb-client';
import { KNOWN_SPORTS_APPS, FireCubeApp, InstalledApp } from './types';
import prisma from "@/lib/prisma";

// Using singleton prisma from @/lib/prisma;

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
              installedAt: appInfo.installedAt,
              updatedAt: new Date()
            };

            apps.push(app);
          }
        } catch (error) {
          console.error(`Failed to get details for ${packageName}:`, error);
        }
      }

      return apps;
    } catch (error) {
      console.error('App discovery failed:', error);
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
      const packageInfo = await client.getPackageInfo(packageName);
      const appLabel = await client.getAppLabel(packageName);
      const isSystemApp = await client.isSystemApp(packageName);

      return {
        packageName,
        appName: appLabel,
        version: packageInfo?.versionName,
        versionCode: packageInfo?.versionCode,
        isSystemApp
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
      const existingApps = await prisma.fireCubeApp.findMany({
        where: { deviceId }
      });

      const existingPackages = new Set(
        existingApps.map(app => app.packageName)
      );

      // Add new apps
      for (const app of apps) {
        if (!existingPackages.has(app.packageName)) {
          await prisma.fireCubeApp.create({
            data: {
              deviceId: app.deviceId,
              packageName: app.packageName,
              appName: app.appName,
              version: app.version,
              versionCode: app.versionCode,
              category: app.category,
              iconUrl: app.iconUrl,
              isSystemApp: app.isSystemApp,
              isSportsApp: app.isSportsApp,
              hasSubscription: app.hasSubscription,
              subscriptionStatus: app.subscriptionStatus,
              lastChecked: app.lastChecked,
              installedAt: app.installedAt
            }
          });
        } else {
          // Update existing app
          await prisma.fireCubeApp.updateMany({
            where: {
              deviceId: app.deviceId,
              packageName: app.packageName
            },
            data: {
              appName: app.appName,
              version: app.version,
              versionCode: app.versionCode,
              lastChecked: new Date()
            }
          });
        }
      }

      // Remove apps that are no longer installed
      const currentPackages = new Set(apps.map(app => app.packageName));
      for (const existingApp of existingApps) {
        if (!currentPackages.has(existingApp.packageName)) {
          await prisma.fireCubeApp.delete({
            where: { id: existingApp.id }
          });
        }
      }
    } catch (error) {
      console.error('Failed to sync apps to database:', error);
      throw error;
    }
  }

  /**
   * Get apps for a device from database
   */
  async getDeviceApps(deviceId: string): Promise<FireCubeApp[]> {
    try {
      return await prisma.fireCubeApp.findMany({
        where: { deviceId },
        orderBy: [
          { isSportsApp: 'desc' },
          { appName: 'asc' }
        ]
      });
    } catch (error) {
      console.error('Failed to get device apps:', error);
      return [];
    }
  }

  /**
   * Get sports apps across all devices
   */
  async getAllSportsApps(): Promise<FireCubeApp[]> {
    try {
      return await prisma.fireCubeApp.findMany({
        where: { isSportsApp: true },
        orderBy: [
          { hasSubscription: 'desc' },
          { appName: 'asc' }
        ]
      });
    } catch (error) {
      console.error('Failed to get sports apps:', error);
      return [];
    }
  }

  /**
   * Launch app on device
   */
  async launchApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
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
      console.error(`Failed to launch app ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Stop app on device
   */
  async stopApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id: deviceId }
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
      console.error(`Failed to stop app ${packageName}:`, error);
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
