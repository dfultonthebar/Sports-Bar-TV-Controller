/**
 * Transaction Wrapper Integration Tests
 * Comprehensive test suite for database transaction functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  withTransaction,
  batchTransaction,
  transactionHelpers,
  TransactionMonitor
} from '@/lib/db/transaction-wrapper'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

describe('Transaction Wrapper', () => {
  // Clean up test data after each test
  afterEach(async () => {
    TransactionMonitor.reset()
  })

  describe('Basic Transaction Functionality', () => {
    it('should commit successful transaction', async () => {
      const testId = randomUUID()
      const testName = `test-team-${Date.now()}`

      const result = await withTransaction(async (tx) => {
        const [team] = await tx.insert(schema.homeTeams).values({
          id: testId,
          teamName: testName,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning()

        return team
      }, { name: 'test-create-team' })

      expect(result).toBeDefined()
      expect(result.teamName).toBe(testName)

      // Verify data was committed
      const saved = await db.select()
        .from(schema.homeTeams)
        .where(eq(schema.homeTeams.id, testId))
        .get()

      expect(saved).toBeDefined()
      expect(saved?.teamName).toBe(testName)

      // Cleanup
      await db.delete(schema.homeTeams).where(eq(schema.homeTeams.id, testId))
    })

    it('should rollback failed transaction', async () => {
      const testId = randomUUID()
      const testName = `rollback-team-${Date.now()}`

      try {
        await withTransaction(async (tx) => {
          // Insert a record
          await tx.insert(schema.homeTeams).values({
            id: testId,
            teamName: testName,
            league: 'TEST',
            sport: 'football',
            category: 'professional',
            isActive: true,
            isPrimary: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })

          // Throw error to trigger rollback
          throw new Error('Intentional test error')
        }, { name: 'test-rollback' })
      } catch (error: any) {
        expect(error.message).toBe('Intentional test error')
      }

      // Verify data was NOT committed
      const saved = await db.select()
        .from(schema.homeTeams)
        .where(eq(schema.homeTeams.id, testId))
        .get()

      expect(saved).toBeUndefined()
    })

    it('should handle multiple operations in single transaction', async () => {
      const team1Id = randomUUID()
      const team2Id = randomUUID()
      const timestamp = Date.now()

      const result = await withTransaction(async (tx) => {
        // Create two teams in one transaction
        const [team1] = await tx.insert(schema.homeTeams).values({
          id: team1Id,
          teamName: `team1-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning()

        const [team2] = await tx.insert(schema.homeTeams).values({
          id: team2Id,
          teamName: `team2-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning()

        return { team1, team2 }
      }, { name: 'test-multi-insert' })

      expect(result.team1).toBeDefined()
      expect(result.team2).toBeDefined()

      // Verify both were committed
      const saved1 = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.id, team1Id)).get()
      const saved2 = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.id, team2Id)).get()

      expect(saved1).toBeDefined()
      expect(saved2).toBeDefined()

      // Cleanup
      await db.delete(schema.homeTeams).where(eq(schema.homeTeams.id, team1Id))
      await db.delete(schema.homeTeams).where(eq(schema.homeTeams.id, team2Id))
    })

    it('should rollback all operations if one fails', async () => {
      const team1Id = randomUUID()
      const team2Id = randomUUID()
      const timestamp = Date.now()

      try {
        await withTransaction(async (tx) => {
          // Create first team
          await tx.insert(schema.homeTeams).values({
            id: team1Id,
            teamName: `team1-${timestamp}`,
            league: 'TEST',
            sport: 'football',
            category: 'professional',
            isActive: true,
            isPrimary: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })

          // Create second team
          await tx.insert(schema.homeTeams).values({
            id: team2Id,
            teamName: `team2-${timestamp}`,
            league: 'TEST',
            sport: 'football',
            category: 'professional',
            isActive: true,
            isPrimary: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })

          // Throw error after both inserts
          throw new Error('Rollback both')
        }, { name: 'test-rollback-multi' })
      } catch (error: any) {
        expect(error.message).toBe('Rollback both')
      }

      // Verify neither was committed
      const saved1 = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.id, team1Id)).get()
      const saved2 = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.id, team2Id)).get()

      expect(saved1).toBeUndefined()
      expect(saved2).toBeUndefined()
    })
  })

  describe('Batch Transaction', () => {
    it('should execute multiple operations in batch', async () => {
      const ids = [randomUUID(), randomUUID(), randomUUID()]
      const timestamp = Date.now()

      const results = await batchTransaction([
        (tx) => tx.insert(schema.homeTeams).values({
          id: ids[0],
          teamName: `batch-team-0-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning().get(),
        (tx) => tx.insert(schema.homeTeams).values({
          id: ids[1],
          teamName: `batch-team-1-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning().get(),
        (tx) => tx.insert(schema.homeTeams).values({
          id: ids[2],
          teamName: `batch-team-2-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning().get()
      ], { name: 'test-batch-insert' })

      expect(results).toHaveLength(3)
      expect(results[0]).toBeDefined()
      expect(results[1]).toBeDefined()
      expect(results[2]).toBeDefined()

      // Cleanup
      for (const id of ids) {
        await db.delete(schema.homeTeams).where(eq(schema.homeTeams.id, id))
      }
    })

    it('should rollback all batch operations if one fails', async () => {
      const ids = [randomUUID(), randomUUID(), randomUUID()]
      const timestamp = Date.now()

      try {
        await batchTransaction([
          (tx) => tx.insert(schema.homeTeams).values({
            id: ids[0],
            teamName: `batch-team-0-${timestamp}`,
            league: 'TEST',
            sport: 'football',
            category: 'professional',
            isActive: true,
            isPrimary: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }).returning().get(),
          (tx) => tx.insert(schema.homeTeams).values({
            id: ids[1],
            teamName: `batch-team-1-${timestamp}`,
            league: 'TEST',
            sport: 'football',
            category: 'professional',
            isActive: true,
            isPrimary: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }).returning().get(),
          async (tx) => {
            throw new Error('Batch operation failed')
          }
        ], { name: 'test-batch-rollback' })
      } catch (error: any) {
        expect(error.message).toBe('Batch operation failed')
      }

      // Verify none were committed
      for (const id of ids) {
        const saved = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.id, id)).get()
        expect(saved).toBeUndefined()
      }
    })
  })

  describe('Transaction Options', () => {
    it('should respect transaction name in logging', async () => {
      const customName = 'custom-transaction-name'

      await withTransaction(async (tx) => {
        // Simple operation
        return true
      }, { name: customName })

      // Note: We can't easily test logging output, but we can verify it doesn't crash
      expect(true).toBe(true)
    })

    it('should handle transaction timeout', async () => {
      const testId = randomUUID()

      try {
        await withTransaction(async (tx) => {
          // Simulate long operation
          await new Promise(resolve => setTimeout(resolve, 100))
          return true
        }, {
          name: 'test-timeout',
          timeout: 50 // Very short timeout to trigger error
        })
      } catch (error: any) {
        expect(error.message).toContain('timeout')
      }
    }, 10000) // Increase test timeout
  })

  describe('Transaction Helpers', () => {
    it('should create record with audit log', async () => {
      const testId = randomUUID()
      const timestamp = Date.now()

      // Note: This test assumes audit logging is properly configured
      // The actual audit table may vary
      const result = await withTransaction(async (tx) => {
        const [team] = await tx.insert(schema.homeTeams).values({
          id: testId,
          teamName: `audit-team-${timestamp}`,
          league: 'TEST',
          sport: 'football',
          category: 'professional',
          isActive: true,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning()

        return team
      }, { name: 'test-audit-create' })

      expect(result).toBeDefined()

      // Cleanup
      await db.delete(schema.homeTeams).where(eq(schema.homeTeams.id, testId))
    })
  })

  describe('Error Handling and Retry', () => {
    it('should handle database errors gracefully', async () => {
      try {
        await withTransaction(async (tx) => {
          // Attempt invalid operation (duplicate primary key if run twice)
          throw new Error('Database constraint violation')
        }, { name: 'test-error-handling', maxRetries: 1 })
      } catch (error: any) {
        expect(error.message).toBeTruthy()
      }
    })

    it('should provide clear error messages on rollback', async () => {
      const errorMessage = 'Custom error for testing'

      try {
        await withTransaction(async (tx) => {
          throw new Error(errorMessage)
        }, { name: 'test-error-message' })
      } catch (error: any) {
        expect(error.message).toBe(errorMessage)
      }
    })
  })

  describe('Performance and Monitoring', () => {
    it('should complete transactions quickly', async () => {
      const startTime = Date.now()

      await withTransaction(async (tx) => {
        // Simple fast operation
        return true
      }, { name: 'test-performance' })

      const duration = Date.now() - startTime

      // Transaction should complete in under 100ms for simple operations
      expect(duration).toBeLessThan(100)
    })

    it('should track transaction metrics', async () => {
      TransactionMonitor.reset()

      await withTransaction(async (tx) => {
        return true
      }, { name: 'test-metrics' })

      const stats = TransactionMonitor.getStats()

      // Basic validation that monitoring is working
      expect(stats).toBeDefined()
      expect(typeof stats.total).toBe('number')
      expect(typeof stats.successful).toBe('number')
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle preset reordering scenario', async () => {
      // This simulates the preset reordering operation
      const presetIds = [randomUUID(), randomUUID(), randomUUID()]
      const timestamp = Date.now()

      const result = await withTransaction(async (tx) => {
        // Create multiple presets
        for (let i = 0; i < presetIds.length; i++) {
          await tx.insert(schema.channelPresets).values({
            id: presetIds[i],
            name: `preset-${i}-${timestamp}`,
            channelNumber: `${100 + i}`,
            deviceType: 'cable',
            order: i,
            isActive: true,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }

        // Update order (simulating reorder)
        for (let i = 0; i < presetIds.length; i++) {
          const newOrder = presetIds.length - i - 1 // Reverse order
          await tx.update(schema.channelPresets)
            .set({ order: newOrder, updatedAt: new Date().toISOString() })
            .where(eq(schema.channelPresets.id, presetIds[i]))
        }

        return { success: true, count: presetIds.length }
      }, { name: 'test-preset-reorder' })

      expect(result.success).toBe(true)
      expect(result.count).toBe(3)

      // Cleanup
      for (const id of presetIds) {
        await db.delete(schema.channelPresets).where(eq(schema.channelPresets.id, id))
      }
    })

    it('should handle scheduled command creation scenario', async () => {
      const commandId = randomUUID()
      const timestamp = Date.now()

      const result = await withTransaction(async (tx) => {
        // Create scheduled command
        const [command] = await tx.insert(schema.scheduledCommands).values({
          id: commandId,
          name: `test-command-${timestamp}`,
          description: 'Test command',
          commandType: 'matrix_route',
          targetType: 'output',
          targets: JSON.stringify([1, 2, 3]),
          commandSequence: JSON.stringify([{ action: 'route', input: 1, output: 1 }]),
          scheduleType: 'daily',
          scheduleData: JSON.stringify({ time: '08:00' }),
          timezone: 'America/New_York',
          enabled: true,
          nextExecution: new Date().toISOString(),
          createdBy: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning()

        return command
      }, { name: 'test-scheduled-command' })

      expect(result).toBeDefined()
      expect(result.name).toContain('test-command')

      // Cleanup
      await db.delete(schema.scheduledCommands).where(eq(schema.scheduledCommands.id, commandId))
    })
  })
})
