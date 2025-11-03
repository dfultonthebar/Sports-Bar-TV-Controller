/**
 * API Integration Tests
 * Tests actual API endpoints with real system
 */

import { createServer } from 'http';
import { NextRequest } from 'next/server';
import request from 'supertest';

describe('API Endpoints', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const skipNetworkTests = process.env.SKIP_NETWORK_TESTS === 'true';

  // Helper to make API requests
  const api = {
    get: (path: string) => fetch(`${baseUrl}${path}`),
    post: (path: string, body: any) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };

  describe('Health Endpoints', () => {
    test('GET /api/system/health returns 200 and valid structure', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/system/health');

      expect(response.status).toBe(200);

      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('overall');
      expect(data).toHaveProperty('categories');

      // Verify overall health structure
      expect(data.overall).toHaveProperty('status');
      expect(data.overall).toHaveProperty('health');
      expect(data.overall).toHaveProperty('devicesOnline');
      expect(data.overall).toHaveProperty('devicesTotal');
      expect(data.overall).toHaveProperty('activeIssues');

      // Verify categories exist
      expect(data.categories).toHaveProperty('tvs');
      expect(data.categories).toHaveProperty('cableBoxes');
      expect(data.categories).toHaveProperty('audioZones');
      expect(data.categories).toHaveProperty('matrix');

      // Verify health is a valid percentage
      expect(data.overall.health).toBeGreaterThanOrEqual(0);
      expect(data.overall.health).toBeLessThanOrEqual(100);

      // Verify status is one of the expected values
      expect(['healthy', 'degraded', 'critical']).toContain(data.overall.status);
    }, 30000);

    test('GET /api/startup returns initialization status', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/startup');
      expect([200, 500]).toContain(response.status);

      const data = await response.json();
      expect(data).toBeDefined();
    }, 30000);
  });

  describe('Sports Guide API', () => {
    test('GET /api/sports-guide returns data or error', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/sports-guide');

      // Should return either data or error
      expect([200, 400, 500]).toContain(response.status);

      const data = await response.json();
      expect(data).toBeDefined();

      // If successful, should have games array
      if (response.status === 200) {
        expect(Array.isArray(data.games) || Array.isArray(data)).toBeTruthy();
      }
    }, 30000);

    test('GET /api/sports-guide/status returns configuration status', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/sports-guide/status');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('configured');
      expect(typeof data.configured).toBe('boolean');
    }, 30000);
  });

  describe('Matrix API', () => {
    test('POST /api/matrix/command executes routing command', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const matrixIp = process.env.MATRIX_IP || '192.168.5.100';
      const matrixPort = parseInt(process.env.MATRIX_PORT || '23');

      const response = await api.post('/api/matrix/command', {
        command: 'MT00SW0101',
        ipAddress: matrixIp,
        port: matrixPort,
        protocol: 'TCP',
      });

      // Should get a response (success or failure)
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(typeof data.success).toBe('boolean');

      if (data.success) {
        expect(data).toHaveProperty('response');
        expect(data).toHaveProperty('command');
      }
    }, 30000);
  });

  describe('CEC API', () => {
    test('GET /api/cec/status returns CEC status', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/cec/status');

      // CEC might not be available on all systems
      expect([200, 400, 500]).toContain(response.status);

      const data = await response.json();
      expect(data).toBeDefined();
    }, 30000);
  });

  describe('Backup API', () => {
    test('GET /api/backup returns backup data', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/backup');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('timestamp');
    }, 30000);
  });

  describe('Device Subscriptions API', () => {
    test('GET /api/device-subscriptions returns subscription data', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/device-subscriptions');

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    test('Invalid API endpoints return 404', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.get('/api/nonexistent-endpoint-xyz123');
      expect(response.status).toBe(404);
    }, 30000);

    test('POST without required body returns error', async () => {
      if (skipNetworkTests) {
        console.log('Skipping network test - SKIP_NETWORK_TESTS is set');
        return;
      }

      const response = await api.post('/api/matrix/command', {});

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    }, 30000);
  });
});
