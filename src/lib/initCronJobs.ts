
import { initializePresetCronJob } from '@/services/presetCronService'
import { schedulerService } from '@/lib/scheduler-service'
import { logger } from '@/lib/logger'
let initialized = false

/**
 * Initialize all cron jobs for the application
 * This should be called once when the app starts
 */
export function initializeCronJobs() {
  if (initialized) {
    logger.info('[Cron Init] Cron jobs already initialized')
    return
  }

  try {
    logger.info('[Cron Init] Initializing cron jobs...')

    // Initialize preset reordering cron job
    initializePresetCronJob()

    // Initialize AI-powered scheduler service for continuous game monitoring
    logger.info('[Cron Init] Starting AI scheduler service...')
    schedulerService.start()
    logger.info('[Cron Init] AI scheduler service started - monitoring for continuous schedules')

    initialized = true
    logger.info('[Cron Init] All cron jobs initialized successfully')
  } catch (error) {
    logger.error('[Cron Init] Error initializing cron jobs:', error)
  }
}

// Auto-initialize on module load (for server-side)
if (typeof window === 'undefined') {
  initializeCronJobs()
}
