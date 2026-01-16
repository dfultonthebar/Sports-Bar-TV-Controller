/**
 * Auto-Reallocation Service
 * Automatically frees up input sources when games end
 * Triggers reallocation for pending allocations waiting for inputs
 */

import { db, schema, eq, and, lte, gte, or, inArray } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from './scheduler-logger'

interface ReallocationStats {
  allocationsChecked: number;
  allocationsCompleted: number;
  inputSourcesFreed: number;
  pendingAllocationsTriggered: number;
  errors: number;
}

interface ReallocationHistoryEntry {
  timestamp: number;
  allocationId: string;
  gameId: string;
  gameName: string;
  inputSourceId: string;
  inputSourceName: string;
  reason: string;
  success: boolean;
  error?: string;
}

class AutoReallocator {
  private reallocationHistory: ReallocationHistoryEntry[] = [];
  private maxHistorySize = 100;

  /**
   * Main reallocation check - scans for ended games and frees allocations
   */
  async performReallocationCheck(): Promise<ReallocationStats> {
    const correlationId = schedulerLogger.generateCorrelationId();
    const startTime = Date.now();

    const stats: ReallocationStats = {
      allocationsChecked: 0,
      allocationsCompleted: 0,
      inputSourcesFreed: 0,
      pendingAllocationsTriggered: 0,
      errors: 0,
    };

    try {
      await schedulerLogger.info(
        'auto-reallocator',
        'check',
        'Starting reallocation check',
        correlationId
      );

      logger.info('[AUTO-REALLOCATOR] Starting reallocation check');

      // Step 1: Find all active allocations
      const activeAllocations = await db
        .select({
          allocation: schema.inputSourceAllocations,
          game: schema.gameSchedules,
          inputSource: schema.inputSources,
        })
        .from(schema.inputSourceAllocations)
        .innerJoin(
          schema.gameSchedules,
          eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
        )
        .innerJoin(
          schema.inputSources,
          eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id)
        )
        .where(eq(schema.inputSourceAllocations.status, 'active'));

      stats.allocationsChecked = activeAllocations.length;
      logger.debug(`[AUTO-REALLOCATOR] Found ${activeAllocations.length} active allocations`);

      const now = Math.floor(Date.now() / 1000); // Unix timestamp

      // Step 2: Check each allocation to see if game has ended
      for (const { allocation, game, inputSource } of activeAllocations) {
        const shouldEnd = this.shouldEndAllocation(game, allocation, now);

        if (shouldEnd.shouldEnd) {
          const endStartTime = Date.now();
          try {
            await this.endAllocation(allocation.id, inputSource.id, game, inputSource.name, shouldEnd.reason);
            stats.allocationsCompleted++;
            stats.inputSourcesFreed++;

            // Add to history
            this.addToHistory({
              timestamp: now,
              allocationId: allocation.id,
              gameId: game.id,
              gameName: `${game.awayTeamName} @ ${game.homeTeamName}`,
              inputSourceId: inputSource.id,
              inputSourceName: inputSource.name,
              reason: shouldEnd.reason,
              success: true,
            });

            await schedulerLogger.info(
              'auto-reallocator',
              'reallocate',
              `Ended allocation for ${game.awayTeamName} @ ${game.homeTeamName}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                durationMs: Date.now() - endStartTime,
                metadata: { reason: shouldEnd.reason },
              }
            );

            logger.info(
              `[AUTO-REALLOCATOR] Ended allocation ${allocation.id} for ${game.awayTeamName} @ ${game.homeTeamName} (${shouldEnd.reason})`
            );
          } catch (error: any) {
            await schedulerLogger.error(
              'auto-reallocator',
              'reallocate',
              `Error ending allocation for ${game.awayTeamName} @ ${game.homeTeamName}`,
              correlationId,
              error,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                durationMs: Date.now() - endStartTime,
                metadata: { reason: shouldEnd.reason },
              }
            );

            logger.error(`[AUTO-REALLOCATOR] Error ending allocation ${allocation.id}:`, { error });
            stats.errors++;

            this.addToHistory({
              timestamp: now,
              allocationId: allocation.id,
              gameId: game.id,
              gameName: `${game.awayTeamName} @ ${game.homeTeamName}`,
              inputSourceId: inputSource.id,
              inputSourceName: inputSource.name,
              reason: shouldEnd.reason,
              success: false,
              error: error.message,
            });
          }
        }
      }

      // Step 3: Check for pending allocations that can now be activated
      const pendingCount = await this.activatePendingAllocations(correlationId);
      stats.pendingAllocationsTriggered = pendingCount;

      await schedulerLogger.info(
        'auto-reallocator',
        'check',
        `Reallocation check complete: ${stats.allocationsCompleted} ended, ${stats.inputSourcesFreed} freed, ${stats.pendingAllocationsTriggered} pending activated`,
        correlationId,
        {
          durationMs: Date.now() - startTime,
          metadata: stats,
        }
      );

      logger.info(
        `[AUTO-REALLOCATOR] Reallocation check complete: ${stats.allocationsCompleted} ended, ${stats.inputSourcesFreed} freed, ${stats.pendingAllocationsTriggered} pending activated`
      );

      return stats;
    } catch (error: any) {
      await schedulerLogger.error(
        'auto-reallocator',
        'check',
        'Error during reallocation check',
        correlationId,
        error,
        { durationMs: Date.now() - startTime }
      );

      logger.error('[AUTO-REALLOCATOR] Error during reallocation check:', { error });
      stats.errors++;
      return stats;
    }
  }

  /**
   * Determine if an allocation should be ended
   */
  private shouldEndAllocation(
    game: any,
    allocation: any,
    currentTime: number
  ): { shouldEnd: boolean; reason: string } {
    // Check 1: Game status indicates completion
    const completedStatuses = ['final', 'completed', 'finished', 'F', 'FT'];
    if (completedStatuses.includes(game.status?.toLowerCase())) {
      return { shouldEnd: true, reason: 'game_status_final' };
    }

    // Check 2: Game has been cancelled or postponed
    const cancelledStatuses = ['cancelled', 'canceled', 'postponed', 'suspended'];
    if (cancelledStatuses.includes(game.status?.toLowerCase())) {
      return { shouldEnd: true, reason: `game_${game.status.toLowerCase()}` };
    }

    // Check 3: Estimated end time has passed + 30 minute buffer
    const bufferMinutes = 30;
    const bufferSeconds = bufferMinutes * 60;
    const endTimeWithBuffer = allocation.expectedFreeAt + bufferSeconds;

    if (currentTime > endTimeWithBuffer) {
      return { shouldEnd: true, reason: 'estimated_end_exceeded' };
    }

    // Check 4: Actual end time is recorded
    if (game.actualEnd && currentTime > game.actualEnd) {
      return { shouldEnd: true, reason: 'actual_end_time' };
    }

    return { shouldEnd: false, reason: '' };
  }

  /**
   * End an allocation and free the input source
   */
  private async endAllocation(
    allocationId: string,
    inputSourceId: string,
    _game: any, // kept for signature compatibility
    inputSourceName: string,
    reason: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000); // Unix timestamp

    // Update allocation to completed
    await db
      .update(schema.inputSourceAllocations)
      .set({
        status: 'completed',
        actuallyFreedAt: now,
      })
      .where(eq(schema.inputSourceAllocations.id, allocationId));

    // Update input source to mark as not allocated
    await db
      .update(schema.inputSources)
      .set({
        currentlyAllocated: false,
        updatedAt: now,
      })
      .where(eq(schema.inputSources.id, inputSourceId));

    logger.debug(
      `[AUTO-REALLOCATOR] Freed input source ${inputSourceName} (${inputSourceId}) - reason: ${reason}`
    );
  }

  /**
   * Activate pending allocations that were waiting for inputs to free
   */
  private async activatePendingAllocations(correlationId?: string): Promise<number> {
    const localCorrelationId = correlationId || schedulerLogger.generateCorrelationId();

    try {
      // Get all pending allocations
      const pendingAllocations = await db
        .select({
          allocation: schema.inputSourceAllocations,
          game: schema.gameSchedules,
        })
        .from(schema.inputSourceAllocations)
        .innerJoin(
          schema.gameSchedules,
          eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
        )
        .where(eq(schema.inputSourceAllocations.status, 'pending'));

      if (pendingAllocations.length === 0) {
        return 0;
      }

      logger.debug(`[AUTO-REALLOCATOR] Found ${pendingAllocations.length} pending allocations`);

      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      let activatedCount = 0;

      for (const { allocation, game } of pendingAllocations) {
        // Skip bartender-scheduled allocations - they are handled by the Scheduler
        // which sends the actual tune command before marking as active
        if (allocation.scheduledBy === 'bartender') {
          logger.debug(`[AUTO-REALLOCATOR] Skipping bartender-scheduled allocation ${allocation.id} - handled by Scheduler`);
          continue;
        }

        // Check if game should start now
        const shouldActivate =
          now >= game.scheduledStart && // Past game's actual start time (not allocation time)
          game.status !== 'cancelled' &&
          game.status !== 'postponed';

        if (shouldActivate) {
          // Check if input source is actually free
          const inputSource = await db
            .select()
            .from(schema.inputSources)
            .where(eq(schema.inputSources.id, allocation.inputSourceId))
            .limit(1);

          if (inputSource.length > 0 && !inputSource[0].currentlyAllocated) {
            // Activate the allocation
            await db
              .update(schema.inputSourceAllocations)
              .set({
                status: 'active',
                updatedAt: now,
              })
              .where(eq(schema.inputSourceAllocations.id, allocation.id));

            // Mark input source as allocated
            await db
              .update(schema.inputSources)
              .set({
                currentlyAllocated: true,
                updatedAt: now,
              })
              .where(eq(schema.inputSources.id, allocation.inputSourceId));

            activatedCount++;

            await schedulerLogger.info(
              'auto-reallocator',
              'allocate',
              `Activated pending allocation for ${game.awayTeamName} @ ${game.homeTeamName}`,
              localCorrelationId,
              {
                gameId: game.id,
                inputSourceId: allocation.inputSourceId,
                allocationId: allocation.id,
              }
            );

            logger.info(
              `[AUTO-REALLOCATOR] Activated pending allocation ${allocation.id} for ${game.awayTeamName} @ ${game.homeTeamName}`
            );
          }
        }
      }

      return activatedCount;
    } catch (error: any) {
      await schedulerLogger.error(
        'auto-reallocator',
        'allocate',
        'Error activating pending allocations',
        localCorrelationId,
        error
      );

      logger.error('[AUTO-REALLOCATOR] Error activating pending allocations:', { error });
      return 0;
    }
  }

  /**
   * Add entry to reallocation history
   */
  private addToHistory(entry: ReallocationHistoryEntry): void {
    this.reallocationHistory.unshift(entry);

    // Keep only the most recent entries
    if (this.reallocationHistory.length > this.maxHistorySize) {
      this.reallocationHistory = this.reallocationHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get reallocation history
   */
  getHistory(limit: number = 50): ReallocationHistoryEntry[] {
    return this.reallocationHistory.slice(0, limit);
  }

  /**
   * Get reallocation statistics
   */
  getStats(): {
    totalReallocations: number;
    successfulReallocations: number;
    failedReallocations: number;
    lastCheckTime: number | null;
  } {
    const total = this.reallocationHistory.length;
    const successful = this.reallocationHistory.filter(h => h.success).length;
    const failed = total - successful;
    const lastCheck = this.reallocationHistory.length > 0 ? this.reallocationHistory[0].timestamp : null;

    return {
      totalReallocations: total,
      successfulReallocations: successful,
      failedReallocations: failed,
      lastCheckTime: lastCheck,
    };
  }

  /**
   * Manually free a specific allocation
   */
  async manuallyFreeAllocation(allocationId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get allocation details
      const allocations = await db
        .select({
          allocation: schema.inputSourceAllocations,
          game: schema.gameSchedules,
          inputSource: schema.inputSources,
        })
        .from(schema.inputSourceAllocations)
        .innerJoin(
          schema.gameSchedules,
          eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
        )
        .innerJoin(
          schema.inputSources,
          eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id)
        )
        .where(eq(schema.inputSourceAllocations.id, allocationId))
        .limit(1);

      if (allocations.length === 0) {
        return { success: false, message: 'Allocation not found' };
      }

      const { allocation, game, inputSource } = allocations[0];

      if (allocation.status === 'completed') {
        return { success: false, message: 'Allocation already completed' };
      }

      await this.endAllocation(
        allocation.id,
        inputSource.id,
        game,
        inputSource.name,
        'manual_free'
      );

      const now = Math.floor(Date.now() / 1000);
      this.addToHistory({
        timestamp: now,
        allocationId: allocation.id,
        gameId: game.id,
        gameName: `${game.awayTeamName} @ ${game.homeTeamName}`,
        inputSourceId: inputSource.id,
        inputSourceName: inputSource.name,
        reason: 'manual_free',
        success: true,
      });

      return { success: true, message: 'Allocation freed successfully' };
    } catch (error: any) {
      logger.error('[AUTO-REALLOCATOR] Error manually freeing allocation:', { error });
      return { success: false, message: error.message };
    }
  }
}

export const autoReallocator = new AutoReallocator()
