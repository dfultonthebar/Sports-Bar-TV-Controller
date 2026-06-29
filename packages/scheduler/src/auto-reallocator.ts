/**
 * Auto-Reallocation Service
 * Automatically frees up input sources when games end
 * Triggers reallocation for pending allocations waiting for inputs
 */

import { db, schema, eq, and, lte, gte, lt, desc, or, inArray, isNull, isNotNull } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { parseHardwareResult } from '@sports-bar/utils'
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

interface ZoneLevelDefault {
  processorId: string
  zoneNumber: number   // DB 0-based AudioZone.zoneNumber
  zoneName: string
  level: number        // 0-100 percent
}

interface AudioDefaultsConfig {
  zoneLevels?: ZoneLevelDefault[]
  audioRouting?: Record<string, number>  // audio-matrix outputNum -> default matrix input
}

interface DefaultSourcesConfig {
  globalDefault?: DefaultSourceConfig
  roomDefaults?: Record<string, DefaultSourceConfig>
  outputDefaults?: Record<string, DefaultSourceConfig>
  cableBoxDefaults?: Record<string, CableBoxDefault>
  audioDefaults?: AudioDefaultsConfig
}

/**
 * v2.85.0 — Result of a full-location "reset to defaults" pass (the 4 AM
 * morning reset, or a manual trigger). When dryRun is true, the `*Reverted`
 * / `*Tuned` counters reflect what WOULD be done (no hardware command was
 * issued) and `plan` enumerates every resolved action.
 */
export interface MorningResetStats {
  dryRun: boolean;
  trigger: string;
  outputsConsidered: number;
  outputsReverted: number;       // routed (or, in dryRun, WOULD route)
  outputsSkippedNoDefault: number;
  outputsSkippedLive: number;    // skipped — confirmed-live game on this output
  outputsFailed: number;
  boxesConsidered: number;
  boxesTuned: number;            // tuned (or, in dryRun, WOULD tune)
  boxesSkippedLive: number;
  boxesUnresolved: number;       // cableBoxDefaults key matched no IR/DirecTV device
  boxesFailed: number;
  // v2.86.0 — AUDIO pass counters
  audioOutputsConsidered: number;
  audioOutputsRouted: number;    // routed (or, in dryRun, WOULD route)
  audioOutputsFailed: number;
  zonesConsidered: number;
  zonesSet: number;              // set (or, in dryRun, WOULD set)
  zonesSkipped: number;          // non-Atlas processor (not wired yet)
  zonesFailed: number;
  errors: number;
  plan: Array<{
    kind: 'route' | 'tune' | 'audio-route' | 'zone-level';
    output?: number;
    inputNumber?: number;
    matrixInput?: number;
    deviceType?: string;
    deviceId?: string;
    processorId?: string;
    zoneNumber?: number;         // 1-based Atlas zone (for zone-level plan rows)
    level?: number;
    muted?: boolean;             // current mute state the reset preserves (zone-level rows)
    channelNumber?: string;
    label?: string;
    skipped?: string;
  }>;
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

      // v2.82.52 — HARD RULE: never end an allocation (and thus never revert /
      // steal the TVs) for a game ESPN confirms is still in progress. The
      // estimated_end check below (Check 3) is purely wall-clock; a game that
      // runs long (extra innings / 9th-inning rally, OT) blows past its
      // estimated end while still LIVE. Pre-fix, that fired
      // `estimated_end_exceeded` and cut the live Brewers game off its TVs
      // (Holmgren, 2026-06-26 21:34 — game still in the 9th). Fetch one ESPN
      // live-status snapshot per tick and pass it to shouldEndAllocation so a
      // CONFIRMED-live game holds its outputs indefinitely. Non-fatal: if the
      // fetch fails we fall through to the wall-clock cap (the unconfirmable
      // case keeps its old safety-valve behaviour).
      let tickLiveData: any = null;
      try {
        const espnResp = await fetch(`http://127.0.0.1:${API_PORT}/api/scheduling/live-status`);
        if (espnResp.ok) tickLiveData = await espnResp.json();
      } catch (liveErr: any) {
        logger.warn(`[AUTO-REALLOCATOR] live-status fetch failed (non-fatal): ${liveErr.message}`);
      }

      // Step 2: Check each allocation to see if game has ended
      for (const { allocation, game, inputSource } of activeAllocations) {
        const shouldEnd = this.shouldEndAllocation(game, allocation, now, tickLiveData);

        if (shouldEnd.shouldEnd) {
          const endStartTime = Date.now();
          try {
            await this.endAllocation(allocation, inputSource, game, shouldEnd.reason, correlationId);
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

      // Step 2.5: Revert-sweep (v2.26.1) — catch any allocation that
      // got marked `completed` with an `actually_freed_at` timestamp
      // by a DIFFERENT code path (ESPN sync's failure-sweeper, manual
      // admin, direct DB update) and therefore bypassed our normal
      // endAllocation() revert-to-defaults call. Without this sweep,
      // TVs keep showing whatever channel the game was on even after
      // the game is logged as completed.
      //
      // Query: completed rows with a freed_at but no revert_attempted_at.
      // For each, run revertTVsToDefaults (which internally skips if
      // another game starts on the same input within 15 min). Then
      // mark revert_attempted_at = now so the sweep doesn't re-scan
      // on next tick regardless of whether the revert fired or was
      // skipped. Audit logs in revertTVsToDefaults still fire so
      // operators can see the action.
      try {
        const orphanedFreed = await db
          .select({
            allocation: schema.inputSourceAllocations,
            game: schema.gameSchedules,
            inputSource: schema.inputSources,
          })
          .from(schema.inputSourceAllocations)
          .innerJoin(
            schema.gameSchedules,
            eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id),
          )
          .innerJoin(
            schema.inputSources,
            eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id),
          )
          .where(
            and(
              isNotNull(schema.inputSourceAllocations.actuallyFreedAt),
              isNull(schema.inputSourceAllocations.revertAttemptedAt),
            ),
          )
          .all();

        if (orphanedFreed.length > 0) {
          logger.info(
            `[AUTO-REALLOCATOR] Revert-sweep: ${orphanedFreed.length} completed allocation(s) with no revert attempt`,
          );
        }

        for (const { allocation, game, inputSource } of orphanedFreed) {
          try {
            await this.revertTVsToDefaults(allocation, inputSource, game, correlationId);
          } catch (err: any) {
            logger.warn(
              `[AUTO-REALLOCATOR] Revert-sweep failed for ${allocation.id}: ${err.message} — marking attempted anyway so we don't re-loop`,
            );
          }
          // Mark attempted whether or not the revert actually routed —
          // a skip (another game in 15 min) is still a successful pass.
          await db
            .update(schema.inputSourceAllocations)
            .set({ revertAttemptedAt: now })
            .where(eq(schema.inputSourceAllocations.id, allocation.id));
          stats.inputSourcesFreed++; // count as a free for stats visibility
        }
      } catch (sweepErr: any) {
        logger.warn('[AUTO-REALLOCATOR] Revert-sweep query failed (non-fatal):', { error: sweepErr.message });
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
    currentTime: number,
    liveData?: any
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
      // v2.82.52 — HARD RULE before ending on wall-clock: if ESPN CONFIRMS this
      // game is still in progress, do NOT end it. A game that runs long (extra
      // innings, OT) is past its estimated end yet still live; ending here would
      // revert/steal the TVs off a live game (the Holmgren-Brewers bug). Hold
      // the allocation indefinitely while confirmed-live.
      if (this.isGameConfirmedLive(game, liveData)) {
        logger.info(
          `[AUTO-REALLOCATOR] ⏳ Holding ${game.awayTeamName} @ ${game.homeTeamName} — past estimated end but ESPN confirms still in progress (extra innings / OT)`
        );
        return { shouldEnd: false, reason: 'confirmed_live_holding' };
      }

      // Safety valve for the UNCONFIRMABLE case only (ESPN missing/stale —
      // no live row matched). Base the hard cap on the CURRENT game's own
      // estimated end, NOT the next game's lateness: if we're a large margin
      // (3h) past this game's estimated end with no live confirmation, the
      // live feed is probably stuck, so release rather than hold forever.
      const STALE_LIVE_MARGIN_SECONDS = 3 * 3600;
      const hardCap = allocation.expectedFreeAt + STALE_LIVE_MARGIN_SECONDS;
      if (currentTime > hardCap) {
        return { shouldEnd: true, reason: 'estimated_end_exceeded_unconfirmed_stale' };
      }
      // Between est_end+30min and the 3h hard cap, with no live confirmation,
      // give the game the benefit of the doubt and keep holding (re-checked
      // each tick once ESPN catches up or the hard cap trips).
      return { shouldEnd: false, reason: 'past_estimate_awaiting_live_confirmation' };
    }

    // Check 4: Actual end time is recorded
    if (game.actualEnd && currentTime > game.actualEnd) {
      return { shouldEnd: true, reason: 'actual_end_time' };
    }

    return { shouldEnd: false, reason: '' };
  }

