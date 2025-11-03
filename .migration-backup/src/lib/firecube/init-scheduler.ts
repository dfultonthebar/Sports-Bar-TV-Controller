// Initialize Fire Cube Keep-Awake Scheduler on Server Startup

import { getKeepAwakeScheduler } from './keep-awake-scheduler';

import { logger } from '@/lib/logger'
export async function initializeFireCubeScheduler() {
  try {
    logger.info('Initializing Fire Cube keep-awake scheduler...');
    const scheduler = getKeepAwakeScheduler();
    await scheduler.initializeSchedules();
    logger.info('Fire Cube keep-awake scheduler initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Fire Cube scheduler:', error);
  }
}

// Auto-initialize if this module is imported
if (typeof window === 'undefined') {
  // Server-side only
  initializeFireCubeScheduler().catch(console.error);
}
