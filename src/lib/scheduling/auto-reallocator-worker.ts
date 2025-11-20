/**
 * Auto-Reallocator Background Worker
 * Runs periodic checks (every 5 minutes) to free ended games
 */

import { autoReallocator } from './auto-reallocator';
import { logger } from '@/lib/logger';

class AutoReallocatorWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 5 * 60 * 1000; // 5 minutes
  private lastCheckTime: number | null = null;
  private totalChecks = 0;

  /**
   * Start the background worker
   */
  start() {
    if (this.isRunning) {
      logger.debug('[AUTO-REALLOCATOR-WORKER] Worker is already running');
      return;
    }

    logger.info('[AUTO-REALLOCATOR-WORKER] Starting auto-reallocator worker (5 minute interval)');
    this.isRunning = true;

    // Clear existing interval if any to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check every 5 minutes
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.checkIntervalMs);

    // Also check immediately on start
    this.performCheck();
  }

  /**
   * Stop the background worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[AUTO-REALLOCATOR-WORKER] Worker stopped');
  }

  /**
   * Perform a reallocation check
   */
  private async performCheck() {
    try {
      const startTime = Date.now();
      this.lastCheckTime = Math.floor(startTime / 1000);
      this.totalChecks++;

      logger.debug(`[AUTO-REALLOCATOR-WORKER] Starting check #${this.totalChecks}`);

      const stats = await autoReallocator.performReallocationCheck();

      const duration = Date.now() - startTime;

      logger.info(
        `[AUTO-REALLOCATOR-WORKER] Check #${this.totalChecks} complete in ${duration}ms: ` +
        `${stats.allocationsCompleted} ended, ${stats.inputSourcesFreed} freed, ` +
        `${stats.pendingAllocationsTriggered} activated, ${stats.errors} errors`
      );
    } catch (error: any) {
      logger.error('[AUTO-REALLOCATOR-WORKER] Error during periodic check:', error);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      totalChecks: this.totalChecks,
      checkIntervalMs: this.checkIntervalMs,
      nextCheckIn: this.isRunning && this.lastCheckTime
        ? Math.max(0, this.checkIntervalMs - (Date.now() - this.lastCheckTime * 1000))
        : null,
    };
  }

  /**
   * Update check interval
   */
  setCheckInterval(minutes: number) {
    if (minutes < 1 || minutes > 60) {
      throw new Error('Check interval must be between 1 and 60 minutes');
    }

    this.checkIntervalMs = minutes * 60 * 1000;
    logger.info(`[AUTO-REALLOCATOR-WORKER] Check interval updated to ${minutes} minutes`);

    // Restart worker with new interval if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Export singleton instance
export const autoReallocatorWorker = new AutoReallocatorWorker();
