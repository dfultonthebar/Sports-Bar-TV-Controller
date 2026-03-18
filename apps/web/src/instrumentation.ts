import { logger } from '@sports-bar/logger'

/**
 * Next.js Instrumentation File
 * 
 * This file runs once when the Next.js server starts.
 * Use it to initialize services that should run continuously.
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [INSTRUMENTATION] Initializing services...')
    logger.info('[INSTRUMENTATION] Initializing services...')

    try {
      // Import health monitor singleton
      const { healthMonitor } = await import('./services/firetv-health-monitor')

      // Explicitly start the health monitor
      // (Previously had auto-start code in module which caused duplicate instances)
      await healthMonitor.start()

      logger.info('[INSTRUMENTATION] Fire TV health monitor started successfully')
    } catch (error) {
      logger.error('[INSTRUMENTATION] Failed to initialize Fire TV services:', error)
    }

    try {
      // Import auto-reallocator worker
      const { autoReallocatorWorker } = await import('./lib/scheduling/auto-reallocator-worker')

      // Start the auto-reallocator worker
      autoReallocatorWorker.start()

      logger.info('[INSTRUMENTATION] Auto-reallocator worker started successfully')
    } catch (error) {
      logger.error('[INSTRUMENTATION] Failed to initialize auto-reallocator worker:', error)
    }

    try {
      // Import and start the scheduler service for continuous game monitoring
      const { schedulerService } = await import('./lib/scheduler-service')

      // Start the scheduler service (checks every minute for schedules to execute)
      schedulerService.start()

      logger.info('[INSTRUMENTATION] ✅ Scheduler service started - monitoring for continuous schedules every 60 seconds')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize scheduler service:', error)
    }

    try {
      // Initialize cron jobs: monthly preset reorder + daily channel sync from Rail Media
      const { initializePresetCronJob, initializeChannelSyncCronJob } = await import('./services/presetCronService')
      initializePresetCronJob()
      initializeChannelSyncCronJob()

      logger.info('[INSTRUMENTATION] ✅ Cron jobs initialized (preset reorder + channel sync)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize cron jobs:', error)
    }

    try {
      // Initialize Wolf Pack AI learning cycle (every 6 hours)
      const { runLearningCycle } = await import('@sports-bar/wolfpack')

      // Run initial cycle after 60s warm-up delay
      setTimeout(() => {
        runLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Initial learning cycle failed:', err)
        })
      }, 60_000)

      // Schedule recurring cycle every 6 hours
      setInterval(() => {
        runLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Learning cycle failed:', err)
        })
      }, 6 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ Wolf Pack AI learning cycle initialized (every 6 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize Wolf Pack learning cycle:', error)
    }

    try {
      // Initialize Atlas Audio AI learning cycle (every 6 hours, staggered 90s after wolfpack)
      const { runAtlasLearningCycle } = await import('@sports-bar/atlas')

      // Run initial cycle after 90s warm-up delay (staggered from wolfpack's 60s)
      setTimeout(() => {
        runAtlasLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Initial Atlas learning cycle failed:', err)
        })
      }, 90_000)

      // Schedule recurring cycle every 6 hours
      setInterval(() => {
        runAtlasLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Atlas learning cycle failed:', err)
        })
      }, 6 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ Atlas Audio AI learning cycle initialized (every 6 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize Atlas learning cycle:', error)
    }
  }
}
