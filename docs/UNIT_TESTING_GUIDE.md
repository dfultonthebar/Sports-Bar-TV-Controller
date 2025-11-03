# Unit Testing Guide

## Overview

This document provides comprehensive guidance for writing and maintaining unit tests in the Sports-Bar-TV-Controller system.

## Table of Contents

1. [Test Structure](#test-structure)
2. [Running Tests](#running-tests)
3. [Writing Unit Tests](#writing-unit-tests)
4. [Best Practices](#best-practices)
5. [Test Utilities](#test-utilities)
6. [Coverage Guidelines](#coverage-guidelines)
7. [Troubleshooting](#troubleshooting)

---

## Test Structure

### Directory Layout

```
tests/
├── unit/                          # Unit tests (isolated module testing)
│   ├── lib/                       # Tests for lib modules
│   │   ├── circuit-breaker.test.ts
│   │   ├── rate-limiter.test.ts
│   │   ├── transaction-wrapper.test.ts
│   │   └── cache-manager.test.ts
│   └── helpers/                   # Test utilities and helpers
│       └── test-utils.ts
├── integration/                   # Integration tests (system-level testing)
│   ├── api.test.ts
│   ├── database.test.ts
│   └── hardware.test.ts
├── scenarios/                     # End-to-end workflow tests
├── security/                      # Security-focused tests
└── setup.ts                       # Global test setup
```

### Test File Naming

- Unit tests: `[module-name].test.ts`
- Integration tests: `[feature-name].test.ts`
- Place tests near what they test when possible

---

## Running Tests

### Commands

```bash
# Run all unit tests
npm test -- tests/unit/

# Run specific test file
npm test -- tests/unit/lib/circuit-breaker.test.ts

# Run with coverage
npm test -- tests/unit/ --coverage

# Run in watch mode
npm test -- tests/unit/ --watch

# Run with verbose output
npm test -- tests/unit/ --verbose

# Run all tests (unit + integration)
npm run test:all
```

### Coverage Reports

Generate coverage for specific modules:

```bash
# Coverage for critical modules only
npm test -- tests/unit/lib/ --coverage --collectCoverageFrom='src/lib/{circuit-breaker,rate-limiting,cache-manager,db}/**/*.ts'
```

---

## Writing Unit Tests

### Test Anatomy (AAA Pattern)

Every test should follow the **Arrange-Act-Assert** pattern:

```typescript
it('should do something specific', () => {
  // ARRANGE: Set up test data and mocks
  const input = { data: 'test' }
  const mockFn = jest.fn(() => 'result')

  // ACT: Execute the function under test
  const result = functionUnderTest(input, mockFn)

  // ASSERT: Verify expected outcomes
  expect(result).toBe('result')
  expect(mockFn).toHaveBeenCalledWith(input)
})
```

### Example: Testing the Circuit Breaker

```typescript
import { createCircuitBreaker } from '@/lib/circuit-breaker'
import { sleep } from '../helpers/test-utils'

describe('Circuit Breaker', () => {
  describe('State Transitions', () => {
    it('should open circuit after error threshold exceeded', async () => {
      // ARRANGE
      const failingFn = jest.fn(async () => {
        throw new Error('Test failure')
      })

      const breaker = createCircuitBreaker(failingFn, {
        name: 'test-circuit',
        errorThresholdPercentage: 50,
        volumeThreshold: 3
      })

      // ACT: Generate failures
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire()
        } catch (error) {
          // Expected to fail
        }
      }

      // ASSERT
      expect(breaker.opened).toBe(true)
      expect(failingFn).toHaveBeenCalled()
    })
  })
})
```

---

## Best Practices

### 1. Isolation

✅ **DO**: Mock external dependencies

```typescript
// Mock the database
jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn((callback) => callback(mockTx))
  }
}))
```

❌ **DON'T**: Access real external services

```typescript
// Don't do this in unit tests
const realDb = require('@/db')
const result = realDb.query('SELECT * FROM users')
```

### 2. Test Naming

✅ **DO**: Use descriptive test names

```typescript
it('should return cached value if exists', async () => { })
it('should fetch and cache if not exists', async () => { })
it('should expire entries after TTL', async () => { })
```

❌ **DON'T**: Use vague test names

```typescript
it('works', () => { })
it('test 1', () => { })
it('handles stuff', () => { })
```

### 3. One Assertion Per Concept

✅ **DO**: Test one logical concept per test

```typescript
it('should track success count', () => {
  performSuccessfulOperation()
  expect(stats.successes).toBe(1)
})

it('should track failure count', () => {
  performFailedOperation()
  expect(stats.failures).toBe(1)
})
```

❌ **DON'T**: Test multiple unrelated things

```typescript
it('should do everything', () => {
  expect(createUser()).toBeTruthy()
  expect(deleteUser()).toBeTruthy()
  expect(getAnalytics()).toBeTruthy()
  expect(sendEmail()).toBeTruthy()
})
```

### 4. Clean State

✅ **DO**: Reset state between tests

```typescript
beforeEach(() => {
  jest.clearAllMocks()
  testCache.clear()
  TransactionMonitor.reset()
})

afterEach(() => {
  testCache.stopCleanup() // Prevent memory leaks
})
```

### 5. Fast Execution

✅ **DO**: Keep unit tests fast (< 100ms each)

```typescript
// Use small timeouts for testing
it('should timeout quickly', async () => {
  const breaker = createCircuitBreaker(slowFn, {
    timeout: 10 // Small timeout for tests
  })
  await expect(breaker.fire()).rejects.toThrow()
})
```

❌ **DON'T**: Use long timeouts unnecessarily

```typescript
// Avoid this - makes tests slow
await sleep(5000) // 5 seconds!
```

### 6. Test Edge Cases

Always test:
- **Empty inputs**: `[], '', null, undefined`
- **Boundary values**: `0, -1, MAX_INT`
- **Invalid inputs**: Wrong types, malformed data
- **Error conditions**: Network failures, timeouts, exceptions

```typescript
describe('Edge Cases', () => {
  it('should handle empty string keys', () => {
    cache.set('type', '', 'value')
    expect(cache.get('type', '')).toBe('value')
  })

  it('should handle zero TTL', async () => {
    cache.set('type', 'key', 'value', 0)
    await sleep(10)
    expect(cache.get('type', 'key')).toBeNull()
  })
})
```

---

## Test Utilities

The `tests/unit/helpers/test-utils.ts` file provides helpful utilities:

### Sleep/Delay

```typescript
import { sleep } from '../helpers/test-utils'

it('should expire after timeout', async () => {
  cache.set('key', 'value', 100) // 100ms TTL
  await sleep(150)
  expect(cache.get('key')).toBeNull()
})
```

### Mock Functions

```typescript
import { createRecoveringFunction, createSlowFunction } from '../helpers/test-utils'

// Function that fails N times then succeeds
const fn = createRecoveringFunction('success', 3) // Fails 3 times

// Function that takes time to execute
const slowFn = createSlowFunction('result', 1000) // Takes 1 second
```

### Wait For Condition

```typescript
import { waitFor } from '../helpers/test-utils'

it('should eventually become ready', async () => {
  startAsyncOperation()

  await waitFor(
    () => service.isReady(),
    5000, // 5 second timeout
    100   // Check every 100ms
  )

  expect(service.isReady()).toBe(true)
})
```

### Generate Test Data

```typescript
import { generateTestData } from '../helpers/test-utils'

it('should handle multiple IPs', () => {
  const ips = generateTestData.array(() => generateTestData.ip(), 100)

  ips.forEach(ip => {
    rateLimiter.checkLimit(ip, config)
  })
})
```

### Mock Database Transaction

```typescript
import { createMockTransaction } from '../helpers/test-utils'

it('should execute database operations', () => {
  const mockTx = createMockTransaction()

  const operation = (tx) => {
    return tx.insert().values({ data }).returning().get()
  }

  withTransaction(operation)
})
```

---

## Coverage Guidelines

### Target Coverage

**Critical Business Logic** (Circuit breaker, rate limiting, transactions):
- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 90%

**Supporting Infrastructure** (Utilities, helpers):
- **Line Coverage**: > 70%
- **Branch Coverage**: > 60%

**Don't Test** (Not worth the effort):
- Framework code (Next.js, Drizzle internals)
- Simple getters/setters
- Trivial pass-through functions
- External library behavior

### Viewing Coverage

```bash
# Generate coverage report
npm test -- tests/unit/ --coverage

# Generate HTML report
npm test -- tests/unit/ --coverage --coverageReporters=html

# Open in browser
open coverage/index.html
```

### Coverage Metrics Explained

- **Line Coverage**: % of code lines executed
- **Branch Coverage**: % of if/else branches executed
- **Function Coverage**: % of functions called
- **Statement Coverage**: % of statements executed

---

## Troubleshooting

### Tests Timing Out

**Problem**: Tests hang or timeout

**Solutions**:
1. Stop cleanup intervals:
   ```typescript
   afterEach(() => {
     rateLimiter.stopCleanup()
     cache.stopCleanup()
   })
   ```

2. Use shorter timeouts in tests:
   ```typescript
   jest.setTimeout(10000) // 10 seconds
   ```

3. Check for unresolved promises

### Flaky Tests

**Problem**: Tests pass sometimes, fail sometimes

**Solutions**:
1. Remove race conditions:
   ```typescript
   // Bad
   setTimeout(() => expect(value).toBe(true), 100)

   // Good
   await waitFor(() => value === true)
   ```

2. Clear state between tests:
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks()
     testService.reset()
   })
   ```

3. Don't depend on execution order

### Mock Not Working

**Problem**: Mocks not being used

**Solutions**:
1. Ensure mock is defined before import:
   ```typescript
   // Mock BEFORE import
   jest.mock('@/lib/logger')

   // Then import
   import { logger } from '@/lib/logger'
   ```

2. Check mock path matches exactly:
   ```typescript
   // Must match actual import path
   jest.mock('@/db') // If code uses '@/db'
   ```

3. Use `jest.clearAllMocks()` in `beforeEach()`

### Memory Leaks

**Problem**: Tests use increasing memory

**Solutions**:
1. Stop intervals:
   ```typescript
   afterEach(() => {
     clearInterval(interval)
     service.cleanup()
   })
   ```

2. Clear caches:
   ```typescript
   afterEach(() => {
     cache.clear()
   })
   ```

3. Use `--detectOpenHandles` to find leaks:
   ```bash
   npm test -- --detectOpenHandles
   ```

---

## Test Coverage Summary

### Current Status

| Module | Tests | Coverage | Status |
|--------|-------|----------|--------|
| Circuit Breaker | 31 tests | ~95% | ✅ Excellent |
| Rate Limiter | 48 tests | ~90% | ✅ Excellent |
| Transaction Wrapper | 37 tests | ~85% | ✅ Good |
| Cache Manager | 47 tests | ~92% | ✅ Excellent |
| **TOTAL** | **163 tests** | **~90%** | ✅ **Excellent** |

---

## Adding New Tests

### Checklist for New Unit Tests

- [ ] Test file created in appropriate directory
- [ ] Tests follow AAA pattern
- [ ] External dependencies mocked
- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Edge cases tested
- [ ] Tests are fast (< 100ms each)
- [ ] Tests are isolated (no shared state)
- [ ] Cleanup in `afterEach()`
- [ ] Descriptive test names
- [ ] Coverage > 80% for new code

### Template for New Test File

```typescript
/**
 * [Module Name] Unit Tests
 *
 * Tests the [module name] in isolation
 * Focus: [key areas to test]
 */

import { moduleFunction } from '@/lib/module'
import { sleep } from '../helpers/test-utils'

// Mock dependencies
jest.mock('@/lib/dependency', () => ({
  dependency: jest.fn()
}))

describe('[Module Name] - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup
  })

  describe('Basic Functionality', () => {
    it('should do the main thing', () => {
      // ARRANGE
      const input = 'test'

      // ACT
      const result = moduleFunction(input)

      // ASSERT
      expect(result).toBe('expected')
    })
  })

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      expect(() => moduleFunction(null)).toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      expect(moduleFunction('')).toBeDefined()
    })
  })
})
```

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Test Utilities](/tests/unit/helpers/test-utils.ts)
- [Integration Testing Guide](/tests/README.md)

---

## Conclusion

Good unit tests are:
- **Fast** - Execute in milliseconds
- **Isolated** - No external dependencies
- **Repeatable** - Same result every time
- **Self-validating** - Pass/fail is obvious
- **Timely** - Written alongside code

Follow these guidelines to maintain high-quality, maintainable tests that give confidence in the codebase.
