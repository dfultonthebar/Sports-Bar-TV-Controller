/**
 * Test setup file - runs before all tests
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Set test environment (bypass readonly check)
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for important failures
  };
}
