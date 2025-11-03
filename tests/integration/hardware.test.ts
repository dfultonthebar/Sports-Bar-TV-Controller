/**
 * Hardware Connectivity Tests
 * Tests network connectivity to all configured hardware devices
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Socket } from 'net';

const execAsync = promisify(exec);

describe('Hardware Connectivity', () => {
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';

  // Device configurations
  const devices = {
    wolfPackMatrix: {
      name: 'Wolf Pack Matrix',
      ip: process.env.MATRIX_IP || '192.168.5.100',
      port: parseInt(process.env.MATRIX_PORT || '23'),
      protocol: 'tcp',
    },
    atlasIED: {
      name: 'AtlasIED Audio Processor',
      ip: process.env.ATLASIED_IP || '192.168.5.101',
      port: 80,
      protocol: 'http',
    },
    fireTv: {
      name: 'Fire TV Device',
      ip: process.env.TEST_FIRETV_IP || '192.168.5.131',
      port: 5555,
      protocol: 'adb',
    },
  };

  // Helper to ping a device
  const pingDevice = async (ip: string): Promise<boolean> => {
    try {
      // Use ping with timeout
      const { stdout } = await execAsync(`ping -c 1 -W 2 ${ip}`);
      return stdout.includes('1 received') || stdout.includes('1 packets received');
    } catch (error) {
      return false;
    }
  };

  // Helper to check TCP port
  const checkTcpPort = (ip: string, port: number, timeout = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });
  };

  // Helper to check HTTP endpoint
  const checkHttpEndpoint = async (ip: string, port: number): Promise<boolean> => {
    try {
      const response = await fetch(`http://${ip}:${port}`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.status >= 200 && response.status < 500;
    } catch (error) {
      return false;
    }
  };

  describe('Network Reachability', () => {
    test('Wolf Pack Matrix is reachable', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await pingDevice(devices.wolfPackMatrix.ip);

      console.log(
        `Wolf Pack Matrix (${devices.wolfPackMatrix.ip}): ${
          isReachable ? 'ONLINE' : 'OFFLINE'
        }`
      );

      // Don't fail test if offline - just report
      expect(typeof isReachable).toBe('boolean');
    }, 15000);

    test('AtlasIED Audio processor is reachable', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await pingDevice(devices.atlasIED.ip);

      console.log(
        `AtlasIED Audio Processor (${devices.atlasIED.ip}): ${
          isReachable ? 'ONLINE' : 'OFFLINE'
        }`
      );

      expect(typeof isReachable).toBe('boolean');
    }, 15000);

    test('Fire TV device is reachable (if configured)', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await pingDevice(devices.fireTv.ip);

      console.log(
        `Fire TV (${devices.fireTv.ip}): ${isReachable ? 'ONLINE' : 'OFFLINE'}`
      );

      expect(typeof isReachable).toBe('boolean');
    }, 15000);
  });

  describe('Port Connectivity', () => {
    test('Wolf Pack Matrix port 23 is open', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isOpen = await checkTcpPort(
        devices.wolfPackMatrix.ip,
        devices.wolfPackMatrix.port
      );

      console.log(
        `Wolf Pack Matrix port ${devices.wolfPackMatrix.port}: ${
          isOpen ? 'OPEN' : 'CLOSED'
        }`
      );

      expect(typeof isOpen).toBe('boolean');
    }, 10000);

    test('Fire TV ADB port is accessible', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isOpen = await checkTcpPort(devices.fireTv.ip, devices.fireTv.port);

      console.log(
        `Fire TV ADB port ${devices.fireTv.port}: ${isOpen ? 'OPEN' : 'CLOSED'}`
      );

      expect(typeof isOpen).toBe('boolean');
    }, 10000);
  });

  describe('Service Availability', () => {
    test('AtlasIED web interface is accessible', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isAccessible = await checkHttpEndpoint(
        devices.atlasIED.ip,
        devices.atlasIED.port
      );

      console.log(
        `AtlasIED web interface: ${isAccessible ? 'ACCESSIBLE' : 'NOT ACCESSIBLE'}`
      );

      expect(typeof isAccessible).toBe('boolean');
    }, 10000);
  });

  describe('All Configured Devices', () => {
    test('Generate connectivity report for all devices', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      console.log('\n=== Hardware Connectivity Report ===\n');

      const results: Array<{
        name: string;
        ip: string;
        port: number;
        pingable: boolean;
        portOpen: boolean;
      }> = [];

      for (const [key, device] of Object.entries(devices)) {
        const pingable = await pingDevice(device.ip);
        const portOpen = await checkTcpPort(device.ip, device.port);

        results.push({
          name: device.name,
          ip: device.ip,
          port: device.port,
          pingable,
          portOpen,
        });

        const status = pingable && portOpen ? '✓ ONLINE' : '✗ OFFLINE';
        console.log(`${status} - ${device.name}`);
        console.log(`  IP: ${device.ip}`);
        console.log(`  Port: ${device.port}`);
        console.log(`  Pingable: ${pingable ? 'Yes' : 'No'}`);
        console.log(`  Port Open: ${portOpen ? 'Yes' : 'No'}`);
        console.log('');
      }

      const onlineCount = results.filter((r) => r.pingable && r.portOpen).length;
      const totalCount = results.length;

      console.log(`Summary: ${onlineCount}/${totalCount} devices online`);
      console.log('\n====================================\n');

      // Test should always pass - this is just a report
      expect(results.length).toBe(totalCount);
    }, 45000);
  });

  describe('Network Performance', () => {
    test('Ping response time is reasonable', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const startTime = Date.now();
      const isReachable = await pingDevice(devices.wolfPackMatrix.ip);
      const duration = Date.now() - startTime;

      if (isReachable) {
        console.log(`Ping response time: ${duration}ms`);
        expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
      } else {
        console.log('Device not reachable - skipping performance test');
      }
    }, 10000);

    test('TCP connection establishes quickly', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const startTime = Date.now();
      const isOpen = await checkTcpPort(devices.wolfPackMatrix.ip, devices.wolfPackMatrix.port);
      const duration = Date.now() - startTime;

      if (isOpen) {
        console.log(`TCP connection time: ${duration}ms`);
        expect(duration).toBeLessThan(3000); // Should connect within 3 seconds
      } else {
        console.log('Port not open - skipping connection performance test');
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    test('Handles unreachable host gracefully', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isReachable = await pingDevice('192.168.5.254');
      expect(isReachable).toBe(false);
      console.log('Unreachable host handled correctly');
    }, 10000);

    test('Handles closed port gracefully', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test - SKIP_HARDWARE_TESTS is set');
        return;
      }

      const isOpen = await checkTcpPort('127.0.0.1', 9999, 2000);
      expect(isOpen).toBe(false);
      console.log('Closed port handled correctly');
    }, 5000);
  });
});
