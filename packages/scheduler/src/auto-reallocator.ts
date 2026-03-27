/**
 * Auto-Reallocation Service
 * Automatically frees up input sources when games end
 * Triggers reallocation for pending allocations waiting for inputs
 */

import { db, schema, eq, and, lte, gte, or, inArray } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from './scheduler-logger'

const API_PORT = process.env.PORT || 3001

interface DefaultSourceConfig {
  inputNumber: number
  inputLabel?: string
  channelNumber?: string
}

interface CableBoxDefault {
  channelNumber: string
  channelName?: string
}

interface DefaultSourcesConfig {
  globalDefault?: DefaultSourceConfig
  roomDefaults?: Record<string, DefaultSourceConfig>
  outputDefaults?: Record<string, DefaultSourceConfig>
  cableBoxDefaults?: Record<string, CableBoxDefault>
}

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
            await this.endAllocation(allocation, inputSource, game, shouldEnd.reason);
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
   * End an allocation and free the input source, then revert TVs to defaults
   */
  private async endAllocation(
    allocation: any,
    inputSource: any,
    game: any,
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
      .where(eq(schema.inputSourceAllocations.id, allocation.id));

    // Update input source to mark as not allocated
    await db
      .update(schema.inputSources)
      .set({
        currentlyAllocated: false,
        updatedAt: now,
      })
      .where(eq(schema.inputSources.id, inputSource.id));

    logger.debug(
      `[AUTO-REALLOCATOR] Freed input source ${inputSource.name} (${inputSource.id}) - reason: ${reason}`
    );

    // Revert TVs to default sources after game ends
    await this.revertTVsToDefaults(allocation, inputSource, game);
  }

  /**
   * After a game ends, revert assigned TV outputs to their default sources
   * and tune the cable box back to its default channel.
   *
   * Skips revert if another game is starting on the same input source within 30 minutes.
   */
  private async revertTVsToDefaults(
    allocation: any,
    inputSource: any,
    game: any
  ): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const thirtyMinutesFromNow = now + 30 * 60;

      // Step 1: Check if there's another game coming up on the same input source within 30 minutes
      const upcomingAllocations = await db
        .select({
          allocation: schema.inputSourceAllocations,
          game: schema.gameSchedules,
        })
        .from(schema.inputSourceAllocations)
        .innerJoin(
          schema.gameSchedules,
          eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
        )
        .where(
          and(
            eq(schema.inputSourceAllocations.inputSourceId, inputSource.id),
            or(
              eq(schema.inputSourceAllocations.status, 'pending'),
              eq(schema.inputSourceAllocations.status, 'active')
            )
          )
        );

      const hasUpcomingGame = upcomingAllocations.some(({ game: upcomingGame }) => {
        return upcomingGame.scheduledStart <= thirtyMinutesFromNow && upcomingGame.scheduledStart >= now;
      });

      if (hasUpcomingGame) {
        logger.info(
          `[AUTO-REALLOC] Game ended for ${game.awayTeamName} @ ${game.homeTeamName}, but another game starts within 30 min on ${inputSource.name} — skipping revert`
        );
        return;
      }

      // Step 2: Load default source configuration
      let defaults: DefaultSourcesConfig | null = null;
      try {
        const response = await fetch(`http://127.0.0.1:${API_PORT}/api/settings/default-sources`);
        if (response.ok) {
          const data = await response.json();
          defaults = data.defaults as DefaultSourcesConfig;
        } else {
          logger.warn('[AUTO-REALLOC] Failed to load default sources config, skipping revert');
          return;
        }
      } catch (fetchError: any) {
        logger.warn('[AUTO-REALLOC] Could not reach default-sources API, skipping revert:', { error: fetchError.message });
        return;
      }

      if (!defaults) {
        logger.debug('[AUTO-REALLOC] No default source configuration found, skipping revert');
        return;
      }

      // Step 3: Parse TV output IDs from the allocation
      let tvOutputIds: number[] = [];
      try {
        tvOutputIds = JSON.parse(allocation.tvOutputIds);
      } catch {
        logger.warn(`[AUTO-REALLOC] Could not parse tvOutputIds for allocation ${allocation.id}, skipping revert`);
        return;
      }

      if (tvOutputIds.length === 0) {
        logger.debug(`[AUTO-REALLOC] No TV outputs assigned for allocation ${allocation.id}, skipping revert`);
        return;
      }

      // Step 4: Load matrix outputs to resolve room/group info for each output
      const activeConfig = await db
        .select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.isActive, true))
        .limit(1)
        .get();

      // Build a map of output channelNumber -> matrixOutput record
      let outputMap: Map<number, any> = new Map();
      if (activeConfig) {
        const allOutputs = await db
          .select()
          .from(schema.matrixOutputs)
          .where(eq(schema.matrixOutputs.configId, activeConfig.id))
          .all();
        for (const output of allOutputs) {
          outputMap.set(output.channelNumber, output);
        }
      }

      // Step 5: Route each TV output back to its default source
      for (const outputNumber of tvOutputIds) {
        const matrixOutput = outputMap.get(outputNumber);
        const tvGroupId = matrixOutput?.tvGroupId || null;
        const outputLabel = matrixOutput?.label || `Output ${outputNumber}`;

        // Resolve default: outputDefaults > roomDefaults > globalDefault
        const outputKey = String(outputNumber);
        let defaultSource: DefaultSourceConfig | null = null;

        if (defaults.outputDefaults && defaults.outputDefaults[outputKey]) {
          defaultSource = defaults.outputDefaults[outputKey];
        } else if (tvGroupId && defaults.roomDefaults && defaults.roomDefaults[tvGroupId]) {
          defaultSource = defaults.roomDefaults[tvGroupId];
        } else if (defaults.globalDefault) {
          defaultSource = defaults.globalDefault;
        }

        if (!defaultSource) {
          logger.debug(`[AUTO-REALLOC] No default source configured for output ${outputNumber} (${outputLabel}), skipping`);
          continue;
        }

        try {
          const routeResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: defaultSource.inputNumber,
              output: outputNumber,
              source: 'auto-reallocator',
            }),
          });

          if (routeResponse.ok) {
            logger.info(
              `[AUTO-REALLOC] Game ended, reverting TV ${outputNumber} (${outputLabel}) to default: ${defaultSource.inputLabel || 'input ' + defaultSource.inputNumber} (input ${defaultSource.inputNumber})`
            );
          } else {
            const errorData = await routeResponse.json().catch(() => ({ error: 'Unknown error' }));
            logger.warn(
              `[AUTO-REALLOC] Failed to revert TV ${outputNumber} (${outputLabel}) to default: ${errorData.error || routeResponse.statusText}`
            );
          }
        } catch (routeError: any) {
          logger.error(`[AUTO-REALLOC] Error reverting TV ${outputNumber} (${outputLabel}) to default:`, { error: routeError.message });
        }
      }

      // Step 6: Tune cable box back to its default channel
      if (defaults.cableBoxDefaults && inputSource.deviceId) {
        const cableBoxDefault = defaults.cableBoxDefaults[inputSource.deviceId];
        if (cableBoxDefault) {
          try {
            const tuneResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/channel-presets/tune`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channelNumber: cableBoxDefault.channelNumber,
                deviceType: inputSource.type,
                cableBoxId: inputSource.type === 'cable' ? inputSource.deviceId : undefined,
                directTVId: inputSource.type === 'directv' ? inputSource.deviceId : undefined,
              }),
            });

            if (tuneResponse.ok) {
              logger.info(
                `[AUTO-REALLOC] Game ended, tuning ${inputSource.name} back to default channel ${cableBoxDefault.channelNumber}${cableBoxDefault.channelName ? ' (' + cableBoxDefault.channelName + ')' : ''}`
              );
            } else {
              const errorData = await tuneResponse.json().catch(() => ({ error: 'Unknown error' }));
              logger.warn(
                `[AUTO-REALLOC] Failed to tune ${inputSource.name} back to default channel: ${errorData.error || tuneResponse.statusText}`
              );
            }
          } catch (tuneError: any) {
            logger.error(`[AUTO-REALLOC] Error tuning ${inputSource.name} back to default channel:`, { error: tuneError.message });
          }
        }
      }

      logger.info(
        `[AUTO-REALLOC] Revert complete for ${game.awayTeamName} @ ${game.homeTeamName} — ${tvOutputIds.length} TV output(s) processed`
      );
    } catch (error: any) {
      // Don't let revert failures break the main allocation completion flow
      logger.error('[AUTO-REALLOC] Error during TV revert to defaults (non-fatal):', { error: error.message });
    }
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
        allocation,
        inputSource,
        game,
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
