import { getAutomatedHealthCheckService } from './automated-health-check'
import { getAISportsContextProvider } from '@/lib/ai-sports-context'
import { logger } from '@/lib/logger'

/**
 * Health Check Scheduler
 *
 * Automatically runs health checks:
 * - Daily at 8:00 AM
 * - 2 hours before major games
 */

export class HealthCheckScheduler {
  private dailyCheckInterval: NodeJS.Timeout | null = null
  private preGameCheckInterval: NodeJS.Timeout | null = null
  private isRunning = false

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('[Health Check Scheduler] Already running')
      return
    }

    logger.info('[Health Check Scheduler] Starting...')

    // Run daily check every hour (will check if it's 8 AM)
    this.dailyCheckInterval = setInterval(() => {
      this.checkForDailyRun()
    }, 60 * 60 * 1000) // Every hour

    // Check for pre-game checks every 30 minutes
    this.preGameCheckInterval = setInterval(() => {
      this.checkForPreGameRun()
    }, 30 * 60 * 1000) // Every 30 minutes

    this.isRunning = true

    // Run initial checks after a short delay
    setTimeout(() => {
      this.checkForDailyRun()
      this.checkForPreGameRun()
    }, 5000)

    logger.info('[Health Check Scheduler] Started successfully')
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval)
      this.dailyCheckInterval = null
    }

    if (this.preGameCheckInterval) {
      clearInterval(this.preGameCheckInterval)
      this.preGameCheckInterval = null
    }

    this.isRunning = false
    logger.info('[Health Check Scheduler] Stopped')
  }

  /**
   * Check if it's time for daily health check (8 AM)
   */
  private async checkForDailyRun() {
    const now = new Date()
    const hour = now.getHours()

    // Run if it's 8 AM
    if (hour === 8) {
      // Check if we've already run today
      const lastRun = await this.getLastDailyCheck()
      if (lastRun) {
        const lastRunDate = new Date(lastRun)
        const isSameDay = lastRunDate.toDateString() === now.toDateString()

        if (isSameDay) {
          logger.debug('[Health Check Scheduler] Daily check already ran today')
          return
        }
      }

      logger.info('[Health Check Scheduler] Running daily health check')
      await this.runDailyCheck()
    }
  }

  /**
   * Check if we need to run pre-game health checks
   */
  private async checkForPreGameRun() {
    try {
      const provider = getAISportsContextProvider()
      const context = await provider.getSportsContext()

      // Find games starting in next 2-3 hours that haven't had pre-game check
      for (const game of context.upcomingGames) {
        // Check if game is 2-3 hours away
        if (game.hoursUntilGame >= 1.5 && game.hoursUntilGame <= 3) {
          // Only check high importance or critical games
          if (game.importance === 'high' || game.importance === 'critical') {
            // Check if we've already done pre-game check for this game
            const hasCheck = await this.hasPreGameCheck(game.eventName)

            if (!hasCheck) {
              logger.info(`[Health Check Scheduler] Running pre-game check for: ${game.eventName}`)
              await this.runPreGameCheck(game.eventName)

              // Mark this game as checked
              await this.markPreGameCheckDone(game.eventName)
            }
          }
        }
      }
    } catch (error) {
      logger.error('[Health Check Scheduler] Error checking for pre-game runs:', error)
    }
  }

  /**
   * Run daily health check
   */
  private async runDailyCheck() {
    try {
      const service = getAutomatedHealthCheckService()
      const result = await service.runHealthCheck('daily')
      const report = service.formatReport(result)

      // Log the report
      logger.info('[Health Check Scheduler] Daily check complete')
      logger.info('\n' + report)

      // Store last daily check time
      await this.storeLastDailyCheck()

      // TODO: Send email/SMS notification if configured
    } catch (error) {
      logger.error('[Health Check Scheduler] Daily check failed:', error)
    }
  }

  /**
   * Run pre-game health check
   */
  private async runPreGameCheck(gameName: string) {
    try {
      const service = getAutomatedHealthCheckService()
      const result = await service.runHealthCheck('pre_game')
      const report = service.formatReport(result)

      // Log the report
      logger.info(`[Health Check Scheduler] Pre-game check for: ${gameName}`)
      logger.info('\n' + report)

      // Alert if there are issues
      if (result.overallStatus !== 'healthy') {
        logger.warn(`[Health Check Scheduler] ⚠️ ISSUES DETECTED before ${gameName}!`)
        // TODO: Send urgent notification
      }
    } catch (error) {
      logger.error('[Health Check Scheduler] Pre-game check failed:', error)
    }
  }

  /**
   * Get last daily check timestamp
   */
  private async getLastDailyCheck(): Promise<string | null> {
    try {
      const { findFirst, eq, schema } = await import('@/lib/db-helpers')

      const setting = await findFirst('systemSettings', {
        where: eq(schema.systemSettings.key, 'last_daily_health_check')
      })

      return setting?.value || null
    } catch (error) {
      return null
    }
  }

  /**
   * Store last daily check timestamp
   */
  private async storeLastDailyCheck() {
    try {
      const { findFirst, insert, update, eq, schema } = await import('@/lib/db-helpers')

      const existing = await findFirst('systemSettings', {
        where: eq(schema.systemSettings.key, 'last_daily_health_check')
      })

      const now = new Date().toISOString()

      if (existing) {
        await update(
          'systemSettings',
          eq(schema.systemSettings.id, existing.id),
          { value: now, updatedAt: now }
        )
      } else {
        await insert('systemSettings', {
          id: crypto.randomUUID(),
          key: 'last_daily_health_check',
          value: now,
          createdAt: now,
          updatedAt: now
        })
      }
    } catch (error) {
      logger.error('[Health Check Scheduler] Failed to store last check time:', error)
    }
  }

  /**
   * Check if pre-game check was done for this game
   */
  private async hasPreGameCheck(gameName: string): Promise<boolean> {
    try {
      const { findFirst, eq, schema } = await import('@/lib/db-helpers')

      const key = `pre_game_check_${gameName.replace(/[^a-zA-Z0-9]/g, '_')}`

      const setting = await findFirst('systemSettings', {
        where: eq(schema.systemSettings.key, key)
      })

      if (!setting) return false

      // Check if it was done today
      const checkTime = new Date(setting.value)
      const now = new Date()

      return checkTime.toDateString() === now.toDateString()
    } catch (error) {
      return false
    }
  }

  /**
   * Mark pre-game check as done
   */
  private async markPreGameCheckDone(gameName: string) {
    try {
      const { findFirst, insert, update, eq, schema } = await import('@/lib/db-helpers')

      const key = `pre_game_check_${gameName.replace(/[^a-zA-Z0-9]/g, '_')}`
      const existing = await findFirst('systemSettings', {
        where: eq(schema.systemSettings.key, key)
      })

      const now = new Date().toISOString()

      if (existing) {
        await update(
          'systemSettings',
          eq(schema.systemSettings.id, existing.id),
          { value: now, updatedAt: now }
        )
      } else {
        await insert('systemSettings', {
          id: crypto.randomUUID(),
          key,
          value: now,
          createdAt: now,
          updatedAt: now
        })
      }
    } catch (error) {
      logger.error('[Health Check Scheduler] Failed to mark pre-game check:', error)
    }
  }
}

// Singleton instance
let scheduler: HealthCheckScheduler | null = null

export function getHealthCheckScheduler(): HealthCheckScheduler {
  if (!scheduler) {
    scheduler = new HealthCheckScheduler()
  }
  return scheduler
}

/**
 * Start the scheduler (call this on server startup)
 */
export function startHealthCheckScheduler() {
  const scheduler = getHealthCheckScheduler()
  scheduler.start()
}
