
/**
 * Startup Initialization
 * This module handles application startup tasks including Wolf Pack connection
 */

export async function initializeWolfPackConnection() {
  try {
    console.log('[Startup] Initializing Wolf Pack matrix connection...')
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    
    const response = await fetch(`${baseUrl}/api/matrix/initialize-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('[Startup] ✓ Wolf Pack connection initialized successfully')
      return true
    } else {
      console.warn('[Startup] ✗ Failed to initialize Wolf Pack connection:', result.error)
      return false
    }
  } catch (error) {
    console.error('[Startup] Error initializing Wolf Pack connection:', error)
    return false
  }
}

export async function runStartupTasks() {
  console.log('[Startup] Running application startup tasks...')
  
  // Initialize Wolf Pack connection
  await initializeWolfPackConnection()
  
  console.log('[Startup] Startup tasks completed')
}
