/**
 * Global setup - runs once before all test suites
 */

import dotenv from 'dotenv';

export default async () => {
  // Load environment variables
  dotenv.config();

  console.log('\n=== Integration Test Environment Setup ===\n');

  // Check critical environment variables
  const criticalVars = {
    'DATABASE_URL': process.env.DATABASE_URL,
    'MATRIX_IP': process.env.MATRIX_IP || '192.168.5.100',
    'MATRIX_PORT': process.env.MATRIX_PORT || '23',
  };

  console.log('Environment Configuration:');
  Object.entries(criticalVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value || '(not set)'}`);
  });

  // Warn about optional configurations
  const optionalVars = {
    'SKIP_HARDWARE_TESTS': process.env.SKIP_HARDWARE_TESTS,
    'SKIP_NETWORK_TESTS': process.env.SKIP_NETWORK_TESTS,
    'TEST_FIRETV_IP': process.env.TEST_FIRETV_IP,
  };

  console.log('\nOptional Test Configuration:');
  Object.entries(optionalVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value || '(not set - will use defaults)'}`);
  });

  console.log('\n==========================================\n');
};
