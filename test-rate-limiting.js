#!/usr/bin/env node

/**
 * Rate Limiting Test Suite
 * Verifies rate limiting is working across different endpoint categories
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test configurations
const TESTS = [
  {
    name: 'Authentication Endpoint (AUTH config - 10 req/min)',
    path: '/api/health',
    method: 'GET',
    expectedLimit: 100, // SYSTEM config
    requestsToSend: 105,
    category: 'SYSTEM'
  },
  {
    name: 'Hardware Control Endpoint (HARDWARE config - 60 req/min)',
    path: '/api/cec/status',
    method: 'GET',
    expectedLimit: 60,
    requestsToSend: 65,
    category: 'HARDWARE'
  },
  {
    name: 'Sports Data Endpoint (SPORTS_DATA config - 30 req/min)',
    path: '/api/sports-guide/status',
    method: 'GET',
    expectedLimit: 30,
    requestsToSend: 35,
    category: 'SPORTS_DATA'
  }
];

/**
 * Make HTTP request
 */
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Run a single test
 */
async function runTest(test) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${test.name}`);
  console.log(`Path: ${test.path}`);
  console.log(`Expected Limit: ${test.expectedLimit} req/min`);
  console.log(`Category: ${test.category}`);
  console.log('='.repeat(70));

  const results = {
    successful: 0,
    rateLimited: 0,
    errors: 0,
    firstRateLimitAt: null,
    rateLimitHeaders: null
  };

  // Send requests rapidly
  for (let i = 1; i <= test.requestsToSend; i++) {
    try {
      const response = await makeRequest(test.path, test.method);

      if (response.statusCode === 429) {
        results.rateLimited++;
        if (!results.firstRateLimitAt) {
          results.firstRateLimitAt = i;
          results.rateLimitHeaders = {
            limit: response.headers['x-ratelimit-limit'],
            remaining: response.headers['x-ratelimit-remaining'],
            reset: response.headers['x-ratelimit-reset'],
            retryAfter: response.headers['retry-after']
          };
        }

        if (i <= 5 || i === results.firstRateLimitAt) {
          console.log(`[${i}/${test.requestsToSend}] 429 Too Many Requests`);
        }
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        results.successful++;
        if (i <= 5) {
          console.log(`[${i}/${test.requestsToSend}] ${response.statusCode} Success (Limit: ${response.headers['x-ratelimit-limit']}, Remaining: ${response.headers['x-ratelimit-remaining']})`);
        }
      } else {
        results.errors++;
        console.log(`[${i}/${test.requestsToSend}] ${response.statusCode} Error`);
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));

    } catch (error) {
      results.errors++;
      console.log(`[${i}/${test.requestsToSend}] Error: ${error.message}`);
    }
  }

  // Print results
  console.log('\n' + '-'.repeat(70));
  console.log('TEST RESULTS:');
  console.log('-'.repeat(70));
  console.log(`Total Requests Sent: ${test.requestsToSend}`);
  console.log(`Successful Responses: ${results.successful}`);
  console.log(`Rate Limited (429): ${results.rateLimited}`);
  console.log(`Errors: ${results.errors}`);

  if (results.firstRateLimitAt) {
    console.log(`\nRate Limiting Triggered At: Request #${results.firstRateLimitAt}`);
    console.log('\nRate Limit Headers:');
    console.log(`  X-RateLimit-Limit: ${results.rateLimitHeaders.limit}`);
    console.log(`  X-RateLimit-Remaining: ${results.rateLimitHeaders.remaining}`);
    console.log(`  X-RateLimit-Reset: ${results.rateLimitHeaders.reset}`);
    console.log(`  Retry-After: ${results.rateLimitHeaders.retryAfter}s`);
  }

  // Verify expectations
  console.log('\nVERIFICATION:');

  const limitMatches = results.rateLimitHeaders &&
    parseInt(results.rateLimitHeaders.limit) === test.expectedLimit;

  const rateLimitingWorking = results.rateLimited > 0;

  if (limitMatches) {
    console.log(`✓ Rate limit matches expected (${test.expectedLimit} req/min)`);
  } else {
    console.log(`✗ Rate limit does NOT match expected`);
    console.log(`  Expected: ${test.expectedLimit}, Got: ${results.rateLimitHeaders?.limit || 'N/A'}`);
  }

  if (rateLimitingWorking) {
    console.log(`✓ Rate limiting is working (${results.rateLimited} requests blocked)`);
  } else {
    console.log(`✗ Rate limiting NOT working (no 429 responses)`);
  }

  if (results.successful > 0) {
    console.log(`✓ Endpoint is accessible (${results.successful} successful requests)`);
  } else {
    console.log(`⚠ No successful requests (endpoint may be down)`);
  }

  return {
    test: test.name,
    passed: limitMatches && rateLimitingWorking,
    ...results
  };
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('RATE LIMITING TEST SUITE');
  console.log('═'.repeat(70));
  console.log(`Testing ${TESTS.length} endpoint categories`);
  console.log(`Base URL: ${BASE_URL}`);

  // Check if server is running
  try {
    await makeRequest('/api/health');
    console.log('✓ Server is running');
  } catch (error) {
    console.log('✗ Server is NOT running or not accessible');
    console.log('  Please ensure the application is running on port 3000');
    console.log(`  Error: ${error.message}`);
    process.exit(1);
  }

  const allResults = [];

  // Run tests sequentially
  for (const test of TESTS) {
    const result = await runTest(test);
    allResults.push(result);

    // Wait between tests to let rate limits reset
    console.log('\nWaiting 10 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Summary
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('TEST SUITE SUMMARY');
  console.log('═'.repeat(70));

  const passedTests = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;

  allResults.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${result.test}`);
    console.log(`       ${result.successful} successful, ${result.rateLimited} rate limited, ${result.errors} errors`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`Overall: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(70));

  if (passedTests === totalTests) {
    console.log('\n✓ All tests passed! Rate limiting is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed. Please review the results above.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
