import { logger } from '@/lib/logger'
import { startAutoIndexer } from '@/lib/rag-server'

/**
 * Startup Initialization
 * This module handles application startup tasks including Wolf Pack connection and RAG auto-indexer
 */

export async function initializeWolfPackConnection() {
  try {
    logger.info('[Startup] Initializing Wolf Pack matrix connection...')
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    
    const response = await fetch(`${baseUrl}/api/matrix/initialize-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    const result = await response.json()
    
    if (result.success) {
      logger.info('[Startup] ✓ Wolf Pack connection initialized successfully')
      return true
    } else {
      logger.warn('[Startup] ✗ Failed to initialize Wolf Pack connection:', result.error)
      return false
    }
  } catch (error) {
    logger.error('[Startup] Error initializing Wolf Pack connection:', error)
    return false
  }
}

export async function initializeRAGAutoIndexer() {
  try {
    logger.info('[Startup] Initializing RAG auto-indexer...')

    // Start auto-indexer with configuration
    await startAutoIndexer({
      debounceMs: 3000, // 3 second debounce for file changes
      initialRebuild: false, // Don't rebuild on startup
      periodicRebuildMinutes: 1440, // Full rebuild once per day (24 hours)
    })

    logger.info('[Startup] ✓ RAG auto-indexer started successfully')
    return true
  } catch (error) {
    logger.error('[Startup] ✗ Failed to start RAG auto-indexer:', error)
    return false
  }
}

export async function runStartupTasks() {
  logger.info('[Startup] Running application startup tasks...')

  // Initialize Wolf Pack connection
  await initializeWolfPackConnection()

  // Initialize RAG auto-indexer
  await initializeRAGAutoIndexer()

  logger.info('[Startup] Startup tasks completed')
}
