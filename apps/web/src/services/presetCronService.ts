import cron, { ScheduledTask } from 'node-cron'
import { reorderAllPresets } from './presetReorderService'

import { logger } from '@sports-bar/logger'
let cronJob: ScheduledTask | null = null

/**
 * Initialize the monthly preset reordering cron job
 * Runs on the 1st day of every month at 3:00 AM
 */
export function initializePresetCronJob() {
  if (cronJob) {
    logger.info('[Preset Cron] Cron job already initialized')
    return
  }

  // Schedule: Run at 3:00 AM on the 1st day of every month
  // Cron format: minute hour day-of-month month day-of-week
  // '0 3 1 * *' = At 03:00 on day-of-month 1
  cronJob = cron.schedule('0 3 1 * *', async () => {
    logger.info('[Preset Cron] Running monthly preset reordering...')
    try {
      const result = await reorderAllPresets()
      logger.info('[Preset Cron] Monthly reordering completed:', { data: result })
    } catch (error) {
      logger.error('[Preset Cron] Error during monthly reordering:', error)
    }
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  })

  logger.info('[Preset Cron] Monthly preset reordering cron job initialized (runs at 3:00 AM on 1st of each month)')
}

/**
 * Stop the cron job (useful for testing or shutdown)
 */
export function stopPresetCronJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    logger.info('[Preset Cron] Cron job stopped')
  }
}

/**
 * Manually trigger the reordering (for testing)
 */
export async function triggerManualReorder() {
  logger.info('[Preset Cron] Manual reordering triggered')
  try {
    const result = await reorderAllPresets()
    logger.info('[Preset Cron] Manual reordering completed:', { data: result })
    return result
  } catch (error) {
    logger.error('[Preset Cron] Error during manual reordering:', error)
    throw error
  }
}
