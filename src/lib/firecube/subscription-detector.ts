
// Subscription Detection Service for Fire Cube Apps

import { ADBClient } from './adb-client';
import { KNOWN_SPORTS_APPS, SubscriptionCheckResult } from './types';
import prisma from "@/lib/prisma";

// Using singleton prisma from @/lib/prisma;

export class SubscriptionDetector {
  /**
   * Check subscription status for an app
   */
  async checkSubscription(
    deviceId: string,
    packageName: string
  ): Promise<SubscriptionCheckResult> {
    const device = await prisma.fireCubeDevice.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      throw new Error('Device not found');
    }

    const knownApp = KNOWN_SPORTS_APPS.find(
      app => app.packageName === packageName
    );

    if (!knownApp) {
      return {
        packageName,
        hasSubscription: false,
        subscriptionStatus: 'unknown',
        lastChecked: new Date(),
        method: 'heuristic'
      };
    }

    const client = new ADBClient(device.ipAddress, device.port);

    try {
      await client.connect();

      let hasSubscription = false;
      let subscriptionStatus: 'active' | 'expired' | 'trial' | 'unknown' = 'unknown';
      let method: 'login_check' | 'api_check' | 'heuristic' = 'heuristic';

      // Check based on app's subscription check method
      switch (knownApp.subscriptionCheckMethod) {
        case 'shared_prefs':
          const prefsResult = await this.checkSharedPreferences(
            client,
            packageName,
            knownApp.subscriptionIndicators
          );
          hasSubscription = prefsResult.hasSubscription;
          subscriptionStatus = prefsResult.status;
          method = 'login_check';
          break;

        case 'login_file':
          const loginResult = await this.checkLoginFiles(client, packageName);
          hasSubscription = loginResult.hasSubscription;
          subscriptionStatus = loginResult.status;
          method = 'login_check';
          break;

        case 'api':
          // API-based checks would require app-specific implementation
          // For now, fall back to heuristic
          const heuristicResult = await this.heuristicCheck(client, packageName);
          hasSubscription = heuristicResult.hasSubscription;
          subscriptionStatus = heuristicResult.status;
          method = 'heuristic';
          break;

        default:
          const defaultResult = await this.heuristicCheck(client, packageName);
          hasSubscription = defaultResult.hasSubscription;
          subscriptionStatus = defaultResult.status;
          method = 'heuristic';
      }

      return {
        packageName,
        hasSubscription,
        subscriptionStatus,
        lastChecked: new Date(),
        method
      };
    } catch (error) {
      console.error(`Subscription check failed for ${packageName}:`, error);
      return {
        packageName,
        hasSubscription: false,
        subscriptionStatus: 'unknown',
        lastChecked: new Date(),
        method: 'heuristic'
      };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Check shared preferences for subscription indicators
   */
  private async checkSharedPreferences(
    client: ADBClient,
    packageName: string,
    indicators: string[]
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      const prefs = await client.checkSharedPreferences(packageName, indicators);
      
      // Check if any subscription indicators are present
      const hasIndicators = Object.keys(prefs).length > 0;
      
      if (!hasIndicators) {
        return { hasSubscription: false, status: 'unknown' };
      }

      // Analyze the values to determine status
      const prefsString = JSON.stringify(prefs).toLowerCase();
      
      if (prefsString.includes('active') || prefsString.includes('true') || prefsString.includes('premium')) {
        return { hasSubscription: true, status: 'active' };
      } else if (prefsString.includes('expired') || prefsString.includes('false')) {
        return { hasSubscription: false, status: 'expired' };
      } else if (prefsString.includes('trial')) {
        return { hasSubscription: true, status: 'trial' };
      }

      // If indicators exist but status is unclear, assume active
      return { hasSubscription: true, status: 'active' };
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' };
    }
  }

