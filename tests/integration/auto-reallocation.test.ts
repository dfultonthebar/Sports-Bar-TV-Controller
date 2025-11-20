/**
 * Auto-Reallocation Integration Tests
 * Tests the automatic freeing of input sources when games end
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/db';
import { schema } from '@/db';
import { eq } from 'drizzle-orm';
import { autoReallocator } from '@/lib/scheduling/auto-reallocator';

describe('Auto-Reallocation Service', () => {
  let testGameId: string;
  let testInputSourceId: string;
  let testAllocationId: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(schema.inputSourceAllocations).execute();
    await db.delete(schema.gameSchedules).execute();
    await db.delete(schema.inputSources).execute();

    // Create test input source
    const inputSourceData = {
      id: crypto.randomUUID(),
      name: 'Test Cable Box 1',
      type: 'cable',
      availableNetworks: JSON.stringify(['ESPN', 'FOX', 'NBC']),
      isActive: true,
      currentlyAllocated: true,
      priorityRank: 50,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    await db.insert(schema.inputSources).values(inputSourceData);
    testInputSourceId = inputSourceData.id;

    // Create test game
    const now = Math.floor(Date.now() / 1000);
    const gameData = {
      id: crypto.randomUUID(),
      espnEventId: 'test-event-123',
      espnCompetitionId: 'test-comp-123',
      sport: 'football',
      league: 'NFL',
      homeTeamEspnId: 'team-1',
      awayTeamEspnId: 'team-2',
      homeTeamName: 'Green Bay Packers',
      awayTeamName: 'Chicago Bears',
      scheduledStart: now - 3600, // Started 1 hour ago
      estimatedEnd: now - 300, // Estimated to end 5 minutes ago
      status: 'in_progress',
      seasonType: 2,
      seasonYear: 2024,
      calculatedPriority: 80,
      isPriorityGame: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.gameSchedules).values(gameData);
    testGameId = gameData.id;

    // Create test allocation
    const allocationData = {
      id: crypto.randomUUID(),
      inputSourceId: testInputSourceId,
      inputSourceType: 'cable',
      gameScheduleId: testGameId,
      channelNumber: '206',
      tvOutputIds: JSON.stringify(['tv-1', 'tv-2']),
      tvCount: 2,
      allocatedAt: now - 3600,
      expectedFreeAt: now - 300,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.inputSourceAllocations).values(allocationData);
    testAllocationId = allocationData.id;
  });

  afterEach(async () => {
    // Clean up
    await db.delete(schema.inputSourceAllocations).execute();
    await db.delete(schema.gameSchedules).execute();
    await db.delete(schema.inputSources).execute();
  });

  it('should detect and free allocation when game status is "final"', async () => {
    // Update game status to final
    await db
      .update(schema.gameSchedules)
      .set({ status: 'final' })
      .where(eq(schema.gameSchedules.id, testGameId));

    // Run reallocation check
    const stats = await autoReallocator.performReallocationCheck();

    // Verify stats
    expect(stats.allocationsChecked).toBe(1);
    expect(stats.allocationsCompleted).toBe(1);
    expect(stats.inputSourcesFreed).toBe(1);

    // Verify allocation is completed
    const allocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .limit(1);

    expect(allocation[0].status).toBe('completed');
    expect(allocation[0].actuallyFreedAt).toBeDefined();

    // Verify input source is freed
    const inputSource = await db
      .select()
      .from(schema.inputSources)
      .where(eq(schema.inputSources.id, testInputSourceId))
      .limit(1);

    expect(inputSource[0].currentlyAllocated).toBe(false);
  });

  it('should free allocation when estimated end time + buffer has passed', async () => {
    // Game is still "in_progress" but estimated end + 30 min buffer has passed
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(schema.gameSchedules)
      .set({
        estimatedEnd: now - 2000, // 33+ minutes ago
      })
      .where(eq(schema.gameSchedules.id, testGameId));

    await db
      .update(schema.inputSourceAllocations)
      .set({
        expectedFreeAt: now - 2000,
      })
      .where(eq(schema.inputSourceAllocations.id, testAllocationId));

    // Run reallocation check
    const stats = await autoReallocator.performReallocationCheck();

    // Verify allocation was ended due to timeout
    expect(stats.allocationsCompleted).toBe(1);

    const allocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .limit(1);

    expect(allocation[0].status).toBe('completed');
  });

  it('should NOT free allocation if game is still in progress within buffer', async () => {
    // Game estimated end is only 10 minutes ago (within 30 min buffer)
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(schema.gameSchedules)
      .set({
        estimatedEnd: now - 600, // 10 minutes ago
      })
      .where(eq(schema.gameSchedules.id, testGameId));

    await db
      .update(schema.inputSourceAllocations)
      .set({
        expectedFreeAt: now - 600,
      })
      .where(eq(schema.inputSourceAllocations.id, testAllocationId));

    // Run reallocation check
    const stats = await autoReallocator.performReallocationCheck();

    // Verify allocation was NOT ended (still within buffer)
    expect(stats.allocationsCompleted).toBe(0);

    const allocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .limit(1);

    expect(allocation[0].status).toBe('active');
  });

  it('should free allocation when game is cancelled', async () => {
    await db
      .update(schema.gameSchedules)
      .set({ status: 'cancelled' })
      .where(eq(schema.gameSchedules.id, testGameId));

    const stats = await autoReallocator.performReallocationCheck();

    expect(stats.allocationsCompleted).toBe(1);

    const allocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .limit(1);

    expect(allocation[0].status).toBe('completed');
  });

  it('should activate pending allocations when inputs are freed', async () => {
    // Create a pending allocation for the same input source
    const now = Math.floor(Date.now() / 1000);
    const pendingGameData = {
      id: crypto.randomUUID(),
      espnEventId: 'test-event-456',
      espnCompetitionId: 'test-comp-456',
      sport: 'basketball',
      league: 'NBA',
      homeTeamEspnId: 'team-3',
      awayTeamEspnId: 'team-4',
      homeTeamName: 'Milwaukee Bucks',
      awayTeamName: 'Boston Celtics',
      scheduledStart: now - 300, // Started 5 minutes ago
      estimatedEnd: now + 3600, // Ends in 1 hour
      status: 'in_progress',
      seasonType: 2,
      seasonYear: 2024,
      calculatedPriority: 75,
      isPriorityGame: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.gameSchedules).values(pendingGameData);

    const pendingAllocationData = {
      id: crypto.randomUUID(),
      inputSourceId: testInputSourceId,
      inputSourceType: 'cable',
      gameScheduleId: pendingGameData.id,
      channelNumber: '220',
      tvOutputIds: JSON.stringify(['tv-3']),
      tvCount: 1,
      allocatedAt: now - 300,
      expectedFreeAt: now + 3600,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.inputSourceAllocations).values(pendingAllocationData);

    // End the first game
    await db
      .update(schema.gameSchedules)
      .set({ status: 'final' })
      .where(eq(schema.gameSchedules.id, testGameId));

    // Run reallocation check
    const stats = await autoReallocator.performReallocationCheck();

    // First allocation should be completed
    expect(stats.allocationsCompleted).toBe(1);
    expect(stats.inputSourcesFreed).toBe(1);

    // Pending allocation should be activated
    expect(stats.pendingAllocationsTriggered).toBe(1);

    const pendingAllocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, pendingAllocationData.id))
      .limit(1);

    expect(pendingAllocation[0].status).toBe('active');

    // Input source should be allocated again
    const inputSource = await db
      .select()
      .from(schema.inputSources)
      .where(eq(schema.inputSources.id, testInputSourceId))
      .limit(1);

    expect(inputSource[0].currentlyAllocated).toBe(true);
  });

  it('should track reallocation history', async () => {
    await db
      .update(schema.gameSchedules)
      .set({ status: 'final' })
      .where(eq(schema.gameSchedules.id, testGameId));

    await autoReallocator.performReallocationCheck();

    const history = autoReallocator.getHistory(10);

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].allocationId).toBe(testAllocationId);
    expect(history[0].success).toBe(true);
    expect(history[0].reason).toBe('game_status_final');
  });

  it('should manually free allocation', async () => {
    const result = await autoReallocator.manuallyFreeAllocation(testAllocationId);

    expect(result.success).toBe(true);

    const allocation = await db
      .select()
      .from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .limit(1);

    expect(allocation[0].status).toBe('completed');

    const history = autoReallocator.getHistory(10);
    expect(history[0].reason).toBe('manual_free');
  });

  it('should get reallocation stats', async () => {
    await db
      .update(schema.gameSchedules)
      .set({ status: 'final' })
      .where(eq(schema.gameSchedules.id, testGameId));

    await autoReallocator.performReallocationCheck();

    const stats = autoReallocator.getStats();

    expect(stats.totalReallocations).toBeGreaterThan(0);
    expect(stats.successfulReallocations).toBeGreaterThan(0);
    expect(stats.lastCheckTime).toBeDefined();
  });
});
