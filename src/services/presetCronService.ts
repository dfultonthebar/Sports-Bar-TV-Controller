
import cron from 'node-cron'
import { reorderAllPresets } from './presetReorderService'

let cronJob: cron.ScheduledTask | null = null

/**
 * Initialize the monthly preset reordering cron job
 * Runs on the 1st day of every month at 3:00 AM
 */
export function initializePresetCronJob() {
  if (cronJob) {
    console.log('[Preset Cron] Cron job already initialized')
    return
  }

  // Schedule: Run at 3:00 AM on the 1st day of every month
  // Cron format: minute hour day-of-month month day-of-week
  // '0 3 1 * *' = At 03:00 on day-of-month 1
  cronJob = cron.schedule('0 3 1 * *', async () => {
    console.log('[Preset Cron] Running monthly preset reordering...')
    try {
      const result = await reorderAllPresets()
      console.log('[Preset Cron] Monthly reordering completed:', result)
    } catch (error) {
      console.error('[Preset Cron] Error during monthly reordering:', error)
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust to your timezone
  })

  console.log('[Preset Cron] Monthly preset reordering cron job initialized (runs at 3:00 AM on 1st of each month)')
}

/**
 * Stop the cron job (useful for testing or shutdown)
 */
export function stopPresetCronJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('[Preset Cron] Cron job stopped')
  }
}

/**
 * Manually trigger the reordering (for testing)
 */
export async function triggerManualReorder() {
  console.log('[Preset Cron] Manual reordering triggered')
  try {
    const result = await reorderAllPresets()
    console.log('[Preset Cron] Manual reordering completed:', result)
    return result
  } catch (error) {
    console.error('[Preset Cron] Error during manual reordering:', error)
    throw error
  }
}
