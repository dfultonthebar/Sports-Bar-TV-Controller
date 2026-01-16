/**
 * Background Scheduler Service
 *
 * This service runs in the background and executes schedules at their specified times.
 * It checks every minute for schedules that need to be executed.
 */

import { db, schema, eq, findMany } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from './scheduler-logger'

// Get API port from environment or default to 3001
const API_PORT = process.env.PORT || 3001

// Venue timezone for schedule calculations (Central Time)
const VENUE_TIMEZONE = 'America/Chicago'

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastCleanup: Date | null = null;
  private executingSchedules = new Set<string>();

  /**
   * Start the scheduler service
   */
  start() {
    if (this.isRunning) {
      logger.debug('Scheduler service is already running');
      return;
    }

    // Initialize the scheduler logger
    schedulerLogger.init();

    const correlationId = schedulerLogger.generateCorrelationId();
    logger.info('[SCHEDULER] Starting scheduler service...');

    schedulerLogger.info(
      'scheduler-service',
      'startup',
      'Scheduler service starting',
      correlationId
    );

    this.isRunning = true;

    // Clear existing interval if any to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // On startup, recover any bartender-scheduled tunes that may have been missed during downtime
    this.recoverMissedBartenderSchedules();

    // Check every minute for schedules to execute
    this.intervalId = setInterval(() => {
      this.checkAndExecuteSchedules();
    }, 60000); // 60 seconds

    // Also check immediately on start
    this.checkAndExecuteSchedules();

    schedulerLogger.info(
      'scheduler-service',
      'startup',
      'Scheduler service started successfully',
      correlationId
    );
  }

  /**
   * Recover bartender-scheduled tunes that may have been missed during system downtime
   * This handles the case where:
   * 1. A bartender scheduled a tune for 2:00 PM
   * 2. The system was rebooted at 2:15 PM (past the scheduled time)
   * 3. On startup, we should still tune to that channel if the game is still ongoing
   */
  private async recoverMissedBartenderSchedules() {
    const correlationId = schedulerLogger.generateCorrelationId();
    const startTime = Date.now();

    try {
      const now = new Date();
      const nowUnix = Math.floor(now.getTime() / 1000);

      await schedulerLogger.info(
        'scheduler-service',
        'recover',
        'Starting recovery check for missed bartender-scheduled tunes',
        correlationId
      );

      logger.info('[SCHEDULER] 🔄 Checking for missed bartender-scheduled tunes after startup...');

      // Find all pending bartender allocations that are past due
      const pendingAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        inputSource: schema.inputSources,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.status, 'pending'))
      .all();

      // Also find 'active' bartender allocations that may not have actually tuned
      // (e.g., AUTO-REALLOCATOR marked them active before the fix)
      const activeAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        inputSource: schema.inputSources,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.status, 'active'))
      .all();

      // Filter to bartender-scheduled allocations that are past due and games still ongoing
      const allAllocations = [...pendingAllocations, ...activeAllocations];
      const missedAllocations = allAllocations.filter((r) => {
        // Only bartender-scheduled
        if (r.allocation.scheduledBy !== 'bartender') return false;
        // Past the scheduled tune time
        if ((r.allocation.allocatedAt || 0) > nowUnix) return false;
        // Game hasn't ended yet (check estimatedEnd with 30 min buffer)
        const gameEndBuffer = (r.game.estimatedEnd || 0) + 30 * 60;
        if (gameEndBuffer > 0 && nowUnix > gameEndBuffer) return false;
        return true;
      });

      if (missedAllocations.length === 0) {
        logger.info('[SCHEDULER] ✅ No missed bartender-scheduled tunes to recover');
        await schedulerLogger.info(
          'scheduler-service',
          'recover',
          'No missed bartender-scheduled tunes to recover',
          correlationId,
          { durationMs: Date.now() - startTime }
        );
        return;
      }

      await schedulerLogger.info(
        'scheduler-service',
        'recover',
        `Found ${missedAllocations.length} potentially missed bartender-scheduled tunes to recover`,
        correlationId,
        { metadata: { missedCount: missedAllocations.length } }
      );

      logger.info(`[SCHEDULER] 🎯 Found ${missedAllocations.length} potentially missed bartender-scheduled tunes to recover`);

      for (const { allocation, inputSource, game } of missedAllocations) {
        const tuneStartTime = Date.now();
        try {
          logger.info(`[SCHEDULER] 📺 Recovering scheduled tune: ${inputSource.name} to channel ${allocation.channelNumber} for ${game.homeTeamName} vs ${game.awayTeamName}`);

          // Call the channel tune API
          const response = await fetch(`http://localhost:${API_PORT}/api/channel-presets/tune`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType,
              cableBoxId: allocation.inputSourceType === 'cable' ? inputSource.deviceId : undefined,
              directTVId: allocation.inputSourceType === 'directv' ? inputSource.deviceId : undefined,
              fireTVId: allocation.inputSourceType === 'firetv' ? inputSource.deviceId : undefined,
            })
          });

          const result = await response.json();
          const tuneDurationMs = Date.now() - tuneStartTime;

          if (result.success || response.ok) {
            // Ensure allocation is marked as active
            await db.update(schema.inputSourceAllocations)
              .set({
                status: 'active',
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSourceAllocations.id, allocation.id));

            await schedulerLogger.info(
              'scheduler-service',
              'recover',
              `Recovered tune: ${inputSource.name} to channel ${allocation.channelNumber}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                channelNumber: allocation.channelNumber,
                deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
                durationMs: tuneDurationMs,
              }
            );

            logger.info(`[SCHEDULER] ✅ Recovered: Successfully tuned ${inputSource.name} to channel ${allocation.channelNumber}`);
          } else {
            await schedulerLogger.log({
              correlationId,
              component: 'scheduler-service',
              operation: 'recover',
              level: 'error',
              message: `Failed to recover tune for ${inputSource.name}`,
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              success: false,
              durationMs: tuneDurationMs,
              errorMessage: result.error || result.message || 'Unknown error',
            });

            logger.error(`[SCHEDULER] ❌ Failed to recover tune for ${inputSource.name}: ${result.error || result.message}`);
          }
        } catch (tuneError: any) {
          await schedulerLogger.error(
            'scheduler-service',
            'recover',
            `Error recovering scheduled tune for ${inputSource.name}`,
            correlationId,
            tuneError,
            {
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              durationMs: Date.now() - tuneStartTime,
            }
          );

          logger.error(`[SCHEDULER] ❌ Error recovering scheduled tune for ${inputSource.name}:`, { error: tuneError });
        }
      }

      await schedulerLogger.info(
        'scheduler-service',
        'recover',
        `Recovery complete - processed ${missedAllocations.length} missed allocations`,
        correlationId,
        { durationMs: Date.now() - startTime }
      );
    } catch (error: any) {
      await schedulerLogger.error(
        'scheduler-service',
        'recover',
        'Error recovering missed bartender schedules',
        correlationId,
        error,
        { durationMs: Date.now() - startTime }
      );

      logger.error('[SCHEDULER] ❌ Error recovering missed bartender schedules:', { error });
    }
  }

  /**
   * Stop the scheduler service
   */
  async stop() {
    const correlationId = schedulerLogger.generateCorrelationId();

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;

    await schedulerLogger.info(
      'scheduler-service',
      'cleanup',
      'Scheduler service stopped',
      correlationId
    );

    // Stop the scheduler logger and flush remaining metrics
    await schedulerLogger.stop();

    logger.debug('Scheduler service stopped');
  }

  /**
   * Check for schedules that need to be executed and execute them
   */
  private async checkAndExecuteSchedules() {
    try {
      const now = new Date();

      // Check for pending bartender-scheduled channel tunes
      await this.checkAndExecuteBartenderSchedules(now);

      // Hourly cleanup: Remove games that started 2+ hours ago
      if (!this.lastCleanup || (now.getTime() - this.lastCleanup.getTime()) >= 3600000) {
        this.cleanupOldGames();
        this.lastCleanup = now;
      }

      // Get all enabled schedules
      const schedules = await findMany('schedules', {
        where: eq(schema.schedules.enabled, true)
      });

      logger.debug(`[SCHEDULER] Checking ${schedules.length} enabled schedules...`);

      for (const schedule of schedules) {
        let shouldExecute = false;

        // Special handling for continuous schedules (like AI Game Monitor)
        // These run every 5 minutes based on time since last execution
        if (schedule.scheduleType === 'continuous') {
          const intervalMs = 5 * 60 * 1000; // 5 minutes
          const lastExec = schedule.lastExecuted ? new Date(schedule.lastExecuted) : null;
          const timeSinceLastExec = lastExec ? now.getTime() - lastExec.getTime() : Infinity;
          const minutesSinceLastExec = lastExec ? Math.floor(timeSinceLastExec / 60000) : null;

          // Execute if never run, or if interval has passed
          shouldExecute = !lastExec || timeSinceLastExec >= intervalMs;

          const nextIn = lastExec ? Math.max(0, Math.ceil((intervalMs - timeSinceLastExec) / 60000)) : 0;
          logger.debug(`[SCHEDULER] 📺 Continuous schedule "${schedule.name}": Last exec ${minutesSinceLastExec !== null ? minutesSinceLastExec + ' min ago' : 'never'}, ${shouldExecute ? 'EXECUTING NOW' : `next in ${nextIn} min`}`);
        } else {
          // For time-based schedules (once, daily, weekly), use calculateNextExecution
          const nextExecution = this.calculateNextExecution(schedule);

          if (!nextExecution) {
            logger.debug(`[SCHEDULER] No next execution time for schedule: ${schedule.name} (type: ${schedule.scheduleType})`);
            continue;
          }

          // Check if it's time to execute (within the last minute)
          const timeDiff = now.getTime() - nextExecution.getTime();
          shouldExecute = timeDiff >= 0 && timeDiff < 60000;
        }

        if (shouldExecute) {
          // Prevent concurrent execution of same schedule
          if (this.executingSchedules.has(schedule.id)) {
            logger.warn(`[SCHEDULER] Schedule ${schedule.name} already executing, skipping`);
            continue;
          }

          logger.info(`[SCHEDULER] ⚡ Executing schedule: ${schedule.name} (type: ${schedule.scheduleType})`);

          // Add to executing set
          this.executingSchedules.add(schedule.id);

          // Execute schedule asynchronously
          this.executeSchedule(schedule.id)
            .catch(error => {
              logger.error(`[SCHEDULER] ❌ Error executing schedule ${schedule.name}:`, { error });
            })
            .finally(() => {
              // Remove from executing set when complete
              this.executingSchedules.delete(schedule.id);
            });
        }
      }
    } catch (error) {
      logger.error('[SCHEDULER] Error checking schedules:', { error });
    }
  }

  /**
   * Execute a schedule by calling the API endpoint
   */
  private async executeSchedule(scheduleId: string) {
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${API_PORT}/api/schedules/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      if (result.result?.success) {
        logger.info(`[SCHEDULER] ✅ Schedule executed successfully in ${duration}ms - Games: ${result.result.gamesFound || 0}, Channels: ${result.result.channelsSet || 0}`);
      } else {
        logger.warn(`[SCHEDULER] ⚠️  Schedule execution completed with issues (${duration}ms): ${result.result?.message}`);
      }
    } catch (error) {
      logger.error(`[SCHEDULER] ❌ Failed to execute schedule ${scheduleId}:`, { error });
    }
  }

  /**
   * Calculate the next execution time for a schedule
   */
  private calculateNextExecution(schedule: any): Date | null {
    if (!schedule.enabled) {
      return null;
    }

    const now = new Date();

    // CONTINUOUS: AI-powered game monitoring - runs every 5 minutes
    if (schedule.scheduleType === 'continuous') {
      // If never executed or no lastExecuted, run immediately
      if (!schedule.lastExecuted) {
        return now;
      }

      // Calculate next execution based on lastExecuted + 5 minutes
      const lastExec = new Date(schedule.lastExecuted);
      const intervalMs = 5 * 60 * 1000; // 5 minutes
      const next = new Date(lastExec.getTime() + intervalMs);

      // If multiple intervals have passed, schedule for the next upcoming interval
      // This ensures we don't spam executions if the system was down
      while (next < now) {
        next.setTime(next.getTime() + intervalMs);
      }

      return next;
    }

    // For time-based schedules, executionTime is required
    if (!schedule.executionTime) {
      return null;
    }

    if (schedule.scheduleType === 'once') {
      const once = new Date(schedule.executionTime);
      return once > now ? once : null;
    }

    if (schedule.scheduleType === 'daily') {
      const [hours, minutes] = schedule.executionTime.split(':').map(Number);

      // Get current time in venue timezone using Intl API
      // This properly handles DST transitions
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VENUE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

      const currentYear = parseInt(getPart('year'));
      const currentMonth = parseInt(getPart('month')) - 1; // JS months are 0-indexed
      const currentDay = parseInt(getPart('day'));
      const currentHour = parseInt(getPart('hour'));
      const currentMinute = parseInt(getPart('minute'));

      // Create today's scheduled time in venue timezone
      const next = new Date(currentYear, currentMonth, currentDay, hours, minutes, 0, 0);

      // If scheduled time has already passed today, schedule for tomorrow
      const todayScheduledTime = new Date(currentYear, currentMonth, currentDay, hours, minutes, 0, 0);
      const currentTimeInVenue = new Date(currentYear, currentMonth, currentDay, currentHour, currentMinute, 0, 0);

      if (todayScheduledTime <= currentTimeInVenue) {
        next.setDate(next.getDate() + 1);
      }

      // Note: For proper DST handling with external library, consider:
      // npm install date-fns date-fns-tz
      // import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'
      // const nextInVenue = zonedTimeToUtc(next, VENUE_TIMEZONE)

      return next;
    }

    if (schedule.scheduleType === 'weekly') {
      const daysOfWeek = schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [];
      if (daysOfWeek.length === 0) return null;

      const [hours, minutes] = schedule.executionTime.split(':').map(Number);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      // Get current time in venue timezone using Intl API
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VENUE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

      const currentYear = parseInt(getPart('year'));
      const currentMonth = parseInt(getPart('month')) - 1; // JS months are 0-indexed
      const currentDay = parseInt(getPart('day'));
      const currentHour = parseInt(getPart('hour'));
      const currentMinute = parseInt(getPart('minute'));

      // Create a date object representing current time in venue timezone
      const localNow = new Date(currentYear, currentMonth, currentDay, currentHour, currentMinute, 0, 0);
      const currentDayOfWeek = localNow.getDay();

      // Find next matching day
      for (let i = 0; i < 7; i++) {
        const checkDay = (currentDayOfWeek + i) % 7;
        const dayName = dayNames[checkDay];

        if (daysOfWeek.includes(dayName)) {
          // Create next execution time
          const next = new Date(localNow);
          next.setDate(next.getDate() + i);
          next.setHours(hours, minutes, 0, 0);

          if (next > localNow) {
            return next;
          }
        }
      }
    }

    return null;
  }

  /**
   * Clean up old games from the sports guide cache
   * Removes games that started more than 2 hours ago
   */
  private async cleanupOldGames() {
    try {
      logger.info('[SCHEDULER] 🧹 Running hourly cleanup of old games (started 2+ hours ago)');

      const response = await fetch(`http://localhost:${API_PORT}/api/sports-guide/cleanup-old`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hoursOld: 2 })
      });

      if (response.ok) {
        const result = await response.json();
        logger.info(`[SCHEDULER] ✅ Cleanup complete: ${result.removed || 0} old games removed`);
      } else {
        logger.warn('[SCHEDULER] ⚠️  Cleanup request failed');
      }
    } catch (error) {
      logger.error('[SCHEDULER] ❌ Error during cleanup:', { error });
    }
  }

  /**
   * Check for pending bartender-scheduled channel tunes and execute them
   * These are tunes scheduled by bartenders via the channel guide "Schedule" button
   */
  private async checkAndExecuteBartenderSchedules(now: Date) {
    const correlationId = schedulerLogger.generateCorrelationId();
    const startTime = Date.now();

    try {
      const nowUnix = Math.floor(now.getTime() / 1000);

      // Find pending allocations where allocatedAt <= now (time to tune)
      const pendingAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        inputSource: schema.inputSources,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.status, 'pending'))
      .all();

      // Filter to allocations that are due (allocatedAt <= now)
      const dueAllocations = pendingAllocations.filter(
        (r) => (r.allocation.allocatedAt || 0) <= nowUnix
      );

      if (dueAllocations.length === 0) {
        return;
      }

      await schedulerLogger.info(
        'scheduler-service',
        'check',
        `Found ${dueAllocations.length} pending bartender-scheduled tunes to execute`,
        correlationId,
        { metadata: { dueCount: dueAllocations.length } }
      );

      logger.info(`[SCHEDULER] 📺 Found ${dueAllocations.length} pending bartender-scheduled tunes to execute`);

      for (const { allocation, inputSource, game } of dueAllocations) {
        const tuneStartTime = Date.now();
        try {
          logger.info(`[SCHEDULER] 🎯 Checking if ready to tune: ${inputSource.name} to channel ${allocation.channelNumber} for ${game.homeTeamName} vs ${game.awayTeamName}`);

          // Check if there's a game currently on this input that's still in progress
          const currentGameStatus = await this.checkCurrentGameStatus(inputSource.id);

          if (currentGameStatus.gameInProgress) {
            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Delaying tune - current game still in progress: ${currentGameStatus.gameDescription}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: { status: currentGameStatus.status },
              }
            );

            logger.info(`[SCHEDULER] ⏳ Delaying tune - current game still in progress: ${currentGameStatus.gameDescription} (${currentGameStatus.status})`);
            // Skip this allocation for now, will check again next cycle
            continue;
          }

          logger.info(`[SCHEDULER] ✅ Ready to execute tune - no game in progress or game has ended`);

          // Call the channel tune API
          const response = await fetch(`http://localhost:${API_PORT}/api/channel-presets/tune`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType,
              // Pass the device ID based on type
              cableBoxId: allocation.inputSourceType === 'cable' ? inputSource.deviceId : undefined,
              directTVId: allocation.inputSourceType === 'directv' ? inputSource.deviceId : undefined,
              fireTVId: allocation.inputSourceType === 'firetv' ? inputSource.deviceId : undefined,
            })
          });

          const result = await response.json();
          const tuneDurationMs = Date.now() - tuneStartTime;

          if (result.success || response.ok) {
            // Update allocation status to 'active'
            await db.update(schema.inputSourceAllocations)
              .set({
                status: 'active',
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSourceAllocations.id, allocation.id));

            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Successfully tuned ${inputSource.name} to channel ${allocation.channelNumber}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                channelNumber: allocation.channelNumber,
                deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
                durationMs: tuneDurationMs,
              }
            );

            logger.info(`[SCHEDULER] ✅ Successfully tuned ${inputSource.name} to channel ${allocation.channelNumber}`);
          } else {
            await schedulerLogger.log({
              correlationId,
              component: 'scheduler-service',
              operation: 'tune',
              level: 'error',
              message: `Failed to tune ${inputSource.name}`,
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              success: false,
              durationMs: tuneDurationMs,
              errorMessage: result.error || result.message || 'Unknown error',
            });

            logger.error(`[SCHEDULER] ❌ Failed to tune ${inputSource.name}: ${result.error || result.message}`);
          }
        } catch (tuneError: any) {
          await schedulerLogger.error(
            'scheduler-service',
            'tune',
            `Error executing scheduled tune for ${inputSource.name}`,
            correlationId,
            tuneError,
            {
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              durationMs: Date.now() - tuneStartTime,
            }
          );

          logger.error(`[SCHEDULER] ❌ Error executing scheduled tune for ${inputSource.name}:`, { error: tuneError });
        }
      }

      await schedulerLogger.debug(
        'scheduler-service',
        'check',
        `Bartender schedule check complete - processed ${dueAllocations.length} allocations`,
        correlationId,
        { durationMs: Date.now() - startTime }
      );
    } catch (error: any) {
      await schedulerLogger.error(
        'scheduler-service',
        'check',
        'Error checking bartender schedules',
        correlationId,
        error,
        { durationMs: Date.now() - startTime }
      );

      logger.error('[SCHEDULER] ❌ Error checking bartender schedules:', { error });
    }
  }

  /**
   * Check if there's a game currently in progress on a given input source
   * Uses ESPN API to verify game status
   */
  private async checkCurrentGameStatus(inputSourceId: string): Promise<{
    gameInProgress: boolean;
    gameDescription?: string;
    status?: string;
  }> {
    try {
      // Find the currently active allocation for this input
      const activeAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.inputSourceId, inputSourceId))
      .all();

      // Filter for active allocations
      const activeAlloc = activeAllocations.find(a => a.allocation.status === 'active');

      if (!activeAlloc) {
        // No active game on this input
        return { gameInProgress: false };
      }

      const { game } = activeAlloc;
      const gameDescription = `${game.awayTeamName} @ ${game.homeTeamName}`;

      // Check ESPN API for live game status
      if (game.espnEventId && !game.espnEventId.startsWith('bartender-')) {
        try {
          const espnResponse = await fetch(`http://localhost:${API_PORT}/api/scheduling/live-status`);

          if (espnResponse.ok) {
            const liveData = await espnResponse.json();

            if (liveData.success && liveData.games) {
              // Find this specific game in live data
              const liveGame = liveData.games.find((g: any) =>
                g.espnGameId === game.espnEventId ||
                (g.homeTeam === game.homeTeamName && g.awayTeam === game.awayTeamName)
              );

              if (liveGame) {
                const status = liveGame.status?.toLowerCase() || '';
                const isInProgress = liveGame.isLive === true ||
                  status.includes('in progress') ||
                  status.includes('halftime') ||
                  status.includes('1st') ||
                  status.includes('2nd') ||
                  status.includes('3rd') ||
                  status.includes('4th') ||
                  status.includes('quarter') ||
                  status.includes('period') ||
                  status.includes('overtime');

                const isCompleted = status.includes('final') ||
                  status.includes('end') ||
                  status.includes('completed') ||
                  status.includes('postponed') ||
                  status.includes('cancelled');

                if (isCompleted) {
                  logger.info(`[SCHEDULER] Game ${gameDescription} has ended (${liveGame.status})`);

                  // Mark the allocation as completed
                  await db.update(schema.inputSourceAllocations)
                    .set({
                      status: 'completed',
                      actuallyFreedAt: Math.floor(Date.now() / 1000),
                      updatedAt: Math.floor(Date.now() / 1000),
                    })
                    .where(eq(schema.inputSourceAllocations.id, activeAlloc.allocation.id));

                  return { gameInProgress: false, gameDescription, status: liveGame.status };
                }

                if (isInProgress) {
                  return {
                    gameInProgress: true,
                    gameDescription,
                    status: liveGame.status || liveGame.timeRemaining
                  };
                }
              }
            }
          }
        } catch (espnError) {
          logger.warn(`[SCHEDULER] Could not fetch ESPN status for ${gameDescription}:`, { error: espnError });
        }
      }

      // Fallback: Check estimated end time
      const now = Math.floor(Date.now() / 1000);
      const estimatedEnd = game.estimatedEnd || 0;

      if (estimatedEnd > 0 && now >= estimatedEnd) {
        // Game should be over based on estimated time
        logger.info(`[SCHEDULER] Game ${gameDescription} should be over (estimated end passed)`);

        // Mark as completed
        await db.update(schema.inputSourceAllocations)
          .set({
            status: 'completed',
            actuallyFreedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.inputSourceAllocations.id, activeAlloc.allocation.id));

        return { gameInProgress: false, gameDescription, status: 'estimated_complete' };
      }

      // If scheduled start is in the past but we can't confirm status, assume it might still be on
      const scheduledStart = game.scheduledStart || 0;
      if (scheduledStart > 0 && now > scheduledStart && now < (estimatedEnd || scheduledStart + 4 * 3600)) {
        return {
          gameInProgress: true,
          gameDescription,
          status: 'assumed_in_progress'
        };
      }

      return { gameInProgress: false };
    } catch (error) {
      logger.error('[SCHEDULER] Error checking current game status:', { error });
      // On error, assume no game in progress to avoid blocking scheduled tunes
      return { gameInProgress: false };
    }
  }
}

// Export a singleton instance
export const schedulerService = new SchedulerService();
