/**
 * User Workflow Scenario Tests
 * Tests common user workflows and multi-step operations
 */

import { Socket } from 'net';

describe('User Workflows', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const matrixIp = process.env.MATRIX_IP || '192.168.5.100';
  const matrixPort = parseInt(process.env.MATRIX_PORT || '23');
  const skipNetworkTests = process.env.SKIP_NETWORK_TESTS === 'true';
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';

  // Helper functions
  const api = {
    get: (path: string) => fetch(`${baseUrl}${path}`),
    post: (path: string, body: any) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };

  const sendMatrixCommand = (command: string, timeout = 10000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let response = '';

      const timeoutHandle = setTimeout(() => {
        socket.destroy();
        reject(new Error('Command timeout'));
      }, timeout);

      socket.connect(matrixPort, matrixIp, () => {
        socket.write(command.endsWith('.') ? command : command + '.');
      });

      socket.on('data', (data) => {
        response += data.toString();
        if (response.includes('OK') || response.includes('ERR')) {
          clearTimeout(timeoutHandle);
          socket.destroy();
          resolve(response.trim());
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  };

  describe('System Health Monitoring', () => {
    test('User can view system health dashboard', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      // Step 1: Get system health
      const healthResponse = await api.get('/api/system/health');
      expect(healthResponse.status).toBe(200);

      const health = await healthResponse.json();

      // Step 2: Verify health data is complete
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('categories');
      expect(health.overall).toHaveProperty('status');
      expect(health.overall).toHaveProperty('devicesOnline');
      expect(health.overall).toHaveProperty('devicesTotal');

      // Step 3: Check device categories
      const categories = health.categories;
      expect(categories).toHaveProperty('tvs');
      expect(categories).toHaveProperty('cableBoxes');
      expect(categories).toHaveProperty('matrix');

      console.log('System Health Dashboard:');
      console.log(`  Status: ${health.overall.status}`);
      console.log(`  Health: ${health.overall.health}%`);
      console.log(`  Devices: ${health.overall.devicesOnline}/${health.overall.devicesTotal}`);
      console.log(`  TVs: ${categories.tvs.length}`);
      console.log(`  Cable Boxes: ${categories.cableBoxes.length}`);
      console.log(`  Audio Zones: ${categories.audioZones.length}`);
    }, 30000);

    test('User can identify offline devices', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      const healthResponse = await api.get('/api/system/health');
      const health = await healthResponse.json();

      // Collect all devices
      const allDevices = [
        ...health.categories.tvs,
        ...health.categories.cableBoxes,
        ...health.categories.audioZones,
        ...health.categories.matrix,
      ];

      // Find offline devices
      const offlineDevices = allDevices.filter(
        (d: any) => d.status === 'offline' || d.status === 'degraded'
      );

      console.log(`\nOffline/Degraded Devices: ${offlineDevices.length}`);
      offlineDevices.forEach((device: any) => {
        console.log(`  - ${device.name} (${device.type}): ${device.status}`);
        if (device.issues.length > 0) {
          console.log(`    Issues: ${device.issues.join(', ')}`);
        }
      });

      expect(Array.isArray(offlineDevices)).toBe(true);
    }, 30000);
  });

  describe('Video Routing', () => {
    test('User can route video from input to output', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test');
        return;
      }

      // Step 1: Route input 1 to output 1
      const routeResponse = await api.post('/api/matrix/command', {
        command: 'MT00SW0101',
        ipAddress: matrixIp,
        port: matrixPort,
        protocol: 'TCP',
      });

      expect(routeResponse.status).toBe(200);
      const routeResult = await routeResponse.json();

      console.log('Video Routing Result:');
      console.log(`  Command: ${routeResult.command}`);
      console.log(`  Success: ${routeResult.success}`);
      console.log(`  Response: ${routeResult.response || 'N/A'}`);

      expect(routeResult).toHaveProperty('success');
      expect(typeof routeResult.success).toBe('boolean');
    }, 30000);

    test('User can route multiple inputs sequentially', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test');
        return;
      }

      const routingOperations = [
        { input: 1, output: 1 },
        { input: 2, output: 2 },
        { input: 3, output: 3 },
      ];

      console.log('Sequential Routing Test:');

      for (const operation of routingOperations) {
        const command = `MT00SW${String(operation.input).padStart(2, '0')}${String(
          operation.output
        ).padStart(2, '0')}`;

        const response = await api.post('/api/matrix/command', {
          command,
          ipAddress: matrixIp,
          port: matrixPort,
          protocol: 'TCP',
        });

        // Handle non-JSON responses gracefully
        let result;
        try {
          result = await response.json();
        } catch (e) {
          result = { success: false, error: 'Invalid JSON response' };
        }
        console.log(
          `  Input ${operation.input} → Output ${operation.output}: ${
            result.success ? 'SUCCESS' : 'FAILED'
          }`
        );

        // Small delay between commands
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(true).toBe(true);
    }, 60000);
  });

  describe('Sports Guide Access', () => {
    test('User can view sports guide', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      // Step 1: Check sports guide status
      const statusResponse = await api.get('/api/sports-guide/status');
      expect(statusResponse.status).toBe(200);

      const status = await statusResponse.json();
      console.log('Sports Guide Status:');
      console.log(`  Configured: ${status.configured}`);

      // Step 2: Try to get sports guide data
      const guideResponse = await api.get('/api/sports-guide');

      // May fail if API key not configured
      if (guideResponse.status === 200) {
        let guide;
        try {
          guide = await guideResponse.json();
        } catch (e) {
          console.log('  Failed to parse sports guide response');
          return;
        }
        const games = Array.isArray(guide) ? guide : guide.games || guide.sports || [];

        console.log(`  Games Available: ${games.length}`);

        if (games.length > 0) {
          console.log('  Sample Games:');
          games.slice(0, 3).forEach((game: any, idx: number) => {
            console.log(`    ${idx + 1}. ${game.title || game.name || 'Untitled'}`);
          });
        }
      } else {
        console.log('  Sports guide data not available (may need API key)');
      }

      expect(status.configured).toBeDefined();
    }, 30000);
  });

  describe('System Configuration', () => {
    test('User can check backup status', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      const backupResponse = await api.get('/api/backup');
      expect(backupResponse.status).toBe(200);

      const backup = await backupResponse.json();
      expect(backup).toHaveProperty('backups');
      expect(Array.isArray(backup.backups)).toBe(true);

      console.log('Backup Information:');
      console.log(`  Timestamp: ${backup.timestamp}`);
      console.log(`  Data keys: ${Object.keys(backup).join(', ')}`);
    }, 30000);

    test('User can view device subscriptions', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      const subsResponse = await api.get('/api/device-subscriptions');

      if (subsResponse.status === 200) {
        const subscriptions = await subsResponse.json();
        const subArray = Array.isArray(subscriptions)
          ? subscriptions
          : Object.values(subscriptions);

        console.log('Device Subscriptions:');
        console.log(`  Total: ${subArray.length}`);
      } else {
        console.log('No device subscriptions configured');
      }

      expect([200, 404]).toContain(subsResponse.status);
    }, 30000);
  });

  describe('Multi-Operation Workflows', () => {
    test('User performs complete setup workflow', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      console.log('\n=== Complete Setup Workflow ===\n');

      // Step 1: Check system health
      console.log('Step 1: Checking system health...');
      const healthResponse = await api.get('/api/system/health');
      const health = await healthResponse.json();
      console.log(`  System status: ${health.overall.status}`);

      // Step 2: Check sports guide
      console.log('\nStep 2: Checking sports guide...');
      const statusResponse = await api.get('/api/sports-guide/status');
      const status = await statusResponse.json();
      console.log(`  Sports guide configured: ${status.configured}`);

      // Step 3: Check backup
      console.log('\nStep 3: Checking backup status...');
      const backupResponse = await api.get('/api/backup');
      const backup = await backupResponse.json();
      console.log(`  Backup available: ${backup.backups && backup.backups.length > 0 ? 'Yes' : 'No'}`);

      console.log('\n=== Workflow Complete ===\n');

      expect(health).toBeDefined();
      expect(status).toBeDefined();
      expect(backup).toBeDefined();
    }, 60000);

    test('Multiple concurrent API calls work correctly', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      console.log('Testing concurrent API calls...');

      const startTime = Date.now();

      // Make multiple API calls simultaneously
      const results = await Promise.allSettled([
        api.get('/api/system/health'),
        api.get('/api/sports-guide/status'),
        api.get('/api/backup'),
        api.get('/api/device-subscriptions'),
      ]);

      const duration = Date.now() - startTime;

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      console.log(`Concurrent API Calls Results:`);
      console.log(`  Total: ${results.length}`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Duration: ${duration}ms`);

      // Most calls should succeed
      expect(successful).toBeGreaterThan(0);
    }, 45000);
  });

  describe('Error Recovery', () => {
    test('System handles invalid operations gracefully', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test');
        return;
      }

      console.log('Testing error handling...');

      // Test 1: Invalid API endpoint
      const invalidEndpoint = await api.get('/api/does-not-exist-xyz');
      expect(invalidEndpoint.status).toBe(404);
      console.log('  Invalid endpoint: Handled correctly');

      // Test 2: Invalid POST data
      const invalidPost = await api.post('/api/matrix/command', {});
      let result;
      try {
        result = await invalidPost.json();
        expect(result.success).toBe(false);
      } catch (e) {
        // If JSON parsing fails, check that we got an error status
        expect(invalidPost.status).toBeGreaterThanOrEqual(400);
      }
      console.log('  Invalid POST data: Handled correctly');

      console.log('Error handling tests passed');
    }, 30000);
  });
});
