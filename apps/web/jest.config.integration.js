/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/integration/**/*.test.ts', '**/scenarios/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  // Longer timeout for hardware/network tests
  testTimeout: 30000,
  // Run tests serially to avoid conflicts with real hardware
  maxWorkers: 1,
  // Verbose output for debugging
  verbose: true,
  // Skip tests if environment variables aren't set
  globalSetup: '<rootDir>/tests/global-setup.ts',
};
