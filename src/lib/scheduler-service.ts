
/**
 * Background Scheduler Service
 * 
 * This service runs in the background and executes schedules at their specified times.
 * It checks every minute for schedules that need to be executed.
 */

import { and, asc, desc, eq, findMany, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger';

// Using singleton prisma from @/lib/prisma;

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

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
      
      // Get all enabled schedules
      const schedules = await prisma.schedule.findMany({
        where: { enabled: true }
      });

      for (const schedule of schedules) {
        const nextExecution = this.calculateNextExecution(schedule);
        
        if (!nextExecution) continue;

        // Check if it's time to execute (within the last minute)
        const timeDiff = now.getTime() - nextExecution.getTime();
        const shouldExecute = timeDiff >= 0 && timeDiff < 60000;

        if (shouldExecute) {
          logger.debug(`Executing schedule: ${schedule.name} (${schedule.id})`);
          
          // Execute schedule asynchronously
          this.executeSchedule(schedule.id).catch(error => {
            logger.error(`Error executing schedule ${schedule.name}:`, error);
          });
        }
      }
    } catch (error) {
      logger.error('Error checking schedules:', error);
    }
  }

  /**
   * Execute a schedule by calling the API endpoint
   */
  private async executeSchedule(scheduleId: string) {
    try {
      const response = await fetch('http://localhost:3000/api/schedules/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId })
      });

      const result = await response.json();
      
      if (result.result?.success) {
        logger.debug(`Schedule executed successfully: ${scheduleId}`);
      } else {
        logger.error(`Schedule execution had issues: ${scheduleId}`, result.result?.message);
      }
    } catch (error) {
      logger.error(`Failed to execute schedule: ${scheduleId}`, error);
    }
  }

  /**
   * Calculate the next execution time for a schedule
   */
  private calculateNextExecution(schedule: any): Date | null {
    if (!schedule.enabled || !schedule.executionTime) {
      return null;
    }

    const now = new Date();
    
    if (schedule.scheduleType === 'once') {
      const once = new Date(schedule.executionTime);
      return once > now ? once : null;
    }

    if (schedule.scheduleType === 'daily') {
      const [hours, minutes] = schedule.executionTime.split(':').map(Number);
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    }

    if (schedule.scheduleType === 'weekly') {
      const daysOfWeek = schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [];
      if (daysOfWeek.length === 0) return null;
      
      const [hours, minutes] = schedule.executionTime.split(':').map(Number);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = now.getDay();
      
      // Find next matching day
      for (let i = 0; i < 7; i++) {
        const checkDay = (currentDay + i) % 7;
        const dayName = dayNames[checkDay];
        
        if (daysOfWeek.includes(dayName)) {
          const next = new Date();
          next.setDate(next.getDate() + i);
          next.setHours(hours, minutes, 0, 0);
          
          if (next > now) {
            return next;
          }
        }
      }
    }

    return null;
  }
}

// Export a singleton instance
export const schedulerService = new SchedulerService();