  /**
   * Check login files for authentication status
   */
  private async checkLoginFiles(
    client: ADBClient,
    packageName: string
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      // Check for common authentication files
      const authFiles = [
        `/data/data/${packageName}/files/auth.json`,
        `/data/data/${packageName}/files/user.json`,
        `/data/data/${packageName}/files/session.json`,
        `/data/data/${packageName}/shared_prefs/auth.xml`,
        `/data/data/${packageName}/shared_prefs/user.xml`
      ];

      for (const file of authFiles) {
        try {
          const exists = await client.shell(`test -f ${file} && echo "exists" || echo "not found"`);
          if (exists.includes('exists')) {
            // File exists, likely logged in
            return { hasSubscription: true, status: 'active' };
          }
        } catch (error) {
          // Continue checking other files
        }
      }

      return { hasSubscription: false, status: 'unknown' };
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' };
    }
  }

  /**
   * Heuristic check based on app usage patterns
   */
  private async heuristicCheck(
    client: ADBClient,
    packageName: string
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      // Check if app has been recently used (indicates active subscription)
      const packageInfo = await client.getPackageInfo(packageName);
      
      if (packageInfo?.lastUpdateTime) {
        // If app was updated recently, likely has active subscription
        const lastUpdate = new Date(packageInfo.lastUpdateTime);
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 30) {
          return { hasSubscription: true, status: 'active' };
        }
      }

      // Check app data size (larger data might indicate active use)
      const dataSize = await client.shell(`du -s /data/data/${packageName} 2>/dev/null | cut -f1`);
      const sizeKB = parseInt(dataSize.trim());
      
      if (sizeKB > 10000) { // More than 10MB of data
        return { hasSubscription: true, status: 'active' };
      }

      return { hasSubscription: false, status: 'unknown' };
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' };
    }
  }

  /**
   * Check subscriptions for all sports apps on a device
   */
  async checkAllSubscriptions(deviceId: string): Promise<void> {
    try {
      const apps = await prisma.fireCubeApp.findMany({
        where: {
          deviceId,
          isSportsApp: true
        }
      });

      for (const app of apps) {
        try {
          const result = await this.checkSubscription(deviceId, app.packageName);
          
          await prisma.fireCubeApp.update({
            where: { id: app.id },
            data: {
              hasSubscription: result.hasSubscription,
              subscriptionStatus: result.subscriptionStatus,
              lastChecked: result.lastChecked
            }
          });
        } catch (error) {
          console.error(`Failed to check subscription for ${app.packageName}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to check all subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get subscribed apps for a device
   */
  async getSubscribedApps(deviceId: string): Promise<any[]> {
    try {
      return await prisma.fireCubeApp.findMany({
        where: {
          deviceId,
          hasSubscription: true
        },
        orderBy: {
          appName: 'asc'
        }
      });
    } catch (error) {
      console.error('Failed to get subscribed apps:', error);
      return [];
    }
  }

  /**
   * Get subscription summary across all devices
   */
  async getSubscriptionSummary(): Promise<any> {
    try {
      const devices = await prisma.fireCubeDevice.findMany({
        where: { status: 'online' }
      });

      const summary: any = {
        totalDevices: devices.length,
        subscriptions: {}
      };

      for (const device of devices) {
        const subscribedApps = await this.getSubscribedApps(device.id);
        
        for (const app of subscribedApps) {
          if (!summary.subscriptions[app.packageName]) {
            summary.subscriptions[app.packageName] = {
              appName: app.appName,
              packageName: app.packageName,
              deviceCount: 0,
              devices: []
            };
          }
          
          summary.subscriptions[app.packageName].deviceCount++;
          summary.subscriptions[app.packageName].devices.push({
            deviceId: device.id,
            deviceName: device.name,
            status: app.subscriptionStatus
          });
        }
      }

      return summary;
    } catch (error) {
      console.error('Failed to get subscription summary:', error);
      return { totalDevices: 0, subscriptions: {} };
    }
  }
}
