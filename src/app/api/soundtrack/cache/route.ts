
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { clearSoundtrackAPI } from '@/lib/soundtrack-your-brand'

const prisma = new PrismaClient()

/**
 * DELETE /api/soundtrack/cache
 * Clear the cached Soundtrack token from the database and memory
 * This forces fresh authentication on the next API request
 */
export async function DELETE() {
  try {
    // Find existing config
    const config = await prisma.soundtrackConfig.findFirst()

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Soundtrack configuration found to clear' 
      }, { status: 404 })
    }

    // Clear the in-memory API singleton
    clearSoundtrackAPI()

    // Update the config to mark it as needing re-authentication
    await prisma.soundtrackConfig.update({
      where: { id: config.id },
      data: {
        status: 'untested',
        lastTested: null
      }
    })

    console.log('[Soundtrack] Token cache cleared - fresh authentication will be required')

    return NextResponse.json({ 
      success: true, 
      message: 'Token cache cleared successfully. Fresh authentication will be required on next request.' 
    })
  } catch (error: any) {
    console.error('Error clearing Soundtrack token cache:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
