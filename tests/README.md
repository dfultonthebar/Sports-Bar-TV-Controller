# Integration Tests

This directory contains integration tests for the Sports Bar TV Controller system.

## Quick Start

### Run Safe Tests (No Hardware Interaction)

```bash
# Run the safe test suite
./scripts/run-safe-tests.sh

# Or run individually
npm run test:database
SKIP_HARDWARE_TESTS=true npm run test:hardware
```

### Run All Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:api
npm run test:database
npm run test:matrix
npm run test:hardware
npm run test:firetv
npm run test:scenarios
```

## Directory Structure

```
tests/
├── integration/          # Integration tests
│   ├── api.test.ts      # API endpoint tests
│   ├── database.test.ts # Database operations tests
│   ├── matrix.test.ts   # Wolf Pack Matrix control tests
│   ├── hardware.test.ts # Hardware connectivity tests
│   └── firetv.test.ts   # Fire TV control tests
├── scenarios/           # User workflow tests
│   └── user-workflows.test.ts
├── setup.ts            # Test environment setup
└── global-setup.ts     # Global test configuration
```

## Test Suites

### Database Tests (`integration/database.test.ts`)
Tests database connectivity, schema, and operations.
- **Safe:** Yes (read-only)
- **Requirements:** Database file exists
- **Command:** `npm run test:database`

### Hardware Tests (`integration/hardware.test.ts`)
Tests network connectivity to all hardware devices.
- **Safe:** Yes (no state changes)
- **Requirements:** Network access
- **Command:** `npm run test:hardware`

### Matrix Tests (`integration/matrix.test.ts`)
Tests Wolf Pack Matrix TCP communication and routing.
- **Safe:** No (sends actual routing commands)
- **Requirements:** Matrix at 192.168.5.100:23
- **Command:** `npm run test:matrix`

### API Tests (`integration/api.test.ts`)
Tests all REST API endpoints.
- **Safe:** Mostly (some endpoints modify state)
- **Requirements:** Server running at localhost:3000
- **Command:** `npm run test:api`

### Fire TV Tests (`integration/firetv.test.ts`)
Tests ADB connectivity and Fire TV control.
- **Safe:** Yes (read-only operations)
- **Requirements:** ADB installed, Fire TV online
- **Command:** `npm run test:firetv`

### User Workflows (`scenarios/user-workflows.test.ts`)
Tests complete user workflows and multi-step operations.
- **Safe:** No (includes routing operations)
- **Requirements:** Server running, hardware available
- **Command:** `npm run test:scenarios`

## Environment Variables

Create `.env.test` or set these variables:

```bash
# Database
DATABASE_URL=file:./prisma/data/sports_bar.db

# Hardware
MATRIX_IP=192.168.5.100
MATRIX_PORT=23
ATLASIED_IP=192.168.5.101
TEST_FIRETV_IP=192.168.5.131

# Server
TEST_BASE_URL=http://localhost:3000

# Test Control
SKIP_HARDWARE_TESTS=false  # Set to 'true' to skip hardware tests
SKIP_NETWORK_TESTS=false   # Set to 'true' to skip network tests
DEBUG_TESTS=false          # Set to 'true' for verbose output
```

## Best Practices

1. **Always run safe tests first**
   ```bash
   npm run test:database
   ```

2. **Use skip flags when appropriate**
   ```bash
   SKIP_HARDWARE_TESTS=true npm run test:integration
   ```

3. **Run specific test suites during development**
   ```bash
   npm run test:database -- --watch
   ```

4. **Check hardware is ready before running hardware tests**
   ```bash
   ping 192.168.5.100  # Check matrix
   npm run test:matrix
   ```

## Writing Tests

See `docs/TESTING.md` for detailed information on:
- Test structure and conventions
- Adding new tests
- Best practices
- Troubleshooting

## Example Test

```typescript
describe('My Feature', () => {
  const skipHardwareTests = process.env.SKIP_HARDWARE_TESTS === 'true';

  test('should do something', async () => {
    if (skipHardwareTests) {
      console.log('Skipping hardware test');
      return;
    }

    const result = await myFunction();
    expect(result).toBeDefined();
  }, 30000);
});
```

## Common Issues

### Tests Timeout
- Increase timeout: Add timeout parameter to test
- Check hardware connectivity
- Use skip flags

### Database Locked
- Ensure WAL mode is enabled
- Close other database connections

### ADB Not Found
- Install: `sudo apt-get install adb`
- Verify: `which adb`

### Port Already in Use
- Check server is not already running
- Change TEST_BASE_URL to different port

## Documentation

- **Full Testing Guide:** `docs/TESTING.md`
- **Test Results:** `docs/TEST_RESULTS.md`
- **Example .env:** `.env.test.example`

## Support

For issues or questions:
1. Check `docs/TESTING.md`
2. Review test output
3. Enable `DEBUG_TESTS=true`
4. Contact development team
