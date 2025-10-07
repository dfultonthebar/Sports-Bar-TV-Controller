// Initialize Fire Cube Keep-Awake Scheduler on Server Startup

import { getKeepAwakeScheduler } from './keep-awake-scheduler';

export async function initializeFireCubeScheduler() {
  try {
    console.log('Initializing Fire Cube keep-awake scheduler...');
    const scheduler = getKeepAwakeScheduler();
    await scheduler.initializeSchedules();
    console.log('Fire Cube keep-awake scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Fire Cube scheduler:', error);
  }
}

// Auto-initialize if this module is imported
if (typeof window === 'undefined') {
  // Server-side only
  initializeFireCubeScheduler().catch(console.error);
}
