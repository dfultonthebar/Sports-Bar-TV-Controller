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
    logger.info('[INSTRUMENTATION] Initializing Fire TV services...')

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
  }
}
