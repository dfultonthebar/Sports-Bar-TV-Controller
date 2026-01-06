/**
 * API Route: Execute Single Game Scheduling
 *
 * Manually schedules a specific game to an available TV using the
 * allowed inputs and outputs set by the bartender.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getDistributionEngine } from '@/lib/scheduler/distribution-engine'
import type { GameInfo } from '@/lib/scheduler/priority-calculator'

const requestSchema = z.object({
  game: z.object({
    id: z.string(),
    homeTeam: z.string(),
    awayTeam: z.string(),
    league: z.string().optional(),
    channelNumber: z.string().optional(),
    cableChannel: z.string().optional(),
    directvChannel: z.string().optional(),
    startTime: z.string().optional(),
    gameTime: z.string().optional()
  }),
  allowedOutputs: z.array(z.number()).optional(),
  allowedInputs: z.array(z.number()).optional()
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, requestSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { game, allowedOutputs, allowedInputs } = bodyValidation.data

  try {
    logger.info(`[SINGLE_GAME] Scheduling: ${game.homeTeam} vs ${game.awayTeam}`)

    // Transform to GameInfo format
    const gameInfo: GameInfo = {
      id: game.id,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      league: game.league,
      channelNumber: game.channelNumber,
      cableChannel: game.cableChannel,
      directvChannel: game.directvChannel,
      startTime: game.startTime,
      description: `${game.homeTeam} vs ${game.awayTeam}`
    }

    // Use distribution engine to create plan for just this one game
    const distributionEngine = getDistributionEngine()
    const plan = await distributionEngine.createDistributionPlan([gameInfo], {
      allowedOutputs,
      allowedInputs
    })

    if (plan.games.length === 0 || plan.games[0].assignments.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available TVs or inputs to schedule this game'
      }, { status: 400 })
    }

    const gameAssignment = plan.games[0]
    const assignment = gameAssignment.assignments[0] // Get first TV assignment

    logger.info(
      `[SINGLE_GAME] Assigning to output ${assignment.outputNumber} via input ${assignment.inputNumber} (channel ${assignment.channelNumber})`
    )

    // Execute the assignment
    let channelsSet = 0
    let tvsControlled = 0

    // Find the input details
    const matrixInput = await db.select()
      .from(schema.matrixInputs)
      .where(eq(schema.matrixInputs.channelNumber, assignment.inputNumber))
      .limit(1)
      .get()

    if (!matrixInput) {
      return NextResponse.json({
        success: false,
        error: `Input ${assignment.inputNumber} not found`
      }, { status: 400 })
    }

    // Tune the channel based on device type
    if (assignment.channelNumber) {
      logger.info(`[SINGLE_GAME] Tuning ${matrixInput.label} to channel ${assignment.channelNumber}`)

      const deviceType = matrixInput.deviceType || ''

      if (deviceType === 'Cable Box') {
        // Find IR device and tune cable box
        const irDevice = await db.select()
          .from(schema.irDevices)
          .where(
            and(
              eq(schema.irDevices.deviceType, 'Cable Box'),
              eq(schema.irDevices.name, matrixInput.label)
            )
          )
          .limit(1)
          .get()

        if (irDevice) {
          const tuneResponse = await fetch('http://localhost:3001/api/channel-presets/tune', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelNumber: assignment.channelNumber,
              deviceType: 'cable',
              cableBoxId: irDevice.id
            })
          })

          const tuneResult = await tuneResponse.json()
          if (tuneResult.success) {
            channelsSet++
            logger.info(`[SINGLE_GAME] Tuned cable box ${matrixInput.label} to channel ${assignment.channelNumber}`)
          }
        }
      } else if (deviceType === 'DirecTV') {
        // Load DirecTV devices and tune
        const fs = await import('fs/promises')
        const path = await import('path')
        const devicesPath = path.join(process.cwd(), 'data', 'directv-devices.json')

        try {
          const devicesJson = await fs.readFile(devicesPath, 'utf-8')
          const devicesData = JSON.parse(devicesJson)
          const direcTVDevice = devicesData.devices.find((d: any) => d.name === matrixInput.label)

          if (direcTVDevice) {
            const tuneResponse = await fetch(`http://localhost:3001/api/directv/${direcTVDevice.id}/tune`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel: parseInt(assignment.channelNumber) })
            })

            const tuneResult = await tuneResponse.json()
            if (tuneResult.success) {
              channelsSet++
              logger.info(`[SINGLE_GAME] Tuned DirecTV ${matrixInput.label} to channel ${assignment.channelNumber}`)
            }
          }
        } catch (err: any) {
          logger.error(`[SINGLE_GAME] Error tuning DirecTV: ${err.message}`)
        }
      }
    }

    // Route the matrix
    const routeResponse = await fetch('http://localhost:3001/api/matrix/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: assignment.inputNumber,
        output: assignment.outputNumber,
        source: 'manual_schedule'
      })
    })

    if (routeResponse.ok) {
      tvsControlled++
      logger.info(`[SINGLE_GAME] Routed output ${assignment.outputNumber} to input ${assignment.inputNumber}`)
    }

    // Update input current channel tracking
    try {
      const existingRecord = await db.select()
        .from(schema.inputCurrentChannels)
        .where(eq(schema.inputCurrentChannels.inputNum, matrixInput.channelNumber))
        .limit(1)
        .get()

      const channelData = {
        inputNum: matrixInput.channelNumber,
        inputLabel: matrixInput.label,
        deviceType: matrixInput.deviceType || 'Unknown',
        channelNumber: assignment.channelNumber || '',
        channelName: `${game.homeTeam} vs ${game.awayTeam}`,
        showName: game.league || '',
        lastTuned: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (existingRecord) {
        await db.update(schema.inputCurrentChannels)
          .set(channelData)
          .where(eq(schema.inputCurrentChannels.inputNum, matrixInput.channelNumber))
      } else {
        await db.insert(schema.inputCurrentChannels)
          .values({
            id: `input-${matrixInput.channelNumber}`,
            ...channelData
          })
      }
    } catch (dbError: any) {
      logger.warn(`[SINGLE_GAME] Could not update channel tracking: ${dbError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: `Scheduled ${game.homeTeam} vs ${game.awayTeam}`,
      channelsSet,
      tvsControlled,
      assignment: {
        outputNumber: assignment.outputNumber,
        outputName: assignment.zoneName,
        inputNumber: assignment.inputNumber,
        inputName: assignment.inputLabel,
        channel: assignment.channelNumber
      }
    })

  } catch (error: any) {
    logger.error('[SINGLE_GAME] Error scheduling game:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
