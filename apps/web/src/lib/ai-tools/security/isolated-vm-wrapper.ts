import { logger } from '@/lib/logger'

/**
 * Wrapper for isolated-vm to handle optional dependency
 * This prevents build failures when isolated-vm is not available
 */

let isolatedVM: any = null;
let loadAttempted = false;

export async function getIsolatedVM() {
  if (loadAttempted) {
    return isolatedVM;
  }
  
  loadAttempted = true;
  
  // Only try to load in Node.js environment (not during build)
  if (typeof window === 'undefined') {
    try {
      // Use require instead of import to avoid webpack bundling
      isolatedVM = require('isolated-vm');
      logger.info('isolated-vm loaded successfully');
      return isolatedVM;
    } catch (error) {
      logger.warn('isolated-vm not available - JavaScript sandbox will be disabled');
      logger.warn('To enable JavaScript sandbox, run: npm rebuild isolated-vm');
      return null;
    }
  }
  
  return null;
}

export function isIsolatedVMAvailable(): boolean {
  return isolatedVM !== null;
}
