import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { randomUUID } from 'crypto'
import { getSceneEngine } from '@sports-bar/dmx'
import { ensureDMXControllersRegistered } from '@/lib/dmx-bootstrap'

/**
 * POST /api/dmx/control/blackout
 * Set all DMX channels to 0 (emergency blackout)
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Get all controllers
    const controllers = await db.select()
      .from(schema.dmxControllers)
      .all()

    if (controllers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No controllers configured',
      })
    }

    // Ensure controllers are registered, then blackout via scene engine
    await ensureDMXControllersRegistered()
    const sceneEngine = getSceneEngine()
    await sceneEngine.blackout(0)

    logger.info('[DMX] BLACKOUT triggered', {
      controllerCount: controllers.length,
    })

    // Log execution for each controller
    for (const controller of controllers) {
      await db.insert(schema.dmxExecutionLogs)
        .values({
          id: randomUUID(),
          controllerId: controller.id,
          actionType: 'blackout',
          actionName: 'Emergency Blackout',
          success: true,
          triggeredBy: 'api',
          executedAt: new Date().toISOString(),
        })
        .run()
    }

    return NextResponse.json({
      success: true,
      message: `Blackout sent to ${controllers.length} controller(s)`,
      controllers: controllers.map(c => ({ id: c.id, name: c.name })),
    })
  } catch (error) {
    logger.error('[DMX] Error during blackout:', error)
    return NextResponse.json({ error: 'Failed to execute blackout' }, { status: 500 })
  }
}
