/**
 * Next.js Instrumentation File
 * 
 * This file runs once when the Next.js server starts.
 * Use it to initialize services that should run continuously.
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] Initializing Fire TV services...')
    
    try {
      // Import health monitor (will auto-start due to module-level code)
      const { healthMonitor } = await import('./services/firetv-health-monitor')
      
      console.log('[INSTRUMENTATION] Fire TV health monitor initialized')
      console.log('[INSTRUMENTATION] Health monitoring will begin in 5 seconds')
    } catch (error) {
      console.error('[INSTRUMENTATION] Failed to initialize Fire TV services:', error)
    }
  }
}
