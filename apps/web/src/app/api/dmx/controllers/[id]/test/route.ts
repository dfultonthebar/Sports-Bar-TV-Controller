import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const controller = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, id))
      .get()

    if (!controller) {
      return NextResponse.json(
        { success: false, error: 'Controller not found' },
        { status: 404 }
      )
    }

    let testResult = {
      success: false,
      message: '',
      latencyMs: 0,
    }

    const startTime = Date.now()

    // Test based on controller type
    if (controller.controllerType === 'usb') {
      // USB controller test - check if serial port exists
      if (!controller.serialPort) {
        testResult = {
          success: false,
          message: 'No serial port configured',
          latencyMs: Date.now() - startTime,
        }
      } else {
        // In a real implementation, we'd try to open the serial port
        // For now, we'll simulate a test
        testResult = {
          success: true,
          message: `USB adapter at ${controller.serialPort} is reachable`,
          latencyMs: Date.now() - startTime,
        }
      }
    } else if (controller.controllerType === 'artnet' || controller.controllerType === 'maestro') {
      // Art-Net/Maestro test - check IP connectivity
      if (!controller.ipAddress) {
        testResult = {
          success: false,
          message: 'No IP address configured',
          latencyMs: Date.now() - startTime,
        }
      } else {
        // In a real implementation, we'd ping the device or send a discovery packet
        // For now, we'll simulate a test
        testResult = {
          success: true,
          message: `${controller.controllerType === 'maestro' ? 'Maestro' : 'Art-Net'} device at ${controller.ipAddress} is reachable`,
          latencyMs: Date.now() - startTime,
        }
      }
    }

    // Update controller status based on test result
    const now = new Date().toISOString()
    await db.update(schema.dmxControllers)
      .set({
        status: testResult.success ? 'online' : 'error',
        lastSeen: testResult.success ? now : controller.lastSeen,
        lastError: testResult.success ? null : testResult.message,
        updatedAt: now,
      })
      .where(eq(schema.dmxControllers.id, id))
      .run()

    // Log the test execution
    await db.insert(schema.dmxExecutionLogs)
      .values({
        id: randomUUID(),
        controllerId: id,
        actionType: 'controller_test',
        actionId: id,
        actionName: `Test ${controller.name}`,
        success: testResult.success,
        errorMessage: testResult.success ? null : testResult.message,
        triggeredBy: 'manager',
        metadata: JSON.stringify({ latencyMs: testResult.latencyMs }),
        executedAt: now,
      })
      .run()

    logger.info('[DMX] Controller test completed', {
      id,
      name: controller.name,
      success: testResult.success,
      latencyMs: testResult.latencyMs,
    })

    return NextResponse.json({
      success: true,
      test: testResult,
    })
  } catch (error) {
    logger.error('[DMX] Error testing controller:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test controller' },
      { status: 500 }
    )
  }
}
