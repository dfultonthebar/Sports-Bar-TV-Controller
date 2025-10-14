
import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { routeWolfpackToMatrix } from '@/services/wolfpackMatrixService'

/**
 * Matrix Video Input Selection API
 * Handles video input selection for matrix outputs and routes audio accordingly
 */

export async function POST(request: NextRequest) {
  try {
    const { matrixOutputNumber, videoInputNumber, videoInputLabel } = await request.json()

    // Validate input parameters
    if (!matrixOutputNumber || !videoInputNumber) {
      return NextResponse.json(
        { error: 'Matrix output number and video input number are required' },
        { status: 400 }
      )
    }

    // Validate matrix output is 1-4 (Matrix outputs)
    if (matrixOutputNumber < 1 || matrixOutputNumber > 4) {
      return NextResponse.json(
        { error: 'Matrix output number must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get active matrix configuration
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { channelNumber: videoInputNumber }
        },
        outputs: {
          where: { channelNumber: 32 + matrixOutputNumber } // Matrix outputs are 33-36
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    const videoInput = config.inputs[0]
    if (!videoInput) {
      return NextResponse.json(
        { error: `Video input ${videoInputNumber} not found` },
        { status: 404 }
      )
    }

    const matrixOutput = config.outputs[0]
    if (!matrixOutput) {
      return NextResponse.json(
        { error: `Matrix output ${matrixOutputNumber} not found` },
        { status: 404 }
      )
    }

    // Step 1: Route the video input to the matrix output via Wolfpack
    console.log(`Routing video input ${videoInputNumber} (${videoInput.label}) to Matrix ${matrixOutputNumber}`)
    
    const routingResult = await routeWolfpackToMatrix(
      config,
      videoInputNumber,
      matrixOutputNumber,
      videoInput.label
    )

    if (!routingResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to route video input to matrix output',
          details: routingResult.error 
        },
        { status: 500 }
      )
    }

    // Step 2: Update the matrix output with selected video input info
    await prisma.matrixOutput.update({
      where: { id: matrixOutput.id },
      data: {
        selectedVideoInput: parseInt(videoInputNumber),
        videoInputLabel: videoInput.label,
        label: videoInput.label // Update label to match video input
      }
    })

    // Step 3: Update the Wolfpack-Matrix routing state
    await prisma.wolfpackMatrixRouting.upsert({
      where: { matrixOutputNumber: parseInt(matrixOutputNumber) },
      update: {
        wolfpackInputNumber: parseInt(videoInputNumber),
        wolfpackInputLabel: videoInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        lastRouted: new Date(),
        updatedAt: new Date()
      },
      create: {
        matrixOutputNumber: parseInt(matrixOutputNumber),
        wolfpackInputNumber: parseInt(videoInputNumber),
        wolfpackInputLabel: videoInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        isActive: true,
        lastRouted: new Date()
      }
    })

    // Step 4: Log the routing state
    await prisma.wolfpackMatrixState.create({
      data: {
        matrixOutputNumber: parseInt(matrixOutputNumber),
        wolfpackInputNumber: parseInt(videoInputNumber),
        wolfpackInputLabel: videoInput.label,
        channelInfo: JSON.stringify({
          deviceType: videoInput.deviceType,
          inputType: videoInput.inputType,
          selectedAt: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully routed ${videoInput.label} to Matrix ${matrixOutputNumber}`,
      routing: {
        videoInput: {
          number: videoInputNumber,
          label: videoInput.label
        },
        matrixOutput: {
          number: matrixOutputNumber,
          label: `Matrix ${matrixOutputNumber}`
        },
        atlasInput: `Matrix ${matrixOutputNumber}`,
        command: routingResult.command
      }
    })

  } catch (error) {
    console.error('Error in video input selection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process video input selection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve current video input selections for matrix outputs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const matrixOutputNumber = searchParams.get('matrixOutputNumber')

    // Get active matrix configuration
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        outputs: {
          where: matrixOutputNumber 
            ? { channelNumber: 32 + parseInt(matrixOutputNumber) }
            : { channelNumber: { gte: 33, lte: 36 } }, // Matrix outputs 1-4 (channels 33-36)
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get routing states
    const routingStates = await prisma.wolfpackMatrixRouting.findMany({
      where: matrixOutputNumber 
        ? { matrixOutputNumber: parseInt(matrixOutputNumber) }
        : { matrixOutputNumber: { gte: 1, lte: 4 } },
      orderBy: { matrixOutputNumber: 'asc' }
    })

    // Combine output info with routing state
    const selections = config.outputs.map(output => {
      const matrixNum = output.channelNumber - 32 // Convert 33-36 to 1-4
      const routingState = routingStates.find(r => r.matrixOutputNumber === matrixNum)
      
      return {
        matrixOutputNumber: matrixNum,
        matrixOutputLabel: output.label,
        selectedVideoInput: output.selectedVideoInput,
        videoInputLabel: output.videoInputLabel,
        atlasInputLabel: routingState?.atlasInputLabel || `Matrix ${matrixNum}`,
        lastRouted: routingState?.lastRouted,
        isActive: routingState?.isActive || false
      }
    })

    return NextResponse.json({
      success: true,
      selections
    })

  } catch (error) {
    console.error('Error fetching video input selections:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch video input selections',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
