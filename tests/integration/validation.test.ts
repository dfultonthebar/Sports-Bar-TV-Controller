/**
 * Integration Tests for Input Validation
 *
 * Tests validation across different API endpoint categories
 *
 * NOTE: These tests require a running Next.js server
 * Skip with SKIP_INTEGRATION_TESTS=true if server is not available
 */

import { describe, it, expect, beforeAll } from '@jest/globals'

const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true'

describe.skip('Input Validation Integration Tests (SKIPPED - Requires Running Server)', () => {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  // Helper function to make API requests
  async function makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    return fetch(`${BASE_URL}${endpoint}`, options)
  }

  describe('Authentication & Security Endpoints', () => {
    describe('POST /api/api-keys', () => {
      it('should reject request with missing required fields', async () => {
        const response = await makeRequest('/api/api-keys', 'POST', {
          name: 'Test Key'
          // Missing provider and keyValue
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.validationErrors).toBeDefined()
      })

      it('should reject request with invalid API key provider', async () => {
        const response = await makeRequest('/api/api-keys', 'POST', {
          name: 'Test Key',
          provider: 'invalid_provider',
          keyValue: 'test-key-12345'
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'provider')).toBe(true)
      })

      it('should reject request with short API key value', async () => {
        const response = await makeRequest('/api/api-keys', 'POST', {
          name: 'Test Key',
          provider: 'openai',
          keyValue: 'short' // Less than 10 characters
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'keyValue')).toBe(true)
      })

      it('should accept valid API key creation request', async () => {
        const response = await makeRequest('/api/api-keys', 'POST', {
          name: 'Valid Test Key',
          provider: 'openai',
          keyValue: 'sk-test-1234567890abcdef',
          description: 'Test API key for validation'
        })

        // May succeed or fail based on auth, but should not have validation errors
        const data = await response.json()
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })

    describe('PUT /api/api-keys/[id]', () => {
      it('should reject request with invalid UUID', async () => {
        const response = await makeRequest('/api/api-keys/not-a-uuid', 'PUT', {
          name: 'Updated Key'
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })
    })
  })

  describe('Hardware Control Endpoints', () => {
    describe('POST /api/matrix/command', () => {
      it('should reject request with missing IP address', async () => {
        const response = await makeRequest('/api/matrix/command', 'POST', {
          command: 'SW I01 O01.',
          port: 23
          // Missing ipAddress
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'ipAddress')).toBe(true)
      })

      it('should reject request with invalid IP address', async () => {
        const response = await makeRequest('/api/matrix/command', 'POST', {
          command: 'SW I01 O01.',
          ipAddress: '999.999.999.999',
          port: 23
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'ipAddress')).toBe(true)
      })

      it('should reject request with invalid port', async () => {
        const response = await makeRequest('/api/matrix/command', 'POST', {
          command: 'SW I01 O01.',
          ipAddress: '192.168.1.100',
          port: 99999 // Port out of range
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'port')).toBe(true)
      })

      it('should accept valid matrix command request', async () => {
        const response = await makeRequest('/api/matrix/command', 'POST', {
          command: 'SW I01 O01.',
          ipAddress: '192.168.1.100',
          port: 23,
          protocol: 'TCP'
        })

        const data = await response.json()
        // Should not have validation errors (may fail for other reasons)
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })

    describe('POST /api/cec/command', () => {
      it('should reject request with invalid CEC action', async () => {
        const response = await makeRequest('/api/cec/command', 'POST', {
          action: 'invalid_action',
          tvAddress: '0'
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'action')).toBe(true)
      })

      it('should reject request with invalid TV address', async () => {
        const response = await makeRequest('/api/cec/command', 'POST', {
          action: 'power_on',
          tvAddress: 'invalid' // Must be digit or 'all'
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })

      it('should reject set_volume with out-of-range volume', async () => {
        const response = await makeRequest('/api/cec/command', 'POST', {
          action: 'set_volume',
          tvAddress: '0',
          params: {
            volume: 150 // > 100
          }
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })

      it('should accept valid CEC command', async () => {
        const response = await makeRequest('/api/cec/command', 'POST', {
          action: 'power_on',
          tvAddress: '0'
        })

        const data = await response.json()
        // Should not have validation errors
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })

    describe('POST /api/directv-devices/send-command', () => {
      it('should reject request with missing device ID', async () => {
        const response = await makeRequest('/api/directv-devices/send-command', 'POST', {
          command: 'POWER',
          ipAddress: '192.168.1.100'
          // Missing deviceId
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })

      it('should reject request with invalid device ID format', async () => {
        const response = await makeRequest('/api/directv-devices/send-command', 'POST', {
          deviceId: 'invalid device id!', // Special characters not allowed
          command: 'POWER',
          ipAddress: '192.168.1.100'
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })

      it('should accept valid DirecTV command', async () => {
        const response = await makeRequest('/api/directv-devices/send-command', 'POST', {
          deviceId: 'directv_001',
          command: 'POWER',
          ipAddress: '192.168.1.100',
          port: 8080
        })

        const data = await response.json()
        // Should not have validation errors
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })

    describe('POST /api/firetv-devices/send-command', () => {
      it('should reject request with invalid app package format', async () => {
        const response = await makeRequest('/api/firetv-devices/send-command', 'POST', {
          deviceId: 'firetv_001',
          command: 'LAUNCH_APP',
          ipAddress: '192.168.1.101',
          port: 5555,
          appPackage: 'InvalidFormat' // Not a valid package name
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
      })

      it('should accept valid FireTV command', async () => {
        const response = await makeRequest('/api/firetv-devices/send-command', 'POST', {
          deviceId: 'firetv_001',
          command: 'HOME',
          ipAddress: '192.168.1.101',
          port: 5555
        })

        const data = await response.json()
        // Should not have validation errors
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })
  })

  describe('External API Endpoints', () => {
    describe('POST /api/streaming/launch', () => {
      it('should reject request with invalid app ID format', async () => {
        const response = await makeRequest('/api/streaming/launch', 'POST', {
          deviceId: 'firetv_001',
          ipAddress: '192.168.1.101',
          appId: 'NotAValidAppId' // Not in package format
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.validationErrors).toBeDefined()
        expect(data.validationErrors.some((e: any) => e.field === 'appId')).toBe(true)
      })

      it('should accept valid streaming launch request', async () => {
        const response = await makeRequest('/api/streaming/launch', 'POST', {
          deviceId: 'firetv_001',
          ipAddress: '192.168.1.101',
          appId: 'com.netflix.ninja',
          port: 5555
        })

        const data = await response.json()
        // Should not have validation errors
        if (response.status === 400) {
          expect(data.validationErrors).toBeUndefined()
        }
      })
    })
  })

  describe('Validation Error Format', () => {
    it('should return structured validation errors', async () => {
      const response = await makeRequest('/api/api-keys', 'POST', {
        name: 'ab', // Too short
        provider: 'invalid', // Invalid provider
        keyValue: 'short' // Too short
      })

      expect(response.status).toBe(400)
      const data = await response.json()

      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('validationErrors')
      expect(data).toHaveProperty('timestamp')

      expect(Array.isArray(data.validationErrors)).toBe(true)
      expect(data.validationErrors.length).toBeGreaterThan(0)

      // Each error should have field and message
      data.validationErrors.forEach((error: any) => {
        expect(error).toHaveProperty('field')
        expect(error).toHaveProperty('message')
      })
    })
  })

  describe('Query Parameter Validation', () => {
    it('should validate query parameters', async () => {
      // This would test endpoints that use validateQueryParams
      // For now, just verify endpoint exists
      const response = await makeRequest('/api/api-keys')
      expect(response.status).not.toBe(404)
    })
  })
})
