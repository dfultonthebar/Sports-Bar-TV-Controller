
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMatrixRoutings, wolfpackMatrixStates } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'

export async function GET() {
  try {
    // Get all Matrix routing configurations
    const routings = await prisma.wolfpackMatrixRouting.findMany({
      where: { isActive: true },
      orderBy: { matrixOutputNumber: 'asc' }
    })

    // Get recent routing history
    const recentStates = await prisma.wolfpackMatrixState.findMany({
      orderBy: { routedAt: 'desc' },
      take: 20
    })

    return NextResponse.json({
      success: true,
      routings,
      recentStates
    })

  } catch (error) {
    console.error('Error fetching Matrix routing state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Matrix routing state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { matrixOutputNumber, atlasInputLabel } = await request.json()

    if (!matrixOutputNumber) {
      return NextResponse.json(
        { error: 'matrixOutputNumber is required' },
        { status: 400 }
      )
    }

    // Update or create Matrix routing configuration
    const routing = await prisma.wolfpackMatrixRouting.upsert({
      where: { matrixOutputNumber },
      update: {
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        updatedAt: new Date()
      },
      create: {
        matrixOutputNumber,
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      routing
    })

  } catch (error) {
    console.error('Error updating Matrix routing configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update Matrix routing configuration' },
      { status: 500 }
    )
  }
}
