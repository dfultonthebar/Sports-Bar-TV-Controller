import cron, { ScheduledTask } from 'node-cron'
import { reorderAllPresets } from './presetReorderService'
import { syncPresetsFromGuide } from '@/lib/sports-guide-channel-sync'

import { logger } from '@sports-bar/logger'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
let cronJob: ScheduledTask | null = null
let syncCronJob: ScheduledTask | null = null

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
    timezone: HARDWARE_CONFIG.venue.timezone
  })

  logger.info('[Preset Cron] Monthly preset reordering cron job initialized (runs at 3:00 AM on 1st of each month)')
}

/**
 * Initialize the daily channel sync from Rail Media Sports Guide API.
 * Runs every day at 4:00 AM Central.
 */
export function initializeChannelSyncCronJob() {
  if (syncCronJob) {
    logger.info('[Channel Sync Cron] Cron job already initialized')
    return
  }

  syncCronJob = cron.schedule('0 4 * * *', async () => {
    logger.info('[Channel Sync Cron] Running daily channel preset sync from Sports Guide...')
    try {
      const result = await syncPresetsFromGuide()
      logger.info('[Channel Sync Cron] Daily sync completed:', {
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
      })
    } catch (error) {
      logger.error('[Channel Sync Cron] Error during daily sync:', error)
    }
  }, {
    timezone: HARDWARE_CONFIG.venue.timezone
  })

  logger.info('[Channel Sync Cron] Daily channel sync initialized (runs at 4:00 AM Central)')
}

/**
 * Stop all cron jobs
 */
export function stopPresetCronJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    logger.info('[Preset Cron] Cron job stopped')
  }
  if (syncCronJob) {
    syncCronJob.stop()
    syncCronJob = null
    logger.info('[Channel Sync Cron] Cron job stopped')
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
