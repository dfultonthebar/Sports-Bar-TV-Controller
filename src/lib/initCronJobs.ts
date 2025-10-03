
import { initializePresetCronJob } from '@/services/presetCronService'

let initialized = false

/**
 * Initialize all cron jobs for the application
 * This should be called once when the app starts
 */
export function initializeCronJobs() {
  if (initialized) {
    console.log('[Cron Init] Cron jobs already initialized')
    return
  }

  try {
    console.log('[Cron Init] Initializing cron jobs...')
    
    // Initialize preset reordering cron job
    initializePresetCronJob()
    
    initialized = true
    console.log('[Cron Init] All cron jobs initialized successfully')
  } catch (error) {
    console.error('[Cron Init] Error initializing cron jobs:', error)
  }
}

// Auto-initialize on module load (for server-side)
if (typeof window === 'undefined') {
  initializeCronJobs()
}