  /**
   * v2.82.52 — Returns true ONLY when ESPN live-status positively confirms the
   * game is in progress. Mirrors checkCurrentGameStatus()'s in-progress
   * detection in scheduler-service.ts (incl. extra innings / OT). A missing
   * live feed, no matching game row, or a 'final'-ish status all return false
   * (we do NOT block on the unconfirmable case — the wall-clock hard cap covers
   * that). Matches by espnGameId first, then home+away team names.
   */
  private isGameConfirmedLive(game: any, liveData: any): boolean {
    if (!liveData || !liveData.success || !Array.isArray(liveData.games)) return false;

    const liveGame = liveData.games.find((g: any) =>
      (game.espnEventId && g.espnGameId === game.espnEventId) ||
      (g.homeTeam === game.homeTeamName && g.awayTeam === game.awayTeamName)
    );
    if (!liveGame) return false;

    const status = (liveGame.status || '').toLowerCase();

    // Explicitly completed → not live.
    if (
      status.includes('final') ||
      status.includes('completed') ||
      status.includes('postponed') ||
      status.includes('cancelled') ||
      status.includes('canceled')
    ) {
      return false;
    }

    // Positive in-progress signals (ESPN isLive flag is authoritative; the
    // string checks catch MLB innings, halftime, quarters/periods, OT, and
    // baseball extra innings via 'inning'/'top'/'bot'/'mid').
    return (
      liveGame.isLive === true ||
      status.includes('in progress') ||
      status.includes('halftime') ||
      status.includes('inning') ||
      status.includes(' top ') ||
      status.includes(' bot ') ||
      status.includes('1st') ||
      status.includes('2nd') ||
      status.includes('3rd') ||
      status.includes('4th') ||
      status.includes('quarter') ||
      status.includes('period') ||
      status.includes('overtime')
    );
  }

  /**
   * End an allocation and free the input source, then revert TVs to defaults
   */
  private async endAllocation(
    allocation: any,
    inputSource: any,
    game: any,
    reason: string,
    correlationId?: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000); // Unix timestamp

