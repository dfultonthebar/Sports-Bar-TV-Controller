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
  private tvStatusIntervalId: NodeJS.Timeout | null = null;
  private fastPollIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private hasDelayedGames = false;
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

    // On startup, flag any missed bartender-scheduled tunes for confirmation FIRST,
    // then start the regular check cycle. This prevents a race condition where
    // checkAndExecuteBartenderSchedules could pick up past-due pending allocations
    // and auto-tune them before flagMissedBartenderSchedules can flag them for confirmation.
    this.flagMissedBartenderSchedules().then(() => {
      // Only start the regular schedule checks after missed schedules are flagged
      // Check every minute for schedules to execute
      this.intervalId = setInterval(() => {
        this.checkAndExecuteSchedules();
      }, 60000); // 60 seconds

      // Also check immediately now that missed schedules have been flagged
      this.checkAndExecuteSchedules();

      logger.info('[SCHEDULER] Regular schedule checks started (after missed-schedule flagging)');
    }).catch((error) => {
      // Even if flagging fails, start the regular checks so the scheduler isn't dead
      logger.error('[SCHEDULER] Error flagging missed schedules, starting checks anyway:', { error });
      this.intervalId = setInterval(() => {
        this.checkAndExecuteSchedules();
      }, 60000);
      this.checkAndExecuteSchedules();
    });

    // Poll TV status every 5 minutes
    if (this.tvStatusIntervalId) {
      clearInterval(this.tvStatusIntervalId);
    }
    this.tvStatusIntervalId = setInterval(() => {
      this.pollTVStatus();
    }, 300000); // 5 minutes
    // Run first poll after 30 seconds (let app fully start)
    setTimeout(() => this.pollTVStatus(), 30000);

    schedulerLogger.info(
      'scheduler-service',
      'startup',
      'Scheduler service started successfully',
      correlationId
    );
  }

  /**
   * Flag missed bartender-scheduled tunes for confirmation instead of auto-recovering.
   * Sets status to 'needs_confirmation' so the bartender remote can show a popup
   * asking whether to resume these schedules.
   */
  private async flagMissedBartenderSchedules() {
    const correlationId = schedulerLogger.generateCorrelationId();

    try {
      const nowUnix = Math.floor(Date.now() / 1000);

      logger.info('[SCHEDULER] 🔄 Checking for missed bartender-scheduled tunes after startup...');

      // Find pending bartender allocations that are past due
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

      const missedAllocations = pendingAllocations.filter((r) => {
        if (r.allocation.scheduledBy !== 'bartender') return false;
        // Only flag allocations whose scheduled time has passed (overdue)
        if ((r.allocation.allocatedAt || 0) > nowUnix) return false;
        // Skip allocations where the game is already over (estimatedEnd + 30 min buffer)
        const estimatedEnd = r.game.estimatedEnd || 0;
        if (estimatedEnd > 0) {
          const gameEndBuffer = estimatedEnd + 30 * 60;
          if (nowUnix > gameEndBuffer) return false;
        }
        return true;
      });

      if (missedAllocations.length === 0) {
        logger.info('[SCHEDULER] ✅ No missed bartender-scheduled tunes');
        await schedulerLogger.info('scheduler-service', 'recover', 'No missed bartender-scheduled tunes to recover', correlationId);
        return;
      }

      // Flag them as needs_confirmation instead of auto-tuning
      for (const { allocation, inputSource, game } of missedAllocations) {
        await db.update(schema.inputSourceAllocations)
          .set({ status: 'needs_confirmation', updatedAt: nowUnix })
          .where(eq(schema.inputSourceAllocations.id, allocation.id));

        logger.info(`[SCHEDULER] 🔔 Flagged for confirmation: ${inputSource.name} → ch ${allocation.channelNumber} (${game.homeTeamName} vs ${game.awayTeamName})`);
      }

      await schedulerLogger.info(
        'scheduler-service', 'recover',
        `Flagged ${missedAllocations.length} missed schedules for bartender confirmation`,
        correlationId
      );
    } catch (error: any) {
      logger.error('[SCHEDULER] ❌ Error flagging missed schedules:', { error });
    }
  }

  /**
   * Poll all TV statuses via the status check API
   * Runs every 5 minutes to keep the bartender remote's TV status accurate
   * Also pings the VAVA projector to prevent deep sleep
   */
  private async pollTVStatus() {
    try {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/tv-discovery/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        logger.debug(`[TV-POLL] Status check: ${data.online}/${data.count} TVs online`);
      }
    } catch (error) {
      logger.debug('[TV-POLL] Status check failed (app may still be starting)');
    }

    // Keep VAVA projector alive - send a harmless volume query to prevent deep sleep
    // VAVA shuts down all network services when it sleeps, making it uncontrollable
    try {
      const vavaDevices = await db.select()
        .from(schema.networkTVDevices)
        .where(eq(schema.networkTVDevices.brand, 'VAVA'))
        .all();

      for (const vava of vavaDevices) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          await fetch(`http://${vava.ipAddress}:${vava.port || 8000}/remote/get_volume`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          logger.debug(`[TV-POLL] VAVA keep-alive ping sent to ${vava.ipAddress}`);
        } catch {
          // VAVA may already be in deep sleep — nothing we can do
        }
      }
    } catch {
      // Ignore errors
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
    if (this.tvStatusIntervalId) {
      clearInterval(this.tvStatusIntervalId);
      this.tvStatusIntervalId = null;
    }
    if (this.fastPollIntervalId) {
      clearInterval(this.fastPollIntervalId);
      this.fastPollIntervalId = null;
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

      // Reset delayed flag — will be set again if any games are still delayed
      this.hasDelayedGames = false;

      // Check for pending bartender-scheduled channel tunes
      await this.checkAndExecuteBartenderSchedules(now);

      // Manage fast polling: when games are delayed, check every 15s instead of 60s
      if (this.hasDelayedGames && !this.fastPollIntervalId) {
        logger.info('[SCHEDULER] 🔄 Enabling fast polling (15s) — games are delayed');
        this.fastPollIntervalId = setInterval(() => {
          this.checkAndExecuteBartenderSchedules(new Date());
        }, 15000);
      } else if (!this.hasDelayedGames && this.fastPollIntervalId) {
        logger.info('[SCHEDULER] ✅ Disabling fast polling — no more delayed games');
        clearInterval(this.fastPollIntervalId);
        this.fastPollIntervalId = null;
      }

      // Hourly tasks
      if (!this.lastCleanup || (now.getTime() - this.lastCleanup.getTime()) >= 3600000) {
        // Cleanup: Remove games that started 2+ hours ago
        this.cleanupOldGames();

        // Run pattern analysis on scheduling history (learns from bartender TV routing)
        try {
          const { patternAnalyzer } = await import('./pattern-analyzer');
          patternAnalyzer.analyzeAll().then(result => {
            logger.info(`[SCHEDULER] Pattern analysis: ${result.teamRouting?.length || 0} team, ${result.leaguePriority?.length || 0} league, ${result.timeSlot?.length || 0} timeslot patterns`);
          }).catch(() => {});
        } catch {}

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
        // "No TVs to control" is a benign condition: the AI Game Monitor
        // fires every 5 minutes by design, and most of the time there is
        // no active allocation to act on. Don't spam WARN for this — real
        // problems are easier to spot without 288 benign entries per day.
        const msg = result.result?.message;
        if (msg === 'No TVs to control') {
          logger.debug(`[SCHEDULER] Schedule tick: no active TV allocations (${duration}ms)`);
        } else {
          logger.warn(`[SCHEDULER] ⚠️  Schedule execution completed with issues (${duration}ms): ${msg}`);
        }
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

      // Filter to allocations that are due (5-minute early buffer: allocatedAt - 300 <= now)
      const EARLY_BUFFER_SECONDS = 300; // 5 minutes before scheduled time
      const MAX_DELAY_SECONDS = 1800; // 30 minutes max delay for live game protection

      const dueAllocations = pendingAllocations.filter(
        (r) => ((r.allocation.allocatedAt || 0) - EARLY_BUFFER_SECONDS) <= nowUnix
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

          // Check if there's a scheduled game currently on this input that's still in progress
          const currentGameStatus = await this.checkCurrentGameStatus(inputSource.id);
          const timePastScheduled = nowUnix - (allocation.allocatedAt || 0);
          const forceOverride = timePastScheduled >= MAX_DELAY_SECONDS;

          if (currentGameStatus.gameInProgress && !forceOverride) {
            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Delaying tune - scheduled game still in progress: ${currentGameStatus.gameDescription} (${Math.round(timePastScheduled / 60)}min past scheduled)`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: { status: currentGameStatus.status, timePastScheduled },
              }
            );

            logger.info(`[SCHEDULER] ⏳ Delaying tune - scheduled game still in progress: ${currentGameStatus.gameDescription} (${currentGameStatus.status}) - ${Math.round(timePastScheduled / 60)}min past scheduled`);

            // Enable fast polling (every 15s) while games are delayed
            this.hasDelayedGames = true;

            // Skip this allocation for now, will check again next cycle
            continue;
          }

          if (currentGameStatus.gameInProgress && forceOverride) {
            logger.info(`[SCHEDULER] ⚠️ Force-tuning after ${MAX_DELAY_SECONDS / 60}min delay - overriding active game: ${currentGameStatus.gameDescription}`);
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

            // Mirror the active state onto the input_sources row so the
            // scheduler UI (which reads currentlyAllocated / currentChannel)
            // shows the game against the correct cable box / fire TV. Prior
            // to v2.18.0 only the auto-reallocator did this, but it only
            // fires on still-pending allocations — once scheduler-service
            // flipped to 'active' first, the source row never got updated
            // and the UI showed "no game" on that box until restart.
            await db.update(schema.inputSources)
              .set({
                currentlyAllocated: true,
                currentChannel: allocation.channelNumber,
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSources.id, inputSource.id));

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

            // Route matrix inputs to TV outputs if tvOutputIds is set
            if (allocation.tvOutputIds && inputSource.matrixInputId) {
              try {
                const outputIds: number[] = JSON.parse(allocation.tvOutputIds);
                const matrixInput = parseInt(inputSource.matrixInputId, 10);

                if (outputIds.length > 0 && !isNaN(matrixInput)) {
                  // Check for conflicting active allocations that claim the same outputs
                  const otherActiveAllocations = await db.select()
                    .from(schema.inputSourceAllocations)
                    .where(eq(schema.inputSourceAllocations.status, 'active'))
                    .all();

                  const claimedOutputs = new Set<number>();
                  for (const other of otherActiveAllocations) {
                    if (other.id === allocation.id) continue; // Skip self
                    if (other.tvOutputIds) {
                      try {
                        const otherOutputs: number[] = JSON.parse(other.tvOutputIds);
                        otherOutputs.forEach(o => claimedOutputs.add(o));
                      } catch {}
                    }
                  }

                  // Filter out outputs already claimed by other active games
                  const safeOutputs = outputIds.filter(o => !claimedOutputs.has(o));
                  const skippedOutputs = outputIds.filter(o => claimedOutputs.has(o));

                  if (skippedOutputs.length > 0) {
                    logger.info(`[SCHEDULER] ⚠️ Skipping outputs [${skippedOutputs.join(', ')}] — already claimed by another active game`);
                  }

                  logger.info(`[SCHEDULER] 🔀 Routing matrix input ${matrixInput} to ${safeOutputs.length} TV outputs: [${safeOutputs.join(', ')}]${skippedOutputs.length > 0 ? ` (skipped ${skippedOutputs.length} conflicting)` : ''}`);

                  for (const outputNumber of safeOutputs) {
                    try {
                      const routeResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          input: matrixInput,
                          output: outputNumber,
                        }),
                      });

                      if (routeResponse.ok) {
                        logger.info(`[SCHEDULER] ✅ Routed matrix input ${matrixInput} → output ${outputNumber}`);
                      } else {
                        const routeResult = await routeResponse.json().catch(() => ({}));
                        logger.error(`[SCHEDULER] ❌ Failed to route matrix input ${matrixInput} → output ${outputNumber}: ${routeResult.error || routeResponse.statusText}`);
                      }
                    } catch (routeError: any) {
                      logger.error(`[SCHEDULER] ❌ Error routing matrix input ${matrixInput} → output ${outputNumber}:`, { error: routeError });
                    }
                  }

                  await schedulerLogger.info(
                    'scheduler-service',
                    'tune',
                    `Matrix routing complete: input ${matrixInput} → outputs [${outputIds.join(', ')}]`,
                    correlationId,
                    {
                      gameId: game.id,
                      inputSourceId: inputSource.id,
                      allocationId: allocation.id,
                      metadata: { matrixInput, outputIds },
                    }
                  );
                }
              } catch (parseError: any) {
                logger.error(`[SCHEDULER] ❌ Error parsing tvOutputIds for allocation ${allocation.id}:`, { error: parseError, tvOutputIds: allocation.tvOutputIds });
              }
            }

            // Switch audio zones if audio source is configured
            if (allocation.audioSourceIndex != null && allocation.audioZoneIds) {
              try {
                const audioZones: number[] = JSON.parse(allocation.audioZoneIds);
                if (audioZones.length > 0) {
                  // Look up the active audio processor from the database instead of hardcoding an ID
                  const processor = await db.select().from(schema.audioProcessors).get();
                  if (!processor) {
                    logger.error('[SCHEDULER] ❌ No audio processor found in database — skipping audio zone switching');
                  } else {
                    logger.info(`[SCHEDULER] 🔊 Switching ${audioZones.length} audio zone(s) to source ${allocation.audioSourceIndex}${allocation.audioSourceName ? ` (${allocation.audioSourceName})` : ''}`);

                    for (const zoneNumber of audioZones) {
                      try {
                        const audioResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/audio-processor/control`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            processorId: processor.id,
                            command: {
                              action: 'source',
                              zone: zoneNumber + 1,
                              value: allocation.audioSourceIndex,
                            },
                          }),
                        });

                        if (audioResponse.ok) {
                          logger.info(`[SCHEDULER] ✅ Audio zone ${zoneNumber} → source ${allocation.audioSourceIndex}`);
                        } else {
                          const audioResult = await audioResponse.json().catch(() => ({}));
                          logger.error(`[SCHEDULER] ❌ Failed to switch audio zone ${zoneNumber}: ${(audioResult as any).error || audioResponse.statusText}`);
                        }
                      } catch (audioError: any) {
                        logger.error(`[SCHEDULER] ❌ Error switching audio zone ${zoneNumber}:`, { error: audioError });
                      }
                    }

                    await schedulerLogger.info(
                      'scheduler-service',
                      'tune',
                      `Audio zone switching complete: zones [${audioZones.join(', ')}] → source ${allocation.audioSourceIndex}`,
                      correlationId,
                      {
                        gameId: game.id,
                        inputSourceId: inputSource.id,
                        allocationId: allocation.id,
                        metadata: { audioSourceIndex: allocation.audioSourceIndex, audioZones },
                      }
                    );
                  }
                }
              } catch (audioParseError: any) {
                logger.error(`[SCHEDULER] ❌ Error parsing audioZoneIds for allocation ${allocation.id}:`, { error: audioParseError, audioZoneIds: allocation.audioZoneIds });
              }
            }
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
