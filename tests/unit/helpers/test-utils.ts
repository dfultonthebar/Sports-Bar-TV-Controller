/**
 * Unit Test Utilities
 *
 * Common mocks, factories, and helpers for unit tests
 */

/**
 * Sleep utility for testing timeouts and delays
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Create a mock function that fails after N successful calls
 */
export function createIntermittentFunction<T>(
  successValue: T,
  failAfter: number = 3,
  errorMessage: string = 'Simulated failure'
): jest.Mock {
  let callCount = 0
  return jest.fn(async () => {
    callCount++
    if (callCount > failAfter) {
      throw new Error(errorMessage)
    }
    return successValue
  })
}

/**
 * Create a mock function that succeeds after N failures
 */
export function createRecoveringFunction<T>(
  successValue: T,
  failCount: number = 3,
  errorMessage: string = 'Simulated failure'
): jest.Mock {
  let callCount = 0
  return jest.fn(async () => {
    callCount++
    if (callCount <= failCount) {
      throw new Error(errorMessage)
    }
    return successValue
  })
}

/**
 * Create a mock function that times out after specified delay
 */
export function createSlowFunction<T>(
  returnValue: T,
  delay: number
): jest.Mock {
  return jest.fn(async () => {
    await sleep(delay)
    return returnValue
  })
}

/**
 * Create a mock function that randomly fails with specified probability
 */
export function createRandomFailureFunction<T>(
  successValue: T,
  failureProbability: number = 0.5,
  errorMessage: string = 'Random failure'
): jest.Mock {
  return jest.fn(async () => {
    if (Math.random() < failureProbability) {
      throw new Error(errorMessage)
    }
    return successValue
  })
}

/**
 * Mock logger for testing
 */
export const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  database: {
    query: jest.fn(),
    success: jest.fn(),
    error: jest.fn()
  }
})

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()

  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout exceeded')
    }
    await sleep(interval)
  }
}

/**
 * Assert that a promise rejects with a specific error message
 */
export async function expectAsyncError(
  promise: Promise<any>,
  expectedMessage?: string | RegExp
): Promise<void> {
  try {
    await promise
    throw new Error('Expected promise to reject but it resolved')
  } catch (error: any) {
    if (expectedMessage) {
      if (typeof expectedMessage === 'string') {
        expect(error.message).toContain(expectedMessage)
      } else {
        expect(error.message).toMatch(expectedMessage)
      }
    }
  }
}

/**
 * Create a mock database transaction context
 */
export function createMockTransaction() {
  return {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis()
  }
}

/**
 * Generate random test data
 */
export const generateTestData = {
  /**
   * Generate random string
   */
  string: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, 2 + length)
  },

  /**
   * Generate random number in range
   */
  number: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  /**
   * Generate random boolean
   */
  boolean: (): boolean => {
    return Math.random() > 0.5
  },

  /**
   * Generate random email
   */
  email: (): string => {
    return `test_${generateTestData.string(8)}@example.com`
  },

  /**
   * Generate random IP address
   */
  ip: (): string => {
    return `${generateTestData.number(1, 255)}.${generateTestData.number(0, 255)}.${generateTestData.number(0, 255)}.${generateTestData.number(0, 255)}`
  },

  /**
   * Generate random timestamp
   */
  timestamp: (daysAgo: number = 0): number => {
    return Date.now() - (daysAgo * 24 * 60 * 60 * 1000)
  },

  /**
   * Generate array of test items
   */
  array: <T>(generator: () => T, count: number): T[] => {
    return Array.from({ length: count }, generator)
  }
}

/**
 * Mock timer utilities
 */
export const mockTimers = {
  /**
   * Setup fake timers for a test
   */
  setup: () => {
    jest.useFakeTimers()
  },

  /**
   * Advance timers by specified time
   */
  advance: async (ms: number) => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve() // Allow promises to resolve
  },

  /**
   * Run all pending timers
   */
  runAll: async () => {
    jest.runAllTimers()
    await Promise.resolve()
  },

  /**
   * Restore real timers
   */
  restore: () => {
    jest.useRealTimers()
  }
}

/**
 * Assertion helpers
 */
export const assertHelpers = {
  /**
   * Assert object contains subset of properties
   */
  containsSubset: (obj: any, subset: any) => {
    Object.keys(subset).forEach(key => {
      expect(obj).toHaveProperty(key)
      expect(obj[key]).toEqual(subset[key])
    })
  },

  /**
   * Assert array contains items matching predicate
   */
  arrayContainsMatching: <T>(arr: T[], predicate: (item: T) => boolean, expectedCount: number = 1) => {
    const matches = arr.filter(predicate)
    expect(matches.length).toBe(expectedCount)
  },

  /**
   * Assert value is within range
   */
  inRange: (value: number, min: number, max: number) => {
    expect(value).toBeGreaterThanOrEqual(min)
    expect(value).toBeLessThanOrEqual(max)
  },

  /**
   * Assert timestamps are close (within tolerance)
   */
  timestampsClose: (ts1: number, ts2: number, toleranceMs: number = 1000) => {
    const diff = Math.abs(ts1 - ts2)
    expect(diff).toBeLessThan(toleranceMs)
  }
}

/**
 * Performance testing helpers
 */
export const performanceHelpers = {
  /**
   * Measure execution time of a function
   */
  measure: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = Date.now()
    const result = await fn()
    const duration = Date.now() - start
    return { result, duration }
  },

  /**
   * Assert function executes within time limit
   */
  assertFastExecution: async <T>(
    fn: () => Promise<T>,
    maxDuration: number
  ): Promise<T> => {
    const { result, duration } = await performanceHelpers.measure(fn)
    expect(duration).toBeLessThan(maxDuration)
    return result
  }
}

/**
 * Cleanup utilities
 */
export const cleanup = {
  /**
   * Reset all mocks
   */
  resetMocks: () => {
    jest.clearAllMocks()
    jest.resetAllMocks()
  },

  /**
   * Clear all intervals and timeouts
   */
  clearTimers: () => {
    jest.clearAllTimers()
  }
}