    // Update allocation to completed. Mark revertAttemptedAt at the
    // same time — this is the normal end-of-game path where we WILL
    // call revertTVsToDefaults below. Setting revertAttemptedAt here
    // stops the revert-sweep from re-running on the next tick.
    await db
      .update(schema.inputSourceAllocations)
      .set({
        status: 'completed',
        actuallyFreedAt: now,
        revertAttemptedAt: now,
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
    await this.revertTVsToDefaults(allocation, inputSource, game, correlationId);
  }

  /**
   * After a game ends, revert assigned TV outputs to their default sources
   * and tune the cable box back to its default channel.
   *
   * Skips revert if another game is starting on the same input source within 15 minutes.
   */
  private async revertTVsToDefaults(
    allocation: any,
    inputSource: any,
    game: any,
    correlationId?: string
  ): Promise<void> {
    const cid = correlationId || schedulerLogger.generateCorrelationId();

    // Track outcome so we can write a summary row at the end
    let cableBoxTuned: boolean | null = null;
    let cableBoxChannel: string | null = null;
    let autoSeededCableDefault = false;
    let tvOutputIdsForSummary: number[] = [];

    const baseMeta = () => ({
      gameId: game.id,
      inputSourceType: inputSource.type,
      inputSourceName: inputSource.name,
      tvCount: tvOutputIdsForSummary.length,
      cableBoxTuned,
      awayTeam: game.awayTeamName,
      homeTeam: game.homeTeamName,
    });

    try {
      const now = Math.floor(Date.now() / 1000);
      // v2.84.1 — operator rule: once a schedule ends, if NOTHING is scheduled
      // for that box within the next 15 minutes, revert to defaults (channel +
      // TV routing). Was 30 min; tightened to 15 so idle boxes return to their
      // default channel/input sooner after a game ends.
      const revertSkipHorizon = now + 15 * 60;

      // Step 1: Check if there's another game coming up on the same input source within 15 minutes
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
        return upcomingGame.scheduledStart <= revertSkipHorizon && upcomingGame.scheduledStart >= now;
      });

      if (hasUpcomingGame) {
        await schedulerLogger.info(
          'auto-reallocator',
          'revert',
          `Skipped revert for ${inputSource.name} — another game starts within 15 min`,
          cid,
          {
            inputSourceId: inputSource.id,
            allocationId: allocation.id,
            gameId: game.id,
            metadata: { ...baseMeta(), reason: 'upcoming_game_within_15min' },
          }
        );
        logger.info(
          `[AUTO-REALLOC] Game ended for ${game.awayTeamName} @ ${game.homeTeamName}, but another game starts within 15 min on ${inputSource.name} — skipping revert`
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
          await schedulerLogger.warn(
            'auto-reallocator',
            'revert',
            `Failed to load default sources config (HTTP ${response.status}), skipping revert`,
            cid,
            {
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              metadata: { ...baseMeta(), reason: 'default_sources_http_error', httpStatus: response.status },
            }
          );
          logger.warn('[AUTO-REALLOC] Failed to load default sources config, skipping revert');
          return;
        }
      } catch (fetchError: any) {
        await schedulerLogger.warn(
          'auto-reallocator',
          'revert',
          `Could not reach default-sources API, skipping revert`,
          cid,
          {
            inputSourceId: inputSource.id,
            allocationId: allocation.id,
            metadata: { ...baseMeta(), reason: 'default_sources_unreachable', error: fetchError.message },
          }
        );
        logger.warn('[AUTO-REALLOC] Could not reach default-sources API, skipping revert:', { error: fetchError.message });
        return;
      }

      if (!defaults) {
        await schedulerLogger.info(
          'auto-reallocator',
          'revert',
          `No default source configuration found, skipping revert`,
          cid,
          {
            inputSourceId: inputSource.id,
            allocationId: allocation.id,
            metadata: { ...baseMeta(), reason: 'no_defaults_config' },
          }
        );
        logger.debug('[AUTO-REALLOC] No default source configuration found, skipping revert');
        return;
      }

      // Step 3: Parse TV output IDs from the allocation
      let tvOutputIds: number[] = [];
      try {
        tvOutputIds = JSON.parse(allocation.tvOutputIds);
      } catch {
        await schedulerLogger.warn(
          'auto-reallocator',
          'revert',
          `Could not parse tvOutputIds for allocation ${allocation.id}, skipping revert`,
          cid,
          {
            inputSourceId: inputSource.id,
            allocationId: allocation.id,
            metadata: { ...baseMeta(), reason: 'tvOutputIds_parse_error' },
          }
        );
        logger.warn(`[AUTO-REALLOC] Could not parse tvOutputIds for allocation ${allocation.id}, skipping revert`);
        return;
      }

      tvOutputIdsForSummary = tvOutputIds;

      if (tvOutputIds.length === 0) {
        await schedulerLogger.info(
          'auto-reallocator',
          'revert',
          `No TV outputs assigned for allocation ${allocation.id}, proceeding to cable-box revert only`,
          cid,
          {
            inputSourceId: inputSource.id,
            allocationId: allocation.id,
            metadata: { ...baseMeta(), reason: 'no_tv_outputs' },
          }
        );
        logger.debug(`[AUTO-REALLOC] No TV outputs assigned for allocation ${allocation.id}, proceeding to cable-box revert only`);
        // Note: don't return — still attempt cable-box revert below so the
        // box goes back to a default channel even if no TVs were mapped.
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
          await schedulerLogger.info(
            'auto-reallocator',
            'revert',
            `No default source configured for output ${outputNumber} (${outputLabel}), skipping`,
            cid,
            {
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              metadata: {
                ...baseMeta(),
                reason: 'no_default_for_output',
                outputNumber,
                outputLabel,
              },
            }
          );
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

          // v2.55.43 — OR-gate sibling fix (same class as scheduler-service
          // v2.55.41). Previously: `if (routeResponse.ok)`. An HTTP 200 with
          // `{success:false}` body (or a body drifted off the
          // {success:true|false} contract) was treated as a successful revert
          // — the allocation is already marked completed/reverted by
          // endAllocation(), so the TV silently stayed on the dead game feed
          // with a green "reverted" log row. Treat success as
          // `result.success===true` strictly. v2.55.70 — routed through the
          // shared parseHardwareResult helper so the contract lives in ONE place.
          const revertHw = await parseHardwareResult(routeResponse);
          const revertResult = revertHw.body;
          const revertSucceeded = revertHw.ok;
          const malformedOk = revertHw.malformedOk;

          if (malformedOk) {
            // HTTP 200 but no explicit success flag — neither a clear success
            // nor an explicit failure. Log loudly so we catch any route
            // endpoint that drifts off the {success:true|false, ...} contract;
            // then fall through to the failure branch so we DON'T log the TV
            // as reverted based on a weak signal.
            await schedulerLogger.warn(
              'auto-reallocator',
              'revert',
              `Route returned HTTP 200 but no success flag — treating as failure for TV ${outputNumber} (${outputLabel}): ${JSON.stringify(revertResult)}`,
              cid,
              {
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: {
                  ...baseMeta(),
                  reason: 'tv_route_malformed_ok',
                  outputNumber,
                  outputLabel,
                  httpStatus: routeResponse.status,
                },
              }
            );
            logger.warn(`[AUTO-REALLOC] ⚠️ Route returned HTTP 200 but no success flag for TV ${outputNumber} (${outputLabel}): ${JSON.stringify(revertResult)}`);
          }

          if (revertSucceeded) {
            await schedulerLogger.info(
              'auto-reallocator',
              'revert',
              `Reverted TV ${outputNumber} (${outputLabel}) to default input ${defaultSource.inputNumber}`,
              cid,
              {
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: {
                  ...baseMeta(),
                  reason: 'tv_reverted',
                  outputNumber,
                  outputLabel,
                  defaultInputNumber: defaultSource.inputNumber,
                  defaultInputLabel: defaultSource.inputLabel,
                },
              }
            );
            logger.info(
              `[AUTO-REALLOC] Game ended, reverting TV ${outputNumber} (${outputLabel}) to default: ${defaultSource.inputLabel || 'input ' + defaultSource.inputNumber} (input ${defaultSource.inputNumber})`
            );
          } else {
            await schedulerLogger.warn(
              'auto-reallocator',
              'revert',
              `Failed to revert TV ${outputNumber} (${outputLabel}): ${revertResult.error || routeResponse.statusText}`,
              cid,
              {
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: {
                  ...baseMeta(),
                  reason: 'tv_route_failed',
                  outputNumber,
                  outputLabel,
                  httpStatus: routeResponse.status,
                  routeError: revertResult.error || routeResponse.statusText,
                },
              }
            );
            logger.warn(
              `[AUTO-REALLOC] Failed to revert TV ${outputNumber} (${outputLabel}) to default: ${revertResult.error || routeResponse.statusText}`
            );
          }
        } catch (routeError: any) {
          await schedulerLogger.error(
            'auto-reallocator',
            'revert',
            `Error reverting TV ${outputNumber} (${outputLabel}) to default`,
            cid,
            routeError,
            {
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              metadata: {
                ...baseMeta(),
                reason: 'tv_route_exception',
                outputNumber,
                outputLabel,
              },
            }
          );
          logger.error(`[AUTO-REALLOC] Error reverting TV ${outputNumber} (${outputLabel}) to default:`, { error: routeError.message });
        }
      }

