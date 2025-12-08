import { logger } from '@/lib/logger'

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
  }
}
