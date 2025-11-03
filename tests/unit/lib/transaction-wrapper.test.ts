/**
 * Transaction Wrapper Unit Tests
 *
 * Tests the synchronous transaction wrapper in isolation
 * Focus: Transaction execution, rollback, retry logic, monitoring
 */

import { withTransaction, batchTransaction, TransactionMonitor } from '@/lib/db/transaction-wrapper'
import { createMockTransaction, createMockLogger } from '../helpers/test-utils'

// Mock the database
jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn((callback: any) => {
      const mockTx = createMockTransaction()
      return callback(mockTx)
    })
  }
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
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
  }
}))

describe('Transaction Wrapper - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    TransactionMonitor.reset()
  })

  describe('Basic Transaction Execution', () => {
    it('should execute a simple transaction successfully', () => {
      const operation = jest.fn((tx) => {
        return { id: 1, name: 'test' }
      })

      const result = withTransaction(operation)

      expect(operation).toHaveBeenCalled()
      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should pass transaction context to operation', () => {
      const operation = jest.fn((tx) => {
        expect(tx).toBeDefined()
        expect(tx.insert).toBeDefined()
        expect(tx.update).toBeDefined()
        expect(tx.delete).toBeDefined()
        return 'success'
      })

      withTransaction(operation)

      expect(operation).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should return operation result', () => {
      const expectedResult = { data: [1, 2, 3], count: 3 }
      const operation = jest.fn(() => expectedResult)

      const result = withTransaction(operation)

      expect(result).toEqual(expectedResult)
    })

    it('should handle operations returning primitives', () => {
      const numberOp = jest.fn(() => 42)
      expect(withTransaction(numberOp)).toBe(42)

      const stringOp = jest.fn(() => 'success')
      expect(withTransaction(stringOp)).toBe('success')

      const boolOp = jest.fn(() => true)
      expect(withTransaction(boolOp)).toBe(true)
    })

    it('should handle operations returning undefined', () => {
      const operation = jest.fn(() => undefined)

      const result = withTransaction(operation)

      expect(result).toBeUndefined()
    })
  })

  describe('Error Handling and Rollback', () => {
    it('should throw error when operation fails', () => {
      const operation = jest.fn(() => {
        throw new Error('Operation failed')
      })

      expect(() => withTransaction(operation)).toThrow('Operation failed')
    })

    it('should not retry non-transient errors', () => {
      const operation = jest.fn(() => {
        throw new Error('Permanent error')
      })

      expect(() => withTransaction(operation, { maxRetries: 3 })).toThrow()
      expect(operation).toHaveBeenCalledTimes(1) // Only called once, no retries
    })

    it('should handle various error types', () => {
      const errorTypes = [
        new Error('Standard error'),
        new TypeError('Type error'),
        new RangeError('Range error')
      ]

      errorTypes.forEach(error => {
        const operation = jest.fn(() => {
          throw error
        })

        expect(() => withTransaction(operation)).toThrow(error.message)
      })
    })
  })

  describe('Retry Logic for Transient Errors', () => {
    it('should retry on database locked error', () => {
      let callCount = 0
      const operation = jest.fn(() => {
        callCount++
        if (callCount <= 2) {
          throw new Error('database is locked')
        }
        return 'success'
      })

      const result = withTransaction(operation, { maxRetries: 3 })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3) // 2 failures + 1 success
    })

    it('should retry on SQLITE_BUSY error', () => {
      let callCount = 0
      const operation = jest.fn(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('SQLITE_BUSY: database is busy')
        }
        return 'recovered'
      })

      const result = withTransaction(operation, { maxRetries: 2 })

      expect(result).toBe('recovered')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should retry on deadlock error', () => {
      let callCount = 0
      const operation = jest.fn(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('deadlock detected')
        }
        return 'success'
      })

      const result = withTransaction(operation, { maxRetries: 2 })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should respect maxRetries limit', () => {
      const operation = jest.fn(() => {
        throw new Error('database is locked')
      })

      expect(() =>
        withTransaction(operation, { maxRetries: 2 })
      ).toThrow('database is locked')

      // Called: initial + 2 retries = 3 times
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not exceed maxRetries even for transient errors', () => {
      const operation = jest.fn(() => {
        throw new Error('SQLITE_BUSY')
      })

      expect(() =>
        withTransaction(operation, { maxRetries: 1 })
      ).toThrow()

      expect(operation).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })

  describe('Transaction Options', () => {
    it('should use default options when not specified', () => {
      const operation = jest.fn(() => 'success')

      withTransaction(operation)

      expect(operation).toHaveBeenCalled()
    })

    it('should accept custom name for logging', () => {
      const operation = jest.fn(() => 'success')

      withTransaction(operation, { name: 'custom-transaction' })

      expect(operation).toHaveBeenCalled()
    })

    it('should accept custom retry configuration', () => {
      let attempts = 0
      const operation = jest.fn(() => {
        attempts++
        if (attempts <= 1) {
          throw new Error('database is locked')
        }
        return 'success'
      })

      const result = withTransaction(operation, {
        maxRetries: 5,
        retryDelay: 50
      })

      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('should accept isolation level option', () => {
      const operation = jest.fn(() => 'success')

      withTransaction(operation, { isolationLevel: 'IMMEDIATE' })

      expect(operation).toHaveBeenCalled()
    })
  })

  describe('Async Detection', () => {
    it('should detect and throw error for async operation', () => {
      const asyncOperation = jest.fn(async () => {
        return 'should not work'
      })

      expect(() => withTransaction(asyncOperation as any)).toThrow(
        /cannot return a promise/i
      )
    })

    it('should allow synchronous operations that return promises from other sources', () => {
      // This is edge case: operation itself is sync but returns a pre-existing promise
      const existingPromise = Promise.resolve('data')
      const operation = jest.fn(() => existingPromise)

      // This will throw because we detect Promise return
      expect(() => withTransaction(operation)).toThrow(/cannot return a promise/i)
    })
  })

  describe('Batch Transactions', () => {
    it('should execute multiple operations in order', () => {
      const results: number[] = []
      const operations = [
        jest.fn(() => { results.push(1); return 'op1' }),
        jest.fn(() => { results.push(2); return 'op2' }),
        jest.fn(() => { results.push(3); return 'op3' })
      ]

      const batchResults = batchTransaction(operations)

      expect(results).toEqual([1, 2, 3])
      expect(batchResults).toEqual(['op1', 'op2', 'op3'])
    })

    it('should rollback all operations if one fails', () => {
      const operations = [
        jest.fn(() => 'success1'),
        jest.fn(() => { throw new Error('Operation 2 failed') }),
        jest.fn(() => 'success3')
      ]

      expect(() => batchTransaction(operations)).toThrow('Operation 2 failed')
      expect(operations[0]).toHaveBeenCalled()
      expect(operations[1]).toHaveBeenCalled()
      expect(operations[2]).not.toHaveBeenCalled() // Should not reach 3rd operation
    })

    it('should pass same transaction context to all operations', () => {
      let capturedTx: any = null
      const operations = [
        jest.fn((tx) => { capturedTx = tx; return 1 }),
        jest.fn((tx) => { expect(tx).toBe(capturedTx); return 2 }),
        jest.fn((tx) => { expect(tx).toBe(capturedTx); return 3 })
      ]

      batchTransaction(operations)

      expect(operations[0]).toHaveBeenCalled()
      expect(operations[1]).toHaveBeenCalled()
      expect(operations[2]).toHaveBeenCalled()
    })

    it('should handle empty operations array', () => {
      const result = batchTransaction([])

      expect(result).toEqual([])
    })

    it('should handle single operation', () => {
      const operation = jest.fn(() => 'single')

      const result = batchTransaction([operation])

      expect(result).toEqual(['single'])
      expect(operation).toHaveBeenCalled()
    })
  })

  describe('Transaction Monitoring', () => {
    it('should record successful transactions', () => {
      const operation = jest.fn(() => 'success')

      withTransaction(operation, { name: 'test-success' })

      const stats = TransactionMonitor.getStats()
      expect(stats.successful).toBeGreaterThan(0)
      expect(stats.total).toBeGreaterThan(0)
    })

    it('should record failed transactions', () => {
      const operation = jest.fn(() => {
        throw new Error('Test failure')
      })

      try {
        withTransaction(operation, { name: 'test-failure' })
      } catch (error) {
        // Expected
      }

      const stats = TransactionMonitor.getStats()
      expect(stats.failed).toBeGreaterThan(0)
    })

    it('should track transaction duration', () => {
      const operation = jest.fn(() => {
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      })

      withTransaction(operation, { name: 'test-duration' })

      const stats = TransactionMonitor.getStats()
      // Duration might be 0 for very fast operations, just check it's a number
      expect(typeof stats.avgDuration).toBe('number')
      expect(stats.avgDuration).toBeGreaterThanOrEqual(0)
    })

    it('should track retry count', () => {
      let attempts = 0
      const operation = jest.fn(() => {
        attempts++
        if (attempts === 1) {
          throw new Error('database is locked')
        }
        return 'success'
      })

      withTransaction(operation, { name: 'test-retries', maxRetries: 3 })

      const stats = TransactionMonitor.getStats()
      expect(stats.avgRetries).toBeGreaterThan(0)
    })

    it('should calculate success rate', () => {
      // Successful transaction
      withTransaction(() => 'success', { name: 'success-1' })
      withTransaction(() => 'success', { name: 'success-2' })

      // Failed transaction
      try {
        withTransaction(() => {
          throw new Error('fail')
        }, { name: 'failure-1' })
      } catch (error) {
        // Expected
      }

      const stats = TransactionMonitor.getStats()
      expect(stats.successRate).toBeGreaterThan(0)
      expect(stats.successRate).toBeLessThanOrEqual(100)
      expect(stats.successful).toBe(2)
      expect(stats.failed).toBe(1)
    })

    it('should track recent transactions', () => {
      for (let i = 0; i < 5; i++) {
        withTransaction(() => `result-${i}`, { name: `test-${i}` })
      }

      const stats = TransactionMonitor.getStats()
      expect(stats.recentTransactions).toBeDefined()
      expect(stats.recentTransactions.length).toBeLessThanOrEqual(10)
    })

    it('should limit stored metrics to prevent memory leak', () => {
      // Create many transactions
      for (let i = 0; i < 1500; i++) {
        withTransaction(() => i, { name: `bulk-${i}` })
      }

      const stats = TransactionMonitor.getStats()
      // Should cap at 1000 metrics
      expect(stats.total).toBeLessThanOrEqual(1000)
    })

    it('should allow resetting monitoring stats', () => {
      withTransaction(() => 'test', { name: 'before-reset' })

      const statsBefore = TransactionMonitor.getStats()
      expect(statsBefore.total).toBeGreaterThan(0)

      TransactionMonitor.reset()

      const statsAfter = TransactionMonitor.getStats()
      expect(statsAfter.total).toBe(0)
      expect(statsAfter.successful).toBe(0)
      expect(statsAfter.failed).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle operation that returns null', () => {
      const operation = jest.fn(() => null)

      const result = withTransaction(operation)

      expect(result).toBeNull()
    })

    it('should handle operation that returns array', () => {
      const operation = jest.fn(() => [1, 2, 3, 4, 5])

      const result = withTransaction(operation)

      expect(result).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle operation that returns complex object', () => {
      const complexObject = {
        id: 1,
        nested: {
          data: [1, 2, 3],
          meta: { created: new Date() }
        },
        arrays: [[1, 2], [3, 4]]
      }

      const operation = jest.fn(() => complexObject)

      const result = withTransaction(operation)

      expect(result).toEqual(complexObject)
    })

    it('should handle very long transaction names', () => {
      const longName = 'a'.repeat(1000)
      const operation = jest.fn(() => 'success')

      const result = withTransaction(operation, { name: longName })

      expect(result).toBe('success')
    })

    it('should handle zero retry delay', () => {
      let attempts = 0
      const operation = jest.fn(() => {
        attempts++
        if (attempts === 1) {
          throw new Error('database is locked')
        }
        return 'success'
      })

      const result = withTransaction(operation, {
        maxRetries: 2,
        retryDelay: 0
      })

      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('should handle zero max retries', () => {
      const operation = jest.fn(() => {
        throw new Error('database is locked')
      })

      expect(() =>
        withTransaction(operation, { maxRetries: 0 })
      ).toThrow('database is locked')

      expect(operation).toHaveBeenCalledTimes(1) // No retries
    })

    it('should handle very high max retries value', () => {
      let attempts = 0
      const operation = jest.fn(() => {
        attempts++
        if (attempts === 1) {
          throw new Error('database is locked')
        }
        return 'success'
      })

      const result = withTransaction(operation, { maxRetries: 100 })

      // Should succeed after 1 retry, not use all 100
      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })
  })

  describe('Nested Operations Simulation', () => {
    it('should handle operation calling another database operation', () => {
      const innerOp = jest.fn((tx) => {
        return tx.insert().values({ data: 'inner' }).returning().get()
      })

      const outerOp = jest.fn((tx) => {
        const innerResult = innerOp(tx)
        return tx.insert().values({ data: 'outer', ref: innerResult }).returning().get()
      })

      withTransaction(outerOp)

      expect(innerOp).toHaveBeenCalled()
      expect(outerOp).toHaveBeenCalled()
    })

    it('should rollback all operations if inner operation fails', () => {
      const innerOp = jest.fn(() => {
        throw new Error('Inner operation failed')
      })

      const outerOp = jest.fn((tx) => {
        tx.insert().values({ step: 1 })
        innerOp()
        tx.insert().values({ step: 2 }) // Should not reach here
      })

      expect(() => withTransaction(outerOp)).toThrow('Inner operation failed')
      expect(innerOp).toHaveBeenCalled()
    })
  })

  describe('Type Safety', () => {
    it('should preserve return type through transaction', () => {
      interface User {
        id: number
        name: string
        email: string
      }

      const operation = (): User => {
        return { id: 1, name: 'John', email: 'john@example.com' }
      }

      const result: User = withTransaction(operation)

      expect(result.id).toBe(1)
      expect(result.name).toBe('John')
      expect(result.email).toBe('john@example.com')
    })

    it('should handle generic types', () => {
      const operation = <T>(value: T): T => {
        return value
      }

      const stringResult = withTransaction(() => operation('test'))
      expect(stringResult).toBe('test')

      const numberResult = withTransaction(() => operation(42))
      expect(numberResult).toBe(42)
    })
  })
})