      // Step 6: Tune the source box back to its default channel.
      //
      // (v2.28.3) Generalized to handle BOTH cable boxes AND DirecTV
      // receivers. Operator's `cableBoxDefaults` config is keyed by matrix
      // input number, which is unique across all box types — Holmgren's
      // setup uses keys 1-4 for cable boxes and 5-10 for the 6 DirecTV
      // receivers. Wolves/Nuggets and Orioles/Royals games yesterday left
      // DirecTV 6 and DirecTV 5 sitting on the game channel after revert
      // because this block was previously gated on type==='cable' only.
      //
      // cableBoxDefaults is keyed by matrix input number (stringified), so
      // we must resolve the source device first to find its matrix input.
      // For cable: irDevices.matrixInput. For DirecTV: DirecTVDevice.inputChannel.
      //
      // (v2.27.0) If no default is configured for this input, attempt to
      // auto-seed from ChannelTuneLog — the most recent successful tune
      // BEFORE the game's scheduledStart is a reasonable "what was this
      // box showing before the game" fallback.
      const isTunableBox = inputSource.type === 'cable' || inputSource.type === 'directv';
      if (isTunableBox && inputSource.deviceId) {
        // Resolve matrix input number based on source type.
        let matrixInput: number | null = null;
        let lookupSource: 'irDevice' | 'directvDevice' = 'irDevice';
        if (inputSource.type === 'cable') {
          const irDevice = await db
            .select()
            .from(schema.irDevices)
            .where(eq(schema.irDevices.id, inputSource.deviceId))
            .limit(1)
            .get();
          matrixInput = irDevice?.matrixInput ?? null;
        } else {
          // directv
          lookupSource = 'directvDevice';
          const dtv = await db
            .select()
            .from(schema.direcTVDevices)
            .where(eq(schema.direcTVDevices.id, inputSource.deviceId))
            .limit(1)
            .get();
          matrixInput = dtv?.inputChannel ?? null;
        }

        if (matrixInput == null) {
          cableBoxTuned = false;
          await schedulerLogger.warn(
            'auto-reallocator',
            'revert',
            `Cannot tune ${inputSource.name} to default: ${lookupSource} not found or missing matrix input`,
            cid,
            {
              inputSourceId: inputSource.id,
              deviceId: inputSource.deviceId,
              metadata: {
                ...baseMeta(),
                reason: lookupSource === 'irDevice' ? 'ir_device_missing_matrixInput' : 'directv_device_missing_inputChannel',
                sourceType: inputSource.type,
              },
            }
          );
        } else {
          const cableKey = String(matrixInput);
          let cableBoxDefault: CableBoxDefault | undefined =
            defaults.cableBoxDefaults?.[cableKey];

          // (v2.27.0) Auto-seed from tune history when no config value exists
          if (!cableBoxDefault || !cableBoxDefault.channelNumber) {
            const scheduledStartIso = new Date(game.scheduledStart * 1000).toISOString();
            try {
              const priorTune = await db
                .select()
                .from(schema.channelTuneLogs)
                .where(
                  and(
                    eq(schema.channelTuneLogs.inputNum, matrixInput),
                    eq(schema.channelTuneLogs.success, true),
                    lt(schema.channelTuneLogs.tunedAt, scheduledStartIso)
                  )
                )
                .orderBy(desc(schema.channelTuneLogs.tunedAt))
                .limit(1)
                .get();

              if (priorTune && priorTune.channelNumber) {
                cableBoxDefault = {
                  channelNumber: priorTune.channelNumber,
                  channelName: priorTune.channelName || undefined,
                };
                autoSeededCableDefault = true;

                await schedulerLogger.info(
                  'auto-reallocator',
                  'revert',
                  `Auto-seeded ${inputSource.type} default for ${inputSource.name} (input ${matrixInput}) from tune history: ch ${cableBoxDefault.channelNumber}`,
                  cid,
                  {
                    inputSourceId: inputSource.id,
                    deviceId: inputSource.deviceId,
                    channelNumber: cableBoxDefault.channelNumber,
                    metadata: {
                      ...baseMeta(),
                      reason: 'auto_seeded_from_tune_history',
                      matrixInput,
                      sourceType: inputSource.type,
                      priorTuneAt: priorTune.tunedAt,
                      scheduledStartIso,
                    },
                  }
                );

                // Persist so the UI shows it going forward
                await this.persistAutoSeededCableBoxDefault(
                  matrixInput,
                  cableBoxDefault,
                  inputSource,
                  cid
                );
              } else {
                cableBoxTuned = false;
                await schedulerLogger.warn(
                  'auto-reallocator',
                  'revert',
                  `No default channel configured for ${inputSource.name} and no tune history prior to game start — cannot revert ${inputSource.type} box`,
                  cid,
                  {
                    inputSourceId: inputSource.id,
                    metadata: {
                      ...baseMeta(),
                      reason: 'no_default_no_history',
                      matrixInput,
                      sourceType: inputSource.type,
                      scheduledStartIso,
                    },
                  }
                );
              }
            } catch (seedError: any) {
              cableBoxTuned = false;
              await schedulerLogger.error(
                'auto-reallocator',
                'revert',
                `Error auto-seeding ${inputSource.type} default from tune history for ${inputSource.name}`,
                cid,
                seedError,
                {
                  inputSourceId: inputSource.id,
                  metadata: {
                    ...baseMeta(),
                    reason: 'auto_seed_query_error',
                    matrixInput,
                    sourceType: inputSource.type,
                  },
                }
              );
            }
          }

          // Tune now if we have a default (configured OR auto-seeded)
          if (cableBoxDefault && cableBoxDefault.channelNumber) {
            cableBoxChannel = cableBoxDefault.channelNumber;
            // (v2.28.3) Build type-specific tune payload. Cable uses
            // cableBoxId (IR via Global Cache); DirecTV uses directTVId
            // (IP control via /tv/tune endpoint).
            const tunePayload: Record<string, any> = inputSource.type === 'cable'
              ? {
                  channelNumber: cableBoxDefault.channelNumber,
                  deviceType: 'cable',
                  cableBoxId: inputSource.deviceId,
                  presetId: 'default',
                }
              : {
                  channelNumber: cableBoxDefault.channelNumber,
                  deviceType: 'directv',
                  directTVId: inputSource.deviceId,
                  presetId: 'default',
                };
            try {
              const tuneResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/channel-presets/tune`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tunePayload),
              });

              // v2.55.43 — OR-gate sibling fix (same class as scheduler-service
              // v2.55.41, which fixed THIS SAME endpoint's contract on the tune
              // path). /api/channel-presets/tune returns HTTP 200 with
              // `{success:false, error:'…'}` for soft failures (box offline,
              // channel missing). Previously `if (tuneResponse.ok)` set
              // cableBoxTuned=true and logged "Tuned back to default" while the
              // box never moved. Treat success as `result.success===true`
              // strictly; HTTP 200 with a missing flag logs loud and falls to
              // the failure path. v2.55.70 — routed through the shared
              // parseHardwareResult helper so the contract lives in ONE place.
              const tuneHw = await parseHardwareResult(tuneResponse);
              const tuneResult = tuneHw.body;
              const tuneSucceeded = tuneHw.ok;
              const tuneMalformedOk = tuneHw.malformedOk;

              if (tuneMalformedOk) {
                await schedulerLogger.warn(
                  'auto-reallocator',
                  'revert',
                  `Tune returned HTTP 200 but no success flag — treating as failure for ${inputSource.name}: ${JSON.stringify(tuneResult)}`,
                  cid,
                  {
                    inputSourceId: inputSource.id,
                    channelNumber: cableBoxDefault.channelNumber,
                    metadata: {
                      ...baseMeta(),
                      reason: `${inputSource.type}_tune_malformed_ok`,
                      httpStatus: tuneResponse.status,
                      sourceType: inputSource.type,
                    },
                  }
                );
                logger.warn(`[AUTO-REALLOC] ⚠️ Tune returned HTTP 200 but no success flag for ${inputSource.name}: ${JSON.stringify(tuneResult)}`);
              }

              if (tuneSucceeded) {
                cableBoxTuned = true;
                const label = cableBoxDefault.channelName
                  ? `${cableBoxDefault.channelNumber} (${cableBoxDefault.channelName})`
                  : cableBoxDefault.channelNumber;
                await schedulerLogger.info(
                  'auto-reallocator',
                  'revert',
                  `Tuned ${inputSource.name} back to default channel ${label}`,
                  cid,
                  {
                    inputSourceId: inputSource.id,
                    channelNumber: cableBoxDefault.channelNumber,
                    deviceType: inputSource.type,
                    deviceId: inputSource.deviceId,
                    metadata: {
                      ...baseMeta(),
                      reason: autoSeededCableDefault
                        ? `${inputSource.type}_tuned_auto_seeded`
                        : `${inputSource.type}_tuned_configured`,
                      cableBoxTuned: true,
                      cableBoxChannel: cableBoxDefault.channelNumber,
                      cableBoxChannelName: cableBoxDefault.channelName,
                      matrixInput,
                      sourceType: inputSource.type,
                    },
                  }
                );
                logger.info(
                  `[AUTO-REALLOC] Game ended, tuning ${inputSource.name} back to default channel ${label}`
                );
              } else {
                cableBoxTuned = false;
                await schedulerLogger.error(
                  'auto-reallocator',
                  'revert',
                  `Failed to tune ${inputSource.name} back to default channel`,
                  cid,
                  new Error(tuneResult.error || tuneResponse.statusText),
                  {
                    inputSourceId: inputSource.id,
                    channelNumber: cableBoxDefault.channelNumber,
                    metadata: {
                      ...baseMeta(),
                      reason: `${inputSource.type}_tune_failed`,
                      httpStatus: tuneResponse.status,
                      tuneError: tuneResult.error || tuneResponse.statusText,
                      sourceType: inputSource.type,
                    },
                  }
                );
                logger.warn(
                  `[AUTO-REALLOC] Failed to tune ${inputSource.name} back to default channel: ${tuneResult.error || tuneResponse.statusText}`
                );
              }
            } catch (tuneError: any) {
              cableBoxTuned = false;
              await schedulerLogger.error(
                'auto-reallocator',
                'revert',
                `Error tuning ${inputSource.name} back to default channel`,
                cid,
                tuneError,
                {
                  inputSourceId: inputSource.id,
                  channelNumber: cableBoxDefault.channelNumber,
                  metadata: {
                    ...baseMeta(),
                    reason: `${inputSource.type}_tune_exception`,
                    sourceType: inputSource.type,
                  },
                }
              );
              logger.error(`[AUTO-REALLOC] Error tuning ${inputSource.name} back to default channel:`, { error: tuneError.message });
            }
          }
        }
      }

      // Summary row
      await schedulerLogger.info(
        'auto-reallocator',
        'revert',
        `Revert complete for ${game.awayTeamName} @ ${game.homeTeamName} — ${tvOutputIds.length} TV output(s) processed, cable-box tuned=${cableBoxTuned}`,
        cid,
        {
          inputSourceId: inputSource.id,
          allocationId: allocation.id,
          metadata: {
            ...baseMeta(),
            reason: 'revert_complete',
            cableBoxTuned,
            cableBoxChannel,
            autoSeededCableDefault,
          },
        }
      );

      logger.info(
        `[AUTO-REALLOC] Revert complete for ${game.awayTeamName} @ ${game.homeTeamName} — ${tvOutputIds.length} TV output(s) processed`
      );
    } catch (error: any) {
      // Don't let revert failures break the main allocation completion flow
      try {
        await schedulerLogger.error(
          'auto-reallocator',
          'revert',
          `Error during TV revert to defaults (non-fatal)`,
          cid,
          error,
          {
            inputSourceId: inputSource?.id,
            allocationId: allocation?.id,
            metadata: { ...baseMeta(), reason: 'revert_exception' },
          }
        );
      } catch {
        // swallow secondary logging failure
      }
      logger.error('[AUTO-REALLOC] Error during TV revert to defaults (non-fatal):', { error: error.message });
    }
  }

  /**
   * Persist an auto-seeded cable-box default directly to the SystemSettings
   * row keyed by 'default_sources'. Writes in-process (no HTTP round trip)
   * so the UI picks it up next time it loads, and so subsequent revert
   * passes don't need to re-query tune history.
   *
   * Idempotent: if the key already holds the same value, this is a no-op.
   */
  private async persistAutoSeededCableBoxDefault(
    matrixInputNum: number,
    cableBoxDefault: CableBoxDefault,
    inputSource: any,
    correlationId: string,
  ): Promise<void> {
    const SETTING_KEY = 'default_sources';
    const key = String(matrixInputNum);

    try {
      const existing = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, SETTING_KEY))
        .limit(1)
        .get();

      let config: DefaultSourcesConfig = {};
      if (existing) {
        try {
          config = JSON.parse(existing.value) as DefaultSourcesConfig;
        } catch {
          // Corrupt JSON — start fresh rather than lose the auto-seed
          config = {};
        }
      }

      const before = config.cableBoxDefaults?.[key];
      if (
        before &&
        before.channelNumber === cableBoxDefault.channelNumber &&
        (before.channelName || '') === (cableBoxDefault.channelName || '')
      ) {
        // Already persisted — nothing to do
        return;
      }

      const next: DefaultSourcesConfig = {
        ...config,
        cableBoxDefaults: {
          ...(config.cableBoxDefaults || {}),
          [key]: {
            channelNumber: cableBoxDefault.channelNumber,
            ...(cableBoxDefault.channelName ? { channelName: cableBoxDefault.channelName } : {}),
          },
        },
      };

      const nowIso = new Date().toISOString();
      const valueJson = JSON.stringify(next);

      if (existing) {
        await db
          .update(schema.systemSettings)
          .set({ value: valueJson, updatedAt: nowIso })
          .where(eq(schema.systemSettings.key, SETTING_KEY));
      } else {
        await db.insert(schema.systemSettings).values({
          id: crypto.randomUUID(),
          key: SETTING_KEY,
          value: valueJson,
          description: 'Default source configuration for TV outputs when no games are scheduled',
          updatedAt: nowIso,
        });
      }

      await schedulerLogger.info(
        'auto-reallocator',
        'revert',
        `Persisted auto-seeded cable-box default for input ${matrixInputNum} → ch ${cableBoxDefault.channelNumber}`,
        correlationId,
        {
          inputSourceId: inputSource?.id,
          channelNumber: cableBoxDefault.channelNumber,
          metadata: {
            reason: 'auto_seed_persisted',
            matrixInput: matrixInputNum,
            channelName: cableBoxDefault.channelName,
          },
        },
      );
    } catch (persistError: any) {
      // Concurrent-write race or transient DB failure — log and continue;
      // the next cron will re-seed if still missing.
      await schedulerLogger.warn(
        'auto-reallocator',
        'revert',
        `Failed to persist auto-seeded cable-box default for input ${matrixInputNum} (will retry on next cron)`,
        correlationId,
        {
          inputSourceId: inputSource?.id,
          metadata: {
            reason: 'auto_seed_persist_failed',
            matrixInput: matrixInputNum,
            error: persistError.message,
          },
        },
      );
    }
  }

  /**
   * v2.85.0 — FULL-LOCATION reset to defaults.
   *
   * Unconditional sibling of the per-game revertTVsToDefaults(): instead of
   * reverting the one allocation that just ended, this walks EVERY configured
   * matrix output and EVERY cable/DirecTV box and puts the whole location back
   * to its known-good default state. Used by the daily 04:00 CT "morning reset"
   * job and by the POST /api/scheduling/morning-reset manual trigger.
   *
   * Reuses the exact same primitives as revertTVsToDefaults:
   *   • default resolution from SystemSettings.default_sources
   *     (outputDefaults → roomDefaults → globalDefault for routing;
   *      cableBoxDefaults keyed by matrix-input for box tuning),
   *   • POST /api/matrix/route to route an output to its default input,
   *   • POST /api/channel-presets/tune to tune a box to its default channel,
   *   • parseHardwareResult to enforce the {success:true} contract.
   *
   * Live-game protection (v2.82.52): any output currently showing an
   * ESPN-confirmed in-progress game is NOT re-routed, and the box feeding that
   * game is NOT re-tuned. Moot at 4 AM (nothing live) but preserved so the
   * manual trigger is safe to run mid-day. TV power state is irrelevant —
   * matrix routing + box tuning work whether the TV is on or off; we never
   * power TVs on (staff do that at open).
   *
   * dryRun=true resolves and logs every action WITHOUT issuing any hardware
   * command (used to verify resolution off-hours without disrupting live TVs).
   */
  async resetAllToDefaults(
    opts: { dryRun?: boolean; trigger?: string; correlationId?: string } = {},
  ): Promise<MorningResetStats> {
    const dryRun = opts.dryRun === true;
    const trigger = opts.trigger || 'scheduled';
    const cid = opts.correlationId || schedulerLogger.generateCorrelationId();

    const stats: MorningResetStats = {
      dryRun,
      trigger,
      outputsConsidered: 0,
      outputsReverted: 0,
      outputsSkippedNoDefault: 0,
      outputsSkippedLive: 0,
      outputsFailed: 0,
      boxesConsidered: 0,
      boxesTuned: 0,
      boxesSkippedLive: 0,
      boxesUnresolved: 0,
      boxesFailed: 0,
      audioOutputsConsidered: 0,
      audioOutputsRouted: 0,
      audioOutputsFailed: 0,
      zonesConsidered: 0,
      zonesSet: 0,
      zonesSkipped: 0,
      zonesFailed: 0,
      errors: 0,
      plan: [],
    };

    const tag = dryRun ? '[MORNING-RESET][DRY-RUN]' : '[MORNING-RESET]';

    await schedulerLogger.info(
      'morning-reset',
      'daily-default-reset',
      `Morning reset starting (trigger=${trigger}, dryRun=${dryRun})`,
      cid,
      { metadata: { trigger, dryRun } },
    );
    logger.info(`${tag} Starting full-location reset to defaults (trigger=${trigger})`);

    try {
      // Step 1: Load default source configuration (same source as the per-game revert)
      let defaults: DefaultSourcesConfig | null = null;
      try {
        const response = await fetch(`http://127.0.0.1:${API_PORT}/api/settings/default-sources`);
        if (response.ok) {
          const data = await response.json();
          defaults = data.defaults as DefaultSourcesConfig;
        }
      } catch (fetchError: any) {
        stats.errors++;
        await schedulerLogger.warn(
          'morning-reset',
          'daily-default-reset',
          `Could not reach default-sources API — aborting morning reset`,
          cid,
          { metadata: { trigger, error: fetchError.message } },
        );
        logger.warn(`${tag} Could not reach default-sources API — aborting:`, { error: fetchError.message });
        return stats;
      }

      if (!defaults) {
        await schedulerLogger.info(
          'morning-reset',
          'daily-default-reset',
          `No default_sources configured for this location — morning reset is a no-op`,
          cid,
          { metadata: { trigger } },
        );
        logger.info(`${tag} No default_sources configured — nothing to reset (no-op)`);
        return stats;
      }

      // Step 2: Live-game protection. Build the set of outputs (and box matrix
      // inputs) feeding an ESPN-CONFIRMED in-progress game; these are never
      // touched. Mirrors the per-game path's confirmed-live gate.
      const protectedOutputs = new Set<number>();
      const protectedMatrixInputs = new Set<number>();
      try {
        let liveData: any = null;
        try {
          const espnResp = await fetch(`http://127.0.0.1:${API_PORT}/api/scheduling/live-status`);
          if (espnResp.ok) liveData = await espnResp.json();
        } catch (liveErr: any) {
          logger.warn(`${tag} live-status fetch failed (non-fatal):`, { error: liveErr.message });
        }

        const activeAllocations = await db
          .select({
            allocation: schema.inputSourceAllocations,
            game: schema.gameSchedules,
            inputSource: schema.inputSources,
          })
          .from(schema.inputSourceAllocations)
          .innerJoin(
            schema.gameSchedules,
            eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id),
          )
          .innerJoin(
            schema.inputSources,
            eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id),
          )
          .where(eq(schema.inputSourceAllocations.status, 'active'))
          .all();

        for (const { allocation, game, inputSource } of activeAllocations) {
          if (!this.isGameConfirmedLive(game, liveData)) continue;
          // Protect this game's outputs
          try {
            const ids: number[] = JSON.parse(allocation.tvOutputIds || '[]');
            ids.forEach((o) => protectedOutputs.add(o));
          } catch { /* malformed → no output protection from this row */ }
          // Protect the matrix input feeding this game (so we don't retune its box)
          try {
            if (inputSource.deviceId) {
              if (inputSource.type === 'cable') {
                const ir = await db.select().from(schema.irDevices)
                  .where(eq(schema.irDevices.id, inputSource.deviceId)).limit(1).get();
                if (ir?.matrixInput != null) protectedMatrixInputs.add(ir.matrixInput);
              } else if (inputSource.type === 'directv') {
                const dtv = await db.select().from(schema.direcTVDevices)
                  .where(eq(schema.direcTVDevices.id, inputSource.deviceId)).limit(1).get();
                if (dtv?.inputChannel != null) protectedMatrixInputs.add(dtv.inputChannel);
              }
            }
          } catch { /* non-fatal protection resolution */ }
        }

        if (protectedOutputs.size > 0 || protectedMatrixInputs.size > 0) {
          logger.info(`${tag} Live-game protection: ${protectedOutputs.size} output(s) + ${protectedMatrixInputs.size} box input(s) held`);
        }
      } catch (protErr: any) {
        // Non-fatal: if protection resolution fails we proceed WITHOUT
        // protection only at 4 AM (nothing live). To stay safe for mid-day
        // manual runs, a protection-query failure is logged but we continue;
        // the confirmed-live set is simply empty.
        logger.warn(`${tag} Live-game protection resolution failed (non-fatal):`, { error: protErr.message });
      }

      // Step 3: Route every configured matrix output back to its default input.
      const activeConfig = await db
        .select()
        .from(schema.matrixConfigurations)
        .where(eq(schema.matrixConfigurations.isActive, true))
        .limit(1)
        .get();

      if (activeConfig) {
        const allOutputs = await db
          .select()
          .from(schema.matrixOutputs)
          .where(eq(schema.matrixOutputs.configId, activeConfig.id))
          .all();

        for (const output of allOutputs) {
          // Skip audio-only / disabled outputs (Holmgren 37-40 are audio-only;
          // isSchedulingEnabled=false marks them).
          if (!output.isActive || !output.isSchedulingEnabled) continue;

          const outputNumber = output.channelNumber;
          const tvGroupId = output.tvGroupId || null;
          const outputLabel = output.label || `Output ${outputNumber}`;
          stats.outputsConsidered++;

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
            stats.outputsSkippedNoDefault++;
            stats.plan.push({ kind: 'route', output: outputNumber, label: outputLabel, skipped: 'no_default' });
            continue;
          }

          if (protectedOutputs.has(outputNumber)) {
            stats.outputsSkippedLive++;
            stats.plan.push({ kind: 'route', output: outputNumber, inputNumber: defaultSource.inputNumber, label: outputLabel, skipped: 'confirmed_live' });
            logger.info(`${tag} Skipping output ${outputNumber} (${outputLabel}) — confirmed-live game`);
            continue;
          }

          stats.plan.push({ kind: 'route', output: outputNumber, inputNumber: defaultSource.inputNumber, label: outputLabel });

          if (dryRun) {
            stats.outputsReverted++;
            logger.info(`${tag} WOULD route output ${outputNumber} (${outputLabel}) → input ${defaultSource.inputNumber}${defaultSource.inputLabel ? ' (' + defaultSource.inputLabel + ')' : ''}`);
            continue;
          }

          try {
            const routeResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: defaultSource.inputNumber,
                output: outputNumber,
                source: 'morning-reset',
              }),
            });
            const routeHw = await parseHardwareResult(routeResponse);
            if (routeHw.ok) {
              stats.outputsReverted++;
              await schedulerLogger.info(
                'morning-reset',
                'daily-default-reset',
                `Reset output ${outputNumber} (${outputLabel}) to default input ${defaultSource.inputNumber}`,
                cid,
                { metadata: { trigger, outputNumber, outputLabel, defaultInputNumber: defaultSource.inputNumber } },
              );
              logger.info(`${tag} Reset output ${outputNumber} (${outputLabel}) → input ${defaultSource.inputNumber}`);
            } else {
              stats.outputsFailed++;
              await schedulerLogger.warn(
                'morning-reset',
                'daily-default-reset',
                `Failed to reset output ${outputNumber} (${outputLabel}): ${routeHw.body?.error || routeResponse.statusText}`,
                cid,
                { metadata: { trigger, outputNumber, outputLabel, httpStatus: routeResponse.status } },
              );
              logger.warn(`${tag} Failed to reset output ${outputNumber} (${outputLabel}): ${routeHw.body?.error || routeResponse.statusText}`);
            }
          } catch (routeError: any) {
            stats.outputsFailed++;
            stats.errors++;
            logger.error(`${tag} Error routing output ${outputNumber} (${outputLabel}):`, { error: routeError.message });
          }
        }
      } else {
        logger.warn(`${tag} No active matrix configuration found — skipping output routing`);
      }

      // Step 4: Tune every configured cable / DirecTV box back to its default
      // channel. cableBoxDefaults is keyed by matrix input number (unique
      // across box types). Resolve each key to an IR device (cable) or a
      // DirecTV device, then issue the type-specific tune payload — exactly the
      // payload shape the per-game revert builds.
      const cableBoxDefaults = defaults.cableBoxDefaults || {};
      for (const [cableKey, def] of Object.entries(cableBoxDefaults)) {
        if (!def || !def.channelNumber) continue;
        const matrixInput = Number(cableKey);
        if (!Number.isFinite(matrixInput)) continue;
        stats.boxesConsidered++;

        if (protectedMatrixInputs.has(matrixInput)) {
          stats.boxesSkippedLive++;
          stats.plan.push({ kind: 'tune', matrixInput, channelNumber: def.channelNumber, skipped: 'confirmed_live' });
          logger.info(`${tag} Skipping box on input ${matrixInput} — confirmed-live game`);
          continue;
        }

        // Resolve the device feeding this matrix input. Cable first (IR via
        // Global Cache), then DirecTV (IP control).
        let deviceType: 'cable' | 'directv' | null = null;
        let deviceId: string | null = null;
        try {
          const ir = await db.select().from(schema.irDevices)
            .where(eq(schema.irDevices.matrixInput, matrixInput)).limit(1).get();
          if (ir) {
            deviceType = 'cable';
            deviceId = ir.id;
          } else {
            const dtv = await db.select().from(schema.direcTVDevices)
              .where(eq(schema.direcTVDevices.inputChannel, matrixInput)).limit(1).get();
            if (dtv) {
              deviceType = 'directv';
              deviceId = dtv.id;
            }
          }
        } catch (resolveErr: any) {
          logger.warn(`${tag} Error resolving device for matrix input ${matrixInput}:`, { error: resolveErr.message });
        }

        if (!deviceType || !deviceId) {
          stats.boxesUnresolved++;
          stats.plan.push({ kind: 'tune', matrixInput, channelNumber: def.channelNumber, skipped: 'no_device_for_input' });
          logger.warn(`${tag} No cable/DirecTV device found for matrix input ${matrixInput} — cannot tune (default ch ${def.channelNumber})`);
          continue;
        }

        const label = def.channelName ? `${def.channelNumber} (${def.channelName})` : def.channelNumber;
        stats.plan.push({ kind: 'tune', matrixInput, deviceType, deviceId, channelNumber: def.channelNumber, label });

        if (dryRun) {
          stats.boxesTuned++;
          logger.info(`${tag} WOULD tune ${deviceType} box (input ${matrixInput}, device ${deviceId}) → ch ${label}`);
          continue;
        }

        const tunePayload: Record<string, any> = deviceType === 'cable'
          ? { channelNumber: def.channelNumber, deviceType: 'cable', cableBoxId: deviceId, presetId: 'default' }
          : { channelNumber: def.channelNumber, deviceType: 'directv', directTVId: deviceId, presetId: 'default' };

        try {
          const tuneResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/channel-presets/tune`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tunePayload),
          });
          const tuneHw = await parseHardwareResult(tuneResponse);
          if (tuneHw.ok) {
            stats.boxesTuned++;
            await schedulerLogger.info(
              'morning-reset',
              'daily-default-reset',
              `Tuned ${deviceType} box (input ${matrixInput}) back to default channel ${label}`,
              cid,
              { channelNumber: def.channelNumber, deviceType, deviceId, metadata: { trigger, matrixInput } },
            );
            logger.info(`${tag} Tuned ${deviceType} box (input ${matrixInput}) → ch ${label}`);
          } else {
            stats.boxesFailed++;
            await schedulerLogger.warn(
              'morning-reset',
              'daily-default-reset',
              `Failed to tune ${deviceType} box (input ${matrixInput}) to default channel: ${tuneHw.body?.error || tuneResponse.statusText}`,
              cid,
              { channelNumber: def.channelNumber, deviceType, deviceId, metadata: { trigger, matrixInput, httpStatus: tuneResponse.status } },
            );
            logger.warn(`${tag} Failed to tune ${deviceType} box (input ${matrixInput}): ${tuneHw.body?.error || tuneResponse.statusText}`);
          }
        } catch (tuneError: any) {
          stats.boxesFailed++;
          stats.errors++;
          logger.error(`${tag} Error tuning ${deviceType} box (input ${matrixInput}):`, { error: tuneError.message });
        }
      }

      // Step 4.5 (v2.86.0): AUDIO defaults pass. After the video side is back
      // to defaults, put the audio side back too:
      //   (a) route the audio-matrix outputs (isSchedulingEnabled=false) to
      //       their configured default audio source via /api/matrix/route, and
      //   (b) set each configured Atlas zone to its default level via
      //       /api/audio-processor/control (action='volume'), which routes
      //       through executeAtlasCommand → getAtlasClient (the shared
      //       singleton, CLAUDE.md Gotcha #10 — never `new AtlasTCPClient`).
      // Drop-watcher coordination: before each real zone-level set we write a
      // SchedulerLog marker (operation='audio-default-reset', metadata
      // {processorId, atlasZone}); atlas-drop-watcher honors it so a deliberate
      // lower default level is logged EXPLAINED and never files a false "audio
      // dropped" todo.
      const audioDefaults = defaults.audioDefaults || {};

      // (a) Audio-matrix output routing.
      const audioRouting = audioDefaults.audioRouting || {};
      for (const [outKey, inputNum] of Object.entries(audioRouting)) {
        const outputNumber = Number(outKey);
        if (!Number.isFinite(outputNumber) || !Number.isFinite(inputNum)) continue;
        stats.audioOutputsConsidered++;

        if (protectedOutputs.has(outputNumber)) {
          stats.plan.push({ kind: 'audio-route', output: outputNumber, inputNumber: inputNum, skipped: 'confirmed_live' });
          logger.info(`${tag} Skipping audio output ${outputNumber} — confirmed-live game`);
          continue;
        }

        stats.plan.push({ kind: 'audio-route', output: outputNumber, inputNumber: inputNum });

        if (dryRun) {
          stats.audioOutputsRouted++;
          logger.info(`${tag} WOULD route audio output ${outputNumber} → input ${inputNum}`);
          continue;
        }

        try {
          const routeResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: inputNum, output: outputNumber, source: 'morning-reset' }),
          });
          const routeHw = await parseHardwareResult(routeResponse);
          if (routeHw.ok) {
            stats.audioOutputsRouted++;
            await schedulerLogger.info(
              'morning-reset',
              'daily-default-reset',
              `Reset audio output ${outputNumber} to default input ${inputNum}`,
              cid,
              { metadata: { trigger, audioOutput: outputNumber, defaultInputNumber: inputNum } },
            );
            logger.info(`${tag} Reset audio output ${outputNumber} → input ${inputNum}`);
          } else {
            stats.audioOutputsFailed++;
            await schedulerLogger.warn(
              'morning-reset',
              'daily-default-reset',
              `Failed to reset audio output ${outputNumber}: ${routeHw.body?.error || routeResponse.statusText}`,
              cid,
              { metadata: { trigger, audioOutput: outputNumber, httpStatus: routeResponse.status } },
            );
            logger.warn(`${tag} Failed to reset audio output ${outputNumber}: ${routeHw.body?.error || routeResponse.statusText}`);
          }
        } catch (audioRouteErr: any) {
          stats.audioOutputsFailed++;
          stats.errors++;
          logger.error(`${tag} Error routing audio output ${outputNumber}:`, { error: audioRouteErr.message });
        }
      }

      // (b) Atlas zone default levels.
      const zoneLevels = audioDefaults.zoneLevels || [];
      if (zoneLevels.length > 0) {
        // Resolve processor types once so we only drive Atlas for now (the
        // data model carries processorId so dbx/BSS can be added later by
        // relaxing this guard + handling their value scale).
        let procTypeById = new Map<string, string>();
        try {
          const procRows = await db.select().from(schema.audioProcessors).all();
          for (const pr of procRows) procTypeById.set(pr.id, pr.processorType || 'atlas');
        } catch (procErr: any) {
          logger.warn(`${tag} Could not load audio processors for zone-level reset (non-fatal):`, { error: procErr.message });
        }

        for (const zl of zoneLevels) {
          if (!zl || !zl.processorId || !Number.isFinite(zl.level)) continue;
          stats.zonesConsidered++;

          const procType = procTypeById.get(zl.processorId);
          if (procType && procType !== 'atlas') {
            stats.zonesSkipped++;
            stats.plan.push({ kind: 'zone-level', processorId: zl.processorId, zoneNumber: zl.zoneNumber + 1, level: zl.level, label: zl.zoneName, skipped: 'non_atlas_processor' });
            logger.info(`${tag} Skipping zone "${zl.zoneName}" — processor type "${procType}" not wired for zone-level reset yet`);
            continue;
          }

          // Atlas control API is 1-based; drop-watcher keys its marker on the
          // 1-based Atlas zone too.
          const atlasZone = zl.zoneNumber + 1;

          // Operator rule (v2.86.2): the bar is CLOSED at 4 AM — the reset sets
          // the level UNDER the current mute state and NEVER unmutes. The
          // bartender unmutes at open. setZoneVolume writes ZoneGain_<n> only,
          // a separate Atlas parameter from ZoneMute_<n>, so the volume command
          // provably cannot unmute a zone (verified in atlasClient.setZoneVolume
          // / setZoneMute — independent params). We therefore only READ the
          // current mute state (from the DB cache the drop-watcher refreshes
          // every 30s) to LOG the preserved decision; the control call below is
          // volume-only and issues no mute/unmute. A muted zone stays muted.
          let wasMuted: boolean | null = null;
          try {
            const zoneRow = await db.select().from(schema.audioZones)
              .where(and(
                eq(schema.audioZones.processorId, zl.processorId),
                eq(schema.audioZones.zoneNumber, zl.zoneNumber),
              ))
              .limit(1).get();
            if (zoneRow) wasMuted = !!zoneRow.muted;
          } catch (muteErr: any) {
            logger.warn(`${tag} Could not read mute state for zone "${zl.zoneName}" (non-fatal; level set only):`, { error: muteErr.message });
          }
          const muteNote = wasMuted === null
            ? 'mute unknown — level only, no unmute'
            : (wasMuted ? 'muted → kept muted, level only (no unmute)' : 'unmuted → level only');

          stats.plan.push({ kind: 'zone-level', processorId: zl.processorId, zoneNumber: atlasZone, level: zl.level, label: zl.zoneName, muted: wasMuted ?? undefined });

          if (dryRun) {
            stats.zonesSet++;
            logger.info(`${tag} WOULD set zone "${zl.zoneName}" (Atlas zone ${atlasZone}) → ${zl.level}% (${muteNote})`);
            continue;
          }

          // Drop-watcher coordination marker — written BEFORE the gain change
          // so it is present when the watcher's next 30s poll detects the drop.
          // Records the preserved-mute decision so SchedulerLog shows it.
          await schedulerLogger.info(
            'morning-reset',
            'audio-default-reset',
            `Set zone "${zl.zoneName}" (Atlas zone ${atlasZone}) to default level ${zl.level}% (${muteNote})`,
            cid,
            { metadata: { trigger, processorId: zl.processorId, atlasZone, zoneName: zl.zoneName, level: zl.level, wasMuted } },
          );

          try {
            const ctrlResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/audio-processor/control`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                processorId: zl.processorId,
                command: { action: 'volume', zone: atlasZone, value: zl.level },
              }),
            });
            const ctrlHw = await parseHardwareResult(ctrlResponse);
            if (ctrlHw.ok) {
              stats.zonesSet++;
              logger.info(`${tag} Set zone "${zl.zoneName}" (Atlas zone ${atlasZone}) → ${zl.level}%`);
            } else {
              stats.zonesFailed++;
              await schedulerLogger.warn(
                'morning-reset',
                'daily-default-reset',
                `Failed to set zone "${zl.zoneName}" (Atlas zone ${atlasZone}) to ${zl.level}%: ${ctrlHw.body?.error || ctrlResponse.statusText}`,
                cid,
                { metadata: { trigger, processorId: zl.processorId, atlasZone, httpStatus: ctrlResponse.status } },
              );
              logger.warn(`${tag} Failed to set zone "${zl.zoneName}" (Atlas zone ${atlasZone}): ${ctrlHw.body?.error || ctrlResponse.statusText}`);
            }
          } catch (zoneErr: any) {
            stats.zonesFailed++;
            stats.errors++;
            logger.error(`${tag} Error setting zone "${zl.zoneName}" (Atlas zone ${atlasZone}):`, { error: zoneErr.message });
          }

          // Small delay between Atlas writes to avoid overrunning the shared
          // command channel.
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      // Step 5: Summary row to SchedulerLog so the operator can confirm it ran.
      await schedulerLogger.info(
        'morning-reset',
        'daily-default-reset',
        `Morning reset complete (trigger=${trigger}, dryRun=${dryRun}) — ${stats.outputsReverted} output(s) ${dryRun ? 'would be ' : ''}reverted, ${stats.boxesTuned} box(es) ${dryRun ? 'would be ' : ''}tuned, ${stats.audioOutputsRouted} audio output(s) ${dryRun ? 'would be ' : ''}routed, ${stats.zonesSet} zone level(s) ${dryRun ? 'would be ' : ''}set, ${stats.outputsSkippedLive} output(s) + ${stats.boxesSkippedLive} box(es) held for live games`,
        cid,
        { metadata: { ...stats, plan: undefined } },
      );
      logger.info(
        `${tag} Complete — outputs reverted=${stats.outputsReverted}/${stats.outputsConsidered}, boxes tuned=${stats.boxesTuned}/${stats.boxesConsidered}, audio outputs routed=${stats.audioOutputsRouted}/${stats.audioOutputsConsidered}, zone levels set=${stats.zonesSet}/${stats.zonesConsidered} (skipped non-atlas=${stats.zonesSkipped}, failed=${stats.zonesFailed}), live-held outputs=${stats.outputsSkippedLive} boxes=${stats.boxesSkippedLive}, no-default outputs=${stats.outputsSkippedNoDefault}, unresolved boxes=${stats.boxesUnresolved}`,
      );

      return stats;
    } catch (error: any) {
      stats.errors++;
      try {
        await schedulerLogger.error(
          'morning-reset',
          'daily-default-reset',
          `Morning reset failed`,
          cid,
          error,
          { metadata: { trigger, dryRun } },
        );
      } catch { /* swallow secondary logging failure */ }
      logger.error(`${tag} Morning reset failed:`, { error: error.message });
      return stats;
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
