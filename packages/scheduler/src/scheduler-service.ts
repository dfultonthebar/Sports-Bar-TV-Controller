/**
 * Background Scheduler Service
 *
 * This service runs in the background and executes schedules at their specified times.
 * It checks every minute for schedules that need to be executed.
 */

import { db, schema, eq, findMany } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

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

    logger.debug('Starting scheduler service...');
    this.isRunning = true;

    // Clear existing interval if any to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check every minute for schedules to execute
    this.intervalId = setInterval(() => {
      this.checkAndExecuteSchedules();
    }, 60000); // 60 seconds

    // Also check immediately on start
    this.checkAndExecuteSchedules();
  }

  /**
   * Stop the scheduler service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.debug('Scheduler service stopped');
  }

  /**
   * Check for schedules that need to be executed and execute them
   */
  private async checkAndExecuteSchedules() {
    try {
      const now = new Date();

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
}

// Export a singleton instance
export const schedulerService = new SchedulerService();
