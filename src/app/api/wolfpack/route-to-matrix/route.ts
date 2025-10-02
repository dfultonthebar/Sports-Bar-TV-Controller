
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { routeWolfpackToMatrix } from '@/services/wolfpackMatrixService'

export async function POST(request: NextRequest) {
  try {
    const { wolfpackInputNumber, matrixOutputNumber } = await request.json()

    if (!wolfpackInputNumber || !matrixOutputNumber) {
      return NextResponse.json(
        { error: 'wolfpackInputNumber and matrixOutputNumber are required' },
        { status: 400 }
      )
    }

    if (matrixOutputNumber < 1 || matrixOutputNumber > 4) {
      return NextResponse.json(
        { error: 'matrixOutputNumber must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get the Wolfpack input details
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { 
            channelNumber: wolfpackInputNumber,
            isActive: true 
          }
        }
      }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    const wolfpackInput = config.inputs[0]
    if (!wolfpackInput) {
      return NextResponse.json(
        { error: `Wolfpack input ${wolfpackInputNumber} not found` },
        { status: 404 }
      )
    }

    // Route the Wolfpack input to the Matrix output
    const result = await routeWolfpackToMatrix(
      config,
      wolfpackInputNumber,
      matrixOutputNumber,
      wolfpackInput.label
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to route Wolfpack to Matrix' },
        { status: 500 }
      )
    }

    // Update the routing state in database
    await prisma.wolfpackMatrixRouting.upsert({
      where: { matrixOutputNumber },
      update: {
        wolfpackInputNumber,
        wolfpackInputLabel: wolfpackInput.label,
        lastRouted: new Date(),
        updatedAt: new Date()
      },
      create: {
        matrixOutputNumber,
        wolfpackInputNumber,
        wolfpackInputLabel: wolfpackInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        isActive: true,
        lastRouted: new Date()
      }
    })

    // Log the routing state
    await prisma.wolfpackMatrixState.create({
      data: {
        matrixOutputNumber,
        wolfpackInputNumber,
        wolfpackInputLabel: wolfpackInput.label,
        channelInfo: JSON.stringify({
          deviceType: wolfpackInput.deviceType,
          inputType: wolfpackInput.inputType
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: `Routed ${wolfpackInput.label} to Matrix ${matrixOutputNumber}`,
      routing: {
        wolfpackInput: {
          number: wolfpackInputNumber,
          label: wolfpackInput.label
        },
        matrixOutput: matrixOutputNumber
      }
    })

  } catch (error) {
    console.error('Error routing Wolfpack to Matrix:', error)
    return NextResponse.json(
      { error: 'Failed to route Wolfpack to Matrix' },
      { status: 500 }
    )
  }
}
