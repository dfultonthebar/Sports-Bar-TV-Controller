
// Fire Cube Discovery Service

import { exec } from 'child_process';
import { promisify } from 'util';
import { ADBClient } from './adb-client';
import { FIRECUBE_CONFIG, FireCubeDevice, DiscoveryResult } from './types';

import { logger } from '@/lib/logger'
const execAsync = promisify(exec);

export class FireCubeDiscovery {
  /**
   * Discover Fire Cubes via ADB
   */
  async discoverViaAdb(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('adb devices', {
        timeout: FIRECUBE_CONFIG.DISCOVERY_TIMEOUT
      });

      const devices: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (line.includes('\tdevice')) {
          const parts = line.split('\t');
          if (parts[0]) {
            // Extract IP address if it's a network device
            const match = parts[0].match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
            if (match) {
              devices.push(match[1]);
            }
          }
        }
      }

      return devices;
    } catch (error) {
      logger.error('ADB discovery failed:', error);
      return [];
    }
  }

  /**
   * Scan network for Fire Cubes
   */
  async scanNetwork(ipRange: string = FIRECUBE_CONFIG.DEFAULT_IP_RANGE): Promise<string[]> {
    const foundDevices: string[] = [];
    const promises: Promise<void>[] = [];

    // Scan IP range
    for (let i = 1; i <= 254; i++) {
      const ip = `${ipRange}.${i}`;
      
      promises.push(
        this.testDevice(ip)
          .then((isFireCube) => {
            if (isFireCube) {
              foundDevices.push(ip);
            }
          })
          .catch(() => {
            // Ignore errors
          })
      );

      // Process in batches to avoid overwhelming the network
      if (promises.length >= FIRECUBE_CONFIG.MAX_CONCURRENT_OPERATIONS) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    // Wait for remaining promises
    await Promise.all(promises);
    return foundDevices;
  }

  /**
   * Test if device at IP is a Fire Cube
   */
  private async testDevice(ipAddress: string): Promise<boolean> {
    const client = new ADBClient(ipAddress);
    
    try {
      const connected = await client.connect();
      if (!connected) return false;

      const props = await client.getDeviceInfo();
      
      // Check if it's an Amazon Fire device
      const manufacturer = props['ro.product.manufacturer']?.toLowerCase();
      const model = props['ro.product.model']?.toLowerCase();
      
      return (
        manufacturer === 'amazon' &&
        (model?.includes('fire') || model?.includes('aftm') || model?.includes('aftb'))
      );
    } catch (error) {
      return false;
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Identify and get details of a Fire Cube
   */
  async identifyDevice(ipAddress: string): Promise<Partial<FireCubeDevice> | null> {
    const client = new ADBClient(ipAddress);

    try {
      const connected = await client.connect();
      if (!connected) return null;

      const props = await client.getDeviceInfo();
      const clientAny = client as any;
      const serialNumber = await clientAny.getSerialNumber?.();
      const model = await clientAny.getModel?.() || props.model;
      const softwareVersion = await clientAny.getSoftwareVersion?.() || props.softwareVersion;

      // Determine device type
      let deviceModel = 'Fire TV';
      if (model?.includes('AFTMM')) deviceModel = 'Fire TV Cube (3rd Gen)';
      else if (model?.includes('AFTR')) deviceModel = 'Fire TV Cube (2nd Gen)';
      else if (model?.includes('AFTA')) deviceModel = 'Fire TV Cube (1st Gen)';
      else if (model?.includes('AFTKA')) deviceModel = 'Fire TV Stick 4K Max';
      else if (model?.includes('AFTM')) deviceModel = 'Fire TV Stick 4K';
      else if (model?.includes('AFTB')) deviceModel = 'Fire TV Stick';

      return {
        ipAddress,
        port: FIRECUBE_CONFIG.ADB_PORT,
        serialNumber: serialNumber || undefined,
        deviceModel,
        softwareVersion: softwareVersion || undefined,
        adbEnabled: true,
        status: 'online',
        lastSeen: new Date()
      };
    } catch (error) {
      logger.error(`Failed to identify device at ${ipAddress}:`, error);
      return null;
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Discover single device by IP
   */
  async discoverSingle(ipAddress: string): Promise<Partial<FireCubeDevice> | null> {
    return await this.identifyDevice(ipAddress);
  }

  /**
   * Full discovery process
   */
  async discover(method: 'adb' | 'network_scan' | 'both' = 'both'): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const foundIPs = new Set<string>();
    const errors: string[] = [];

    try {
      if (method === 'adb' || method === 'both') {
        const adbDevices = await this.discoverViaAdb();
        adbDevices.forEach(ip => foundIPs.add(ip));
      }

      if (method === 'network_scan' || method === 'both') {
        const scannedDevices = await this.scanNetwork();
        scannedDevices.forEach(ip => foundIPs.add(ip));
      }

      // Identify each device
      const devices: FireCubeDevice[] = [];
      for (const ip of foundIPs) {
        try {
          const deviceInfo = await this.identifyDevice(ip);
          if (deviceInfo) {
            devices.push({
              id: '', // Will be set by database
              name: deviceInfo.deviceModel || 'Fire TV Device',
              ipAddress: ip,
              port: FIRECUBE_CONFIG.ADB_PORT,
              macAddress: deviceInfo.macAddress,
              serialNumber: deviceInfo.serialNumber,
              deviceModel: deviceInfo.deviceModel,
              softwareVersion: deviceInfo.softwareVersion,
              location: deviceInfo.location,
              matrixInputChannel: deviceInfo.matrixInputChannel,
              adbEnabled: true,
              status: 'online',
              lastSeen: new Date(),
              keepAwakeEnabled: false,
              keepAwakeStart: '07:00',
              keepAwakeEnd: '01:00',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        } catch (error: any) {
          errors.push(`Failed to identify ${ip}: ${error.message}`);
        }
      }

      return {
        devices,
        duration: Date.now() - startTime,
        method: method === 'both' ? 'network_scan' : method,
        errors
      };
    } catch (error: any) {
      errors.push(`Discovery failed: ${error.message}`);
      return {
        devices: [],
        duration: Date.now() - startTime,
        method: method === 'both' ? 'network_scan' : method,
        errors
      };
    }
  }

  /**
   * Check if ADB is installed and available
   */
  async checkAdbAvailable(): Promise<boolean> {
    try {
      await execAsync('adb version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get ADB version
   */
  async getAdbVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('adb version');
      const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
}
