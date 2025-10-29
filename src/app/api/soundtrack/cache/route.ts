
import { NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { clearSoundtrackAPI } from '@/lib/soundtrack-your-brand'


/**
 * DELETE /api/soundtrack/cache
 * Clear the cached Soundtrack token from the database and memory
 * This forces fresh authentication on the next API request
 */
export async function DELETE() {
  try {
    // Find existing config
    const config = await findFirst('soundtrackConfigs')

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Soundtrack configuration found to clear' 
      }, { status: 404 })
    }

    // Clear the in-memory API singleton
    clearSoundtrackAPI()

    // Update the config to mark it as needing re-authentication
    await update('soundtrackConfigs', config.id, {
      isActive: false,
      lastSync: null
    })

    logger.debug('[Soundtrack] Token cache cleared - fresh authentication will be required')

    return NextResponse.json({ 
      success: true, 
      message: 'Token cache cleared successfully. Fresh authentication will be required on next request.' 
    })
  } catch (error: any) {
    logger.error('Error clearing Soundtrack token cache:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
