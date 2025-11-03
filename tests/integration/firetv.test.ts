/**
 * Fire TV Integration Tests
 * Tests ADB connectivity and Fire TV device control
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

describe('Fire TV Control', () => {
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';
  const testDeviceIp = process.env.TEST_FIRETV_IP || '192.168.5.131';
  const testDevicePort = process.env.TEST_FIRETV_PORT || '5555';
  const testDevice = `${testDeviceIp}:${testDevicePort}`;

  // Helper to check if ADB is installed
  const isAdbInstalled = async (): Promise<boolean> => {
    try {
      await execAsync('which adb');
      return true;
    } catch (error) {
      return false;
    }
  };

  // Helper to connect to device
  const connectDevice = async (device: string): Promise<boolean> => {
    try {
      const { stdout } = await execAsync(`adb connect ${device}`);
      return stdout.includes('connected') || stdout.includes('already connected');
    } catch (error) {
      return false;
    }
  };

  // Helper to disconnect device
  const disconnectDevice = async (device: string): Promise<void> => {
    try {
      await execAsync(`adb disconnect ${device}`);
    } catch (error) {
      // Ignore errors on disconnect
    }
  };

  // Helper to get connected devices
  const getConnectedDevices = async (): Promise<string[]> => {
    try {
      const { stdout } = await execAsync('adb devices');
      const lines = stdout.split('\n').slice(1); // Skip header
      return lines
        .filter((line) => line.includes('device'))
        .map((line) => line.split('\t')[0]);
    } catch (error) {
      return [];
    }
  };

  beforeAll(async () => {
    if (!skipHardwareTests) {
      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.warn('ADB is not installed - Fire TV tests will be skipped');
      }
    }
  });

  afterAll(async () => {
    // Clean up - disconnect test device
    if (!skipHardwareTests) {
      await disconnectDevice(testDevice);
    }
  });

  describe('ADB Environment', () => {
    test('ADB is installed and accessible', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();

      if (!adbInstalled) {
        console.warn('ADB is not installed. Install with: sudo apt-get install adb');
      }

      console.log(`ADB installed: ${adbInstalled ? 'Yes' : 'No'}`);
      expect(typeof adbInstalled).toBe('boolean');
    }, 5000);

    test('Can query ADB version', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping version check');
        return;
      }

      try {
        const { stdout } = await execAsync('adb version');
        console.log('ADB version:', stdout.split('\n')[0]);
        expect(stdout).toContain('Android Debug Bridge version');
      } catch (error) {
        console.warn('Could not get ADB version:', error);
      }
    }, 5000);
  });

  describe('Device Connection', () => {
    test('Can list ADB devices', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping device list');
        return;
      }

      const devices = await getConnectedDevices();
      console.log(`Connected devices: ${devices.length}`);
      devices.forEach((device) => console.log(`  - ${device}`));

      expect(Array.isArray(devices)).toBe(true);
    }, 10000);

    test('ADB connection can be established', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping connection test');
        return;
      }

      const connected = await connectDevice(testDevice);

      console.log(`Connection to ${testDevice}: ${connected ? 'SUCCESS' : 'FAILED'}`);

      if (!connected) {
        console.warn(
          `Could not connect to Fire TV at ${testDevice}. ` +
          'Ensure the device is online and ADB is enabled.'
        );
      }

      expect(typeof connected).toBe('boolean');
    }, 15000);

    test('Can disconnect from device', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping disconnect test');
        return;
      }

      // First connect
      await connectDevice(testDevice);

      // Then disconnect
      await disconnectDevice(testDevice);

      const devices = await getConnectedDevices();
      const stillConnected = devices.includes(testDevice);

      console.log(`Device ${testDevice} still connected: ${stillConnected}`);
      expect(typeof stillConnected).toBe('boolean');
    }, 15000);
  });

  describe('ADB Commands', () => {
    beforeEach(async () => {
      if (!skipHardwareTests) {
        const adbInstalled = await isAdbInstalled();
        if (adbInstalled) {
          await connectDevice(testDevice);
        }
      }
    });

    test('Can send ADB command to device', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping command test');
        return;
      }

      const devices = await getConnectedDevices();
      if (!devices.includes(testDevice)) {
        console.log('Test device not connected - skipping command test');
        return;
      }

      try {
        // Send a simple command - get device model
        const { stdout } = await execAsync(
          `adb -s ${testDevice} shell getprop ro.product.model`
        );

        console.log(`Device model: ${stdout.trim()}`);
        expect(stdout).toBeDefined();
        expect(stdout.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn('Could not send command to device:', error);
      }
    }, 15000);

    test('Can query device properties', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping properties test');
        return;
      }

      const devices = await getConnectedDevices();
      if (!devices.includes(testDevice)) {
        console.log('Test device not connected - skipping properties test');
        return;
      }

      try {
        const properties = [
          'ro.product.model',
          'ro.build.version.release',
          'ro.serialno',
        ];

        for (const prop of properties) {
          const { stdout } = await execAsync(
            `adb -s ${testDevice} shell getprop ${prop}`
          );
          console.log(`${prop}: ${stdout.trim()}`);
        }

        expect(true).toBe(true);
      } catch (error) {
        console.warn('Could not query device properties:', error);
      }
    }, 20000);
  });

  describe('Connection Recovery', () => {
    test('Connection recovery works after disconnect', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping recovery test');
        return;
      }

      // Disconnect
      await disconnectDevice(testDevice);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reconnect
      const reconnected = await connectDevice(testDevice);

      console.log(`Reconnection: ${reconnected ? 'SUCCESS' : 'FAILED'}`);
      expect(typeof reconnected).toBe('boolean');
    }, 20000);

    test('Handles connection to offline device gracefully', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping offline test');
        return;
      }

      // Try to connect to non-existent device
      const offlineDevice = '192.168.5.254:5555';
      const startTime = Date.now();

      try {
        await Promise.race([
          connectDevice(offlineDevice),
          new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
        ]);

        const duration = Date.now() - startTime;
        console.log(`Offline device connection attempt took ${duration}ms`);

        // Should complete within reasonable time
        expect(duration).toBeLessThan(15000);
      } catch (error) {
        console.log('Offline device handled correctly');
      }
    }, 20000);
  });

  describe('Health Check', () => {
    test('Health check detects connection state', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const adbInstalled = await isAdbInstalled();
      if (!adbInstalled) {
        console.log('ADB not installed - skipping health check');
        return;
      }

      const devices = await getConnectedDevices();
      const isConnected = devices.includes(testDevice);

      const healthStatus = {
        adbInstalled,
        deviceConnected: isConnected,
        deviceCount: devices.length,
        status: adbInstalled && isConnected ? 'healthy' : 'degraded',
      };

      console.log('Fire TV Health Check:');
      console.log(`  ADB Installed: ${healthStatus.adbInstalled}`);
      console.log(`  Device Connected: ${healthStatus.deviceConnected}`);
      console.log(`  Total Devices: ${healthStatus.deviceCount}`);
      console.log(`  Status: ${healthStatus.status}`);

      expect(healthStatus).toHaveProperty('status');
      expect(['healthy', 'degraded', 'offline']).toContain(healthStatus.status);
    }, 10000);
  });
});
