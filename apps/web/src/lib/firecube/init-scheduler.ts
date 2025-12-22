/**
 * Initialize Fire Cube Keep-Awake Scheduler on Server Startup
 */

import { getKeepAwakeScheduler } from './scheduler-bridge'
import { logger } from '@/lib/logger'

export async function initializeFireCubeScheduler() {
  try {
    logger.info('[FIRECUBE] Initializing keep-awake scheduler...')
    const scheduler = getKeepAwakeScheduler()
    await scheduler.initializeSchedules()
    logger.info('[FIRECUBE] Keep-awake scheduler initialized successfully')
  } catch (error) {
    logger.error('[FIRECUBE] Failed to initialize scheduler:', { error })
  }
}

// Auto-initialize if this module is imported on server-side
if (typeof window === 'undefined') {
  initializeFireCubeScheduler().catch(console.error)
}
