# Testing Documentation

This document provides comprehensive information about the testing infrastructure for the Sports Bar TV Controller system.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Environment Configuration](#test-environment-configuration)
- [Test Suites](#test-suites)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Overview

The testing infrastructure includes both unit tests and integration tests that verify core system functionality, hardware interactions, and API endpoints with real system components.

### Test Framework

- **Framework**: Jest with ts-jest for TypeScript support
- **API Testing**: Supertest for HTTP endpoint testing
- **Integration**: Tests run against actual hardware when available
- **Configuration**: Separate configs for unit and integration tests

### Test Philosophy

- Tests should be **idempotent** (can run multiple times without side effects)
- Tests should **clean up after themselves**
- Hardware tests should **gracefully handle offline devices**
- Tests should **not break production** systems

## Test Structure

```
Sports-Bar-TV-Controller/
├── tests/
│   ├── integration/           # Integration tests
│   │   ├── api.test.ts        # API endpoint tests
│   │   ├── database.test.ts   # Database operations tests
│   │   ├── matrix.test.ts     # Matrix control tests
│   │   ├── hardware.test.ts   # Hardware connectivity tests
│   │   └── firetv.test.ts     # Fire TV control tests
│   ├── scenarios/             # User workflow scenarios
│   │   └── user-workflows.test.ts
│   ├── setup.ts               # Test environment setup
│   └── global-setup.ts        # Global test configuration
├── jest.config.js             # Jest config for unit tests
└── jest.config.integration.js # Jest config for integration tests
```

## Running Tests

### All Test Commands

```bash
# Run all unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run specific test suites
npm run test:api          # API integration tests
npm run test:database     # Database tests
npm run test:matrix       # Matrix control tests
npm run test:hardware     # Hardware connectivity tests
npm run test:firetv       # Fire TV tests
npm run test:scenarios    # User workflow scenarios

# Run all tests (unit + integration)
npm run test:all

# Run tests with coverage report
npm run test:coverage
```

### Running Individual Test Files

```bash
# Run a specific test file
npx jest tests/integration/api.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="Matrix"

# Run with verbose output
npx jest --verbose

# Run with debugging
DEBUG_TESTS=true npm run test:integration
```

## Test Environment Configuration

### Environment Variables

Create a `.env.test` file (or add to your existing `.env`):

```bash
# Database Configuration
DATABASE_URL=file:./prisma/data/sports_bar.db

# Matrix Configuration
MATRIX_IP=192.168.5.100
MATRIX_PORT=23

# AtlasIED Audio Processor
ATLASIED_IP=192.168.5.101

# Fire TV Configuration
TEST_FIRETV_IP=192.168.5.131
TEST_FIRETV_PORT=5555

# Test Server Configuration
TEST_BASE_URL=http://localhost:3000

# Test Control Flags
SKIP_HARDWARE_TESTS=false    # Set to 'true' to skip hardware tests
SKIP_NETWORK_TESTS=false     # Set to 'true' to skip network tests
DEBUG_TESTS=false            # Set to 'true' for verbose logging
```

### Running Tests Safely

#### Skip Hardware Tests

If you don't want to interact with real hardware:

```bash
SKIP_HARDWARE_TESTS=true npm run test:integration
```

#### Skip Network Tests

If the system is not running or you want to skip API tests:

```bash
SKIP_NETWORK_TESTS=true npm run test:integration
```

#### Database-Only Tests

To run only database tests (safe for production):

```bash
npm run test:database
```

## Test Suites

### 1. API Integration Tests (`tests/integration/api.test.ts`)

Tests all API endpoints with real HTTP requests.

**What it tests:**
- Health check endpoints
- Sports guide API
- Matrix command API
- CEC device API
- Backup API
- Error handling

**Requirements:**
- Next.js server running on TEST_BASE_URL (default: localhost:3000)
- Database accessible

**Skip with:** `SKIP_NETWORK_TESTS=true`

### 2. Database Integration Tests (`tests/integration/database.test.ts`)

Tests database connectivity, schema, and operations.

**What it tests:**
- Database file existence and permissions
- Database connection and WAL mode
- Schema and table structure
- CRUD operations
- Database integrity
- Transaction support

**Requirements:**
- Database file at DATABASE_URL location
- Read/write permissions

**Safe for production:** Yes (read-only operations)

### 3. Matrix Control Tests (`tests/integration/matrix.test.ts`)

Tests Wolf Pack Matrix hardware communication.

**What it tests:**
- TCP connectivity to matrix
- Command execution
- Response parsing
- Error handling
- Command format validation

**Requirements:**
- Wolf Pack Matrix at MATRIX_IP:MATRIX_PORT
- Network connectivity

**Skip with:** `SKIP_HARDWARE_TESTS=true`

**Warning:** Sends actual routing commands to hardware

### 4. Hardware Connectivity Tests (`tests/integration/hardware.test.ts`)

Tests network connectivity to all hardware devices.

**What it tests:**
- Ping reachability
- TCP port availability
- HTTP endpoint accessibility
- Connection performance
- Connectivity report generation

**Requirements:**
- Network access to devices
- Ping utility available

**Skip with:** `SKIP_HARDWARE_TESTS=true`

**Safe for production:** Yes (read-only, no state changes)

### 5. Fire TV Tests (`tests/integration/firetv.test.ts`)

Tests ADB connectivity and Fire TV device control.

**What it tests:**
- ADB installation and version
- Device connection/disconnection
- Command execution
- Connection recovery
- Health check detection

**Requirements:**
- ADB installed (`sudo apt-get install adb`)
- Fire TV device at TEST_FIRETV_IP
- ADB debugging enabled on Fire TV

**Skip with:** `SKIP_HARDWARE_TESTS=true`

### 6. User Workflow Scenarios (`tests/scenarios/user-workflows.test.ts`)

Tests complete user workflows and multi-step operations.

**What it tests:**
- System health monitoring workflows
- Video routing operations
- Sports guide access
- System configuration checks
- Multi-operation workflows
- Concurrent API calls

**Requirements:**
- Server running
- Hardware available (for routing tests)

**Skip with:** `SKIP_NETWORK_TESTS=true` or `SKIP_HARDWARE_TESTS=true`

## Writing New Tests

### Test Template

```typescript
/**
 * My Test Suite
 * Description of what this tests
 */

describe('My Test Suite', () => {
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';

  beforeAll(async () => {
    // Setup before all tests
  });

  afterAll(async () => {
    // Cleanup after all tests
  });

  beforeEach(async () => {
    // Setup before each test
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  describe('Feature Category', () => {
    test('should do something specific', async () => {
      if (skipHardwareTests) {
        console.log('Skipping hardware test');
        return;
      }

      // Test implementation
      const result = await someFunction();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }, 30000); // Timeout in ms
  });
});
```

### Best Practices

1. **Use descriptive test names**: Test names should clearly describe what is being tested
2. **Handle async operations**: Always use `async/await` for asynchronous tests
3. **Set appropriate timeouts**: Hardware tests may need longer timeouts (15-30 seconds)
4. **Respect skip flags**: Check `SKIP_HARDWARE_TESTS` and `SKIP_NETWORK_TESTS`
5. **Clean up resources**: Close connections, disconnect devices in `afterAll/afterEach`
6. **Log useful information**: Use `console.log` for debugging output
7. **Don't fail on expected conditions**: If hardware is offline, log it but don't fail test
8. **Make tests idempotent**: Tests should not depend on order or previous runs

### Adding New Test Files

1. Create test file in appropriate directory:
   - `tests/integration/` for integration tests
   - `tests/scenarios/` for user workflow tests
   - `src/lib/__tests__/` for unit tests

2. Follow naming convention: `*.test.ts`

3. Add npm script to `package.json` if needed:
   ```json
   "test:myfeature": "jest --config jest.config.integration.js tests/integration/myfeature.test.ts"
   ```

## Troubleshooting

### Common Issues

#### Tests timeout

**Problem:** Tests fail with timeout errors

**Solutions:**
- Increase timeout: `jest.setTimeout(60000)` or add timeout to individual tests
- Check network connectivity to hardware
- Verify hardware is online and responsive
- Use `SKIP_HARDWARE_TESTS=true` to skip slow hardware tests

#### Database locked

**Problem:** `database is locked` error

**Solutions:**
- Ensure no other processes are using the database
- Check WAL mode is enabled
- Close database connections in `afterAll` hooks
- Run tests serially: `maxWorkers: 1` in jest config

#### ADB not found

**Problem:** Fire TV tests fail with "ADB not installed"

**Solutions:**
- Install ADB: `sudo apt-get install adb`
- Verify installation: `which adb`
- Add ADB to PATH if needed

#### Matrix not responding

**Problem:** Matrix tests timeout or fail to connect

**Solutions:**
- Verify matrix IP address: `ping 192.168.5.100`
- Check port is open: `nc -zv 192.168.5.100 23`
- Ensure matrix is powered on
- Use `SKIP_HARDWARE_TESTS=true` to skip

#### Port already in use

**Problem:** Server tests fail because port 3000 is in use

**Solutions:**
- Change TEST_BASE_URL to different port
- Stop other Next.js instances
- Use different port for testing

### Debug Mode

Enable debug output:

```bash
DEBUG_TESTS=true npm run test:integration
```

This will show:
- Console.log output from tests
- Detailed error messages
- Network request/response details

## Expected Test Results

### Database Tests
- **Expected:** All tests pass if database exists and is accessible
- **Time:** ~2-5 seconds
- **Safe:** Yes, read-only operations

### API Tests
- **Expected:** Most tests pass if server is running
- **Time:** ~30-60 seconds
- **Notes:** Some endpoints may return errors if not configured (sports guide API key, etc.)

### Matrix Tests
- **Expected:** Tests pass if matrix is online, skip gracefully if offline
- **Time:** ~15-30 seconds
- **Warning:** Sends actual routing commands

### Hardware Tests
- **Expected:** Reports connectivity status, doesn't fail if devices offline
- **Time:** ~30-45 seconds
- **Safe:** Yes, no state changes

### Fire TV Tests
- **Expected:** Tests pass if ADB installed and device online
- **Time:** ~30-60 seconds
- **Requires:** ADB installed, device online

### User Workflow Tests
- **Expected:** Tests pass if system is healthy
- **Time:** ~60-120 seconds
- **Requires:** Server running, hardware available

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run database tests
        run: npm run test:database

      - name: Run unit tests
        run: npm test

      # Skip hardware tests in CI
      - name: Run integration tests (no hardware)
        env:
          SKIP_HARDWARE_TESTS: true
          SKIP_NETWORK_TESTS: true
        run: npm run test:integration
```

### Pre-deployment Testing

Before deploying to production:

```bash
# 1. Run database tests (safe)
npm run test:database

# 2. Run API tests (requires server)
npm run test:api

# 3. Optionally run hardware tests (use caution)
MATRIX_IP=192.168.5.100 npm run test:matrix
```

## Maintenance

### Regular Test Runs

Recommended schedule:
- **Daily:** Database and API tests
- **Weekly:** Full integration suite
- **Before deployment:** All tests
- **After hardware changes:** Hardware-specific tests

### Updating Tests

When adding new features:
1. Write tests for new API endpoints
2. Add hardware tests for new devices
3. Update user workflow tests for new features
4. Update this documentation

### Test Coverage

Generate coverage report:

```bash
npm run test:coverage
```

Coverage reports are in `coverage/` directory.

Target coverage goals:
- API routes: 80%+
- Database operations: 90%+
- Hardware controllers: 70%+
- Utilities: 85%+

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Wolf Pack Matrix Protocol](../docs/WOLF_PACK_PROTOCOL.md)
- [Fire TV ADB Commands](../docs/FIRETV_ADB_COMMANDS.md)

## Support

If you encounter issues with tests:

1. Check this documentation
2. Review test output and error messages
3. Enable DEBUG_TESTS for more information
4. Check hardware connectivity
5. Verify environment variables are set correctly

For questions or issues, contact the development team.
