/**
 * Manual test script for auto-reallocation functionality
 * This creates test data and verifies auto-reallocation works
 */

import { db } from '../src/db';
import { schema } from '../src/db';
import { eq } from 'drizzle-orm';
import { autoReallocator } from '../src/lib/scheduling/auto-reallocator';

async function runTest() {
  console.log('=== Auto-Reallocation Manual Test ===\n');

  let testGameId: string;
  let testInputSourceId: string;
  let testAllocationId: string;

  try {
    // Clean up any existing test data
    console.log('Cleaning up existing test data...');
    await db.delete(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.inputSourceType, 'test'))
      .execute();
    await db.delete(schema.gameSchedules)
      .where(eq(schema.gameSchedules.espnEventId, 'test-auto-realloc-123'))
      .execute();
    await db.delete(schema.inputSources)
      .where(eq(schema.inputSources.name, 'Test Cable Box Auto-Realloc'))
      .execute();

    // Create test input source
    console.log('\n1. Creating test input source...');
    const inputSourceData = {
      id: crypto.randomUUID(),
      name: 'Test Cable Box Auto-Realloc',
      type: 'test',
      availableNetworks: JSON.stringify(['ESPN', 'FOX', 'NBC']),
      isActive: true,
      currentlyAllocated: true,
      priorityRank: 50,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    await db.insert(schema.inputSources).values(inputSourceData);
    testInputSourceId = inputSourceData.id;
    console.log(`   ✓ Created input source: ${testInputSourceId}`);

    // Create test game that has ended
    console.log('\n2. Creating test game (already ended)...');
    const now = Math.floor(Date.now() / 1000);
    const gameData = {
      id: crypto.randomUUID(),
      espnEventId: 'test-auto-realloc-123',
      espnCompetitionId: 'test-comp-123',
      sport: 'football',
      league: 'NFL',
      homeTeamEspnId: 'team-1',
      awayTeamEspnId: 'team-2',
      homeTeamName: 'Green Bay Packers',
      awayTeamName: 'Chicago Bears',
      scheduledStart: now - 7200, // Started 2 hours ago
      estimatedEnd: now - 600, // Estimated to end 10 minutes ago
      status: 'final', // Game has ended
      seasonType: 2,
      seasonYear: 2024,
      calculatedPriority: 80,
      isPriorityGame: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.gameSchedules).values(gameData);
    testGameId = gameData.id;
    console.log(`   ✓ Created game: ${gameData.awayTeamName} @ ${gameData.homeTeamName} (status: ${gameData.status})`);

    // Create active allocation for the ended game
    console.log('\n3. Creating active allocation...');
    const allocationData = {
      id: crypto.randomUUID(),
      inputSourceId: testInputSourceId,
      inputSourceType: 'test',
      gameScheduleId: testGameId,
      channelNumber: '206',
      tvOutputIds: JSON.stringify(['tv-1', 'tv-2']),
      tvCount: 2,
      allocatedAt: now - 7200,
      expectedFreeAt: now - 600,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.inputSourceAllocations).values(allocationData);
    testAllocationId = allocationData.id;
    console.log(`   ✓ Created allocation: ${testAllocationId} (status: active)`);

    // Verify initial state
    console.log('\n4. Verifying initial state...');
    const initialInput = await db.select().from(schema.inputSources)
      .where(eq(schema.inputSources.id, testInputSourceId)).limit(1);
    console.log(`   Input source allocated: ${initialInput[0].currentlyAllocated}`);

    const initialAlloc = await db.select().from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId)).limit(1);
    console.log(`   Allocation status: ${initialAlloc[0].status}`);

    // Run auto-reallocation check
    console.log('\n5. Running auto-reallocation check...');
    const stats = await autoReallocator.performReallocationCheck();
    console.log(`   Stats:
     - Allocations checked: ${stats.allocationsChecked}
     - Allocations completed: ${stats.allocationsCompleted}
     - Input sources freed: ${stats.inputSourcesFreed}
     - Pending allocations activated: ${stats.pendingAllocationsTriggered}
     - Errors: ${stats.errors}`);

    // Verify final state
    console.log('\n6. Verifying final state...');
    const finalAlloc = await db.select().from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId)).limit(1);
    console.log(`   Allocation status: ${finalAlloc[0].status}`);
    console.log(`   Actually freed at: ${finalAlloc[0].actuallyFreedAt ? new Date(finalAlloc[0].actuallyFreedAt * 1000).toISOString() : 'null'}`);

    const finalInput = await db.select().from(schema.inputSources)
      .where(eq(schema.inputSources.id, testInputSourceId)).limit(1);
    console.log(`   Input source allocated: ${finalInput[0].currentlyAllocated}`);

    // Check reallocation history
    console.log('\n7. Checking reallocation history...');
    const history = autoReallocator.getHistory(5);
    if (history.length > 0) {
      console.log(`   Last reallocation:`);
      console.log(`     - Game: ${history[0].gameName}`);
      console.log(`     - Reason: ${history[0].reason}`);
      console.log(`     - Success: ${history[0].success}`);
    }

    // Verify success
    console.log('\n8. Test Results:');
    console.log(`   Expected allocations completed: 1, Got: ${stats.allocationsCompleted}`);
    console.log(`   Expected inputs freed: 1, Got: ${stats.inputSourcesFreed}`);
    console.log(`   Final allocation status: ${finalAlloc[0].status} (expected: completed)`);
    console.log(`   Final input allocated: ${finalInput[0].currentlyAllocated} (expected: false)`);

    // The test passes if our specific allocation was completed and input was freed
    // We don't care about other allocations in the database
    const testPassed =
      finalAlloc[0].status === 'completed' &&
      !finalInput[0].currentlyAllocated &&
      stats.allocationsCompleted >= 1;

    if (testPassed) {
      console.log('   ✅ TEST PASSED - Auto-reallocation working correctly!');
      console.log(`   Note: Processed ${stats.allocationsCompleted} total allocations (including existing ones)`);
    } else {
      console.log('   ❌ TEST FAILED - Something went wrong');
    }

    // Clean up
    console.log('\n9. Cleaning up test data...');
    await db.delete(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, testAllocationId))
      .execute();
    await db.delete(schema.gameSchedules)
      .where(eq(schema.gameSchedules.id, testGameId))
      .execute();
    await db.delete(schema.inputSources)
      .where(eq(schema.inputSources.id, testInputSourceId))
      .execute();
    console.log('   ✓ Cleanup complete');

    process.exit(testPassed ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error);
    console.error(error.stack);

    // Attempt cleanup
    try {
      console.log('\nAttempting cleanup...');
      if (testAllocationId) {
        await db.delete(schema.inputSourceAllocations)
          .where(eq(schema.inputSourceAllocations.id, testAllocationId))
          .execute();
      }
      if (testGameId) {
        await db.delete(schema.gameSchedules)
          .where(eq(schema.gameSchedules.id, testGameId))
          .execute();
      }
      if (testInputSourceId) {
        await db.delete(schema.inputSources)
          .where(eq(schema.inputSources.id, testInputSourceId))
          .execute();
      }
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }

    process.exit(1);
  }
}

runTest();
