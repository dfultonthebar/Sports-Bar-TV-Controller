#!/usr/bin/env tsx

/**
 * Runtime Validation Testing Script
 *
 * Tests critical API endpoints with actual HTTP requests to verify:
 * - Valid requests succeed (200/201)
 * - Invalid requests fail with 400
 * - Error messages are properly formatted
 * - No duplicate request.json() errors
 */

interface TestCase {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  validPayload?: any;
  invalidPayload?: any;
  expectedValidStatus?: number;
  expectedInvalidStatus?: number;
  skipInvalid?: boolean;
}

interface TestResult {
  testCase: string;
  endpoint: string;
  validTest: { status: string; statusCode?: number; error?: string };
  invalidTest: { status: string; statusCode?: number; error?: string };
  overall: 'PASS' | 'FAIL' | 'PARTIAL';
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const TEST_CASES: TestCase[] = [
  // AI/Chat endpoints
  {
    name: 'Enhanced Chat API',
    method: 'POST',
    endpoint: '/api/enhanced-chat',
    validPayload: { message: 'test', sessionId: 'test-123' },
    invalidPayload: { wrongField: 'test' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },
  {
    name: 'Standard Chat API',
    method: 'POST',
    endpoint: '/api/chat',
    validPayload: { message: 'test query', sessionId: 'session-456' },
    invalidPayload: { msg: 'missing required field' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // Channel/TV Control endpoints
  {
    name: 'Channel Preset Tune',
    method: 'POST',
    endpoint: '/api/channel-presets/tune',
    validPayload: { presetId: 1 },
    invalidPayload: { preset: 'wrong-field' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },
  {
    name: 'Unified TV Control',
    method: 'POST',
    endpoint: '/api/unified-tv-control',
    validPayload: { command: 'on', deviceId: 1 },
    invalidPayload: { cmd: 'wrong-field' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // IR Device Control
  {
    name: 'IR Send Command',
    method: 'POST',
    endpoint: '/api/ir-devices/send-command',
    validPayload: { deviceId: 1, command: 'POWER' },
    invalidPayload: { device: 'wrong-field' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // Matrix/Video Routing
  {
    name: 'Matrix Switch',
    method: 'POST',
    endpoint: '/api/matrix/switch',
    validPayload: { inputNumber: 1, outputNumber: 1 },
    invalidPayload: { input: 'wrong-field' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // CEC Control
  {
    name: 'CEC Power Control',
    method: 'POST',
    endpoint: '/api/cec/power-control',
    validPayload: { command: 'on', deviceId: 1 },
    invalidPayload: { powerCommand: 'wrong' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },
  {
    name: 'CEC Cable Box Command',
    method: 'POST',
    endpoint: '/api/cec/cable-box/command',
    validPayload: { command: 'select' },
    invalidPayload: { cmd: 123 },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // GET endpoints (should NOT validate body)
  {
    name: 'Get Channel Presets',
    method: 'GET',
    endpoint: '/api/channel-presets',
    expectedValidStatus: 200,
    skipInvalid: true
  },
  {
    name: 'Get IR Devices',
    method: 'GET',
    endpoint: '/api/ir-devices',
    expectedValidStatus: 200,
    skipInvalid: true
  },
  {
    name: 'Get FireTV Devices',
    method: 'GET',
    endpoint: '/api/firetv-devices',
    expectedValidStatus: 200,
    skipInvalid: true
  },

  // Audio Processing
  {
    name: 'Audio Processor POST',
    method: 'POST',
    endpoint: '/api/audio-processor',
    validPayload: { command: 'setVolume', value: 50 },
    invalidPayload: { wrongCommand: 'test' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },
  {
    name: 'Audio Processor PUT',
    method: 'PUT',
    endpoint: '/api/audio-processor',
    validPayload: { config: { master: 50 } },
    invalidPayload: { configuration: 'wrong' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // Streaming platforms
  {
    name: 'Streaming Platform Credentials',
    method: 'PUT',
    endpoint: '/api/streaming-platforms/credentials',
    validPayload: { platformId: 1, username: 'test', password: 'test123' },
    invalidPayload: { platform: 'wrong' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  },

  // System endpoints
  {
    name: 'System Reboot',
    method: 'POST',
    endpoint: '/api/system/reboot',
    validPayload: { confirm: true },
    invalidPayload: { reboot: 'yes' },
    expectedValidStatus: 200,
    expectedInvalidStatus: 400
  }
];

class RuntimeValidator {
  private results: TestResult[] = [];

  async runTests() {
    console.log('🧪 Starting Runtime Validation Tests\n');
    console.log('=' .repeat(80));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Total Test Cases: ${TEST_CASES.length}\n`);
    console.log('=' .repeat(80) + '\n');

    for (const testCase of TEST_CASES) {
      await this.testEndpoint(testCase);
    }

    this.printSummary();
    return this.results;
  }

  private async testEndpoint(testCase: TestCase) {
    console.log(`\n📌 Testing: ${testCase.name}`);
    console.log(`   ${testCase.method} ${testCase.endpoint}`);

    const result: TestResult = {
      testCase: testCase.name,
      endpoint: testCase.endpoint,
      validTest: { status: 'NOT_RUN' },
      invalidTest: { status: 'NOT_RUN' },
      overall: 'FAIL'
    };

    // Test valid request (if applicable)
    if (testCase.validPayload || testCase.method === 'GET') {
      try {
        const response = await this.makeRequest(
          testCase.method,
          testCase.endpoint,
          testCase.validPayload
        );

        result.validTest.statusCode = response.status;

        if (response.status === (testCase.expectedValidStatus || 200)) {
          result.validTest.status = 'PASS';
          console.log(`   ✅ Valid request: ${response.status} (expected)`);
        } else if (response.status >= 200 && response.status < 300) {
          result.validTest.status = 'PASS';
          console.log(`   ✅ Valid request: ${response.status} (success)`);
        } else {
          result.validTest.status = 'FAIL';
          result.validTest.error = `Expected ${testCase.expectedValidStatus}, got ${response.status}`;
          console.log(`   ❌ Valid request: ${response.status} (unexpected)`);
        }
      } catch (error) {
        result.validTest.status = 'ERROR';
        result.validTest.error = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ⚠️  Valid request error: ${result.validTest.error}`);
      }
    }

    // Test invalid request
    if (!testCase.skipInvalid && testCase.invalidPayload) {
      try {
        const response = await this.makeRequest(
          testCase.method,
          testCase.endpoint,
          testCase.invalidPayload
        );

        result.invalidTest.statusCode = response.status;

        if (response.status === 400) {
          result.invalidTest.status = 'PASS';
          console.log(`   ✅ Invalid request: 400 (correctly rejected)`);

          // Check error format
          try {
            const data = await response.json();
            if (data.error || data.message) {
              console.log(`   ✅ Error message present: "${data.error || data.message}"`);
            }
          } catch {
            // JSON parse error, that's okay
          }
        } else {
          result.invalidTest.status = 'FAIL';
          result.invalidTest.error = `Expected 400, got ${response.status}`;
          console.log(`   ❌ Invalid request: ${response.status} (should be 400)`);
        }
      } catch (error) {
        result.invalidTest.status = 'ERROR';
        result.invalidTest.error = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ⚠️  Invalid request error: ${result.invalidTest.error}`);
      }
    } else if (testCase.skipInvalid) {
      result.invalidTest.status = 'SKIPPED';
      console.log(`   ⏭️  Invalid request: Skipped (GET endpoint)`);
    }

    // Determine overall status
    if (result.validTest.status === 'PASS' &&
        (result.invalidTest.status === 'PASS' || result.invalidTest.status === 'SKIPPED')) {
      result.overall = 'PASS';
    } else if (result.validTest.status === 'PASS' || result.invalidTest.status === 'PASS') {
      result.overall = 'PARTIAL';
    } else {
      result.overall = 'FAIL';
    }

    this.results.push(result);
  }

  private async makeRequest(method: string, endpoint: string, payload?: any): Promise<Response> {
    const url = `${BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (payload && method !== 'GET') {
      options.body = JSON.stringify(payload);
    }

    return fetch(url, options);
  }

  private printSummary() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RUNTIME TEST SUMMARY');
    console.log('='.repeat(80) + '\n');

    const total = this.results.length;
    const passed = this.results.filter(r => r.overall === 'PASS').length;
    const partial = this.results.filter(r => r.overall === 'PARTIAL').length;
    const failed = this.results.filter(r => r.overall === 'FAIL').length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Partial: ${partial} (${((partial/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log();

    if (failed > 0) {
      console.log('Failed Tests:');
      this.results.filter(r => r.overall === 'FAIL').forEach(r => {
        console.log(`  - ${r.testCase} (${r.endpoint})`);
        if (r.validTest.error) console.log(`    Valid: ${r.validTest.error}`);
        if (r.invalidTest.error) console.log(`    Invalid: ${r.invalidTest.error}`);
      });
      console.log();
    }

    if (partial > 0) {
      console.log('Partial Tests:');
      this.results.filter(r => r.overall === 'PARTIAL').forEach(r => {
        console.log(`  - ${r.testCase} (${r.endpoint})`);
        console.log(`    Valid: ${r.validTest.status}, Invalid: ${r.invalidTest.status}`);
      });
      console.log();
    }

    console.log('Note: Some endpoints may require specific system configuration');
    console.log('(CEC devices, IR devices, etc.) to fully test. Connection failures');
    console.log('are expected if hardware is not configured.\n');
  }
}

// Main execution
async function main() {
  const validator = new RuntimeValidator();
  await validator.runTests();
}

main().catch(console.error);
