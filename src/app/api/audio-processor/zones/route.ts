
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { audioZones } from '@/db/schema'
import { prisma } from '@/db/prisma-adapter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    const zones = await prisma.audioZone.findMany({
      where: { processorId: processorId },
      orderBy: { zoneNumber: 'asc' }
    })

    return NextResponse.json({ zones })
  } catch (error) {
    console.error('Error fetching audio zones:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio zones' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { processorId, zoneNumber, name, description, currentSource, volume, muted } = data

    if (!processorId || !zoneNumber || !name) {
      return NextResponse.json(
        { error: 'Processor ID, zone number, and name are required' },
        { status: 400 }
      )
    }

    const zone = await db.insert(audioZones).values({
        processorId: processorId,
        zoneNumber,
        name,
        description,
        currentSource,
        volume: volume || 50,
        muted: muted || false,
        enabled: true
      }).returning().get()

    return NextResponse.json({ zone })
  } catch (error) {
    console.error('Error creating audio zone:', error)
    return NextResponse.json(
      { error: 'Failed to create audio zone' },
      { status: 500 }
    )
  }
}
