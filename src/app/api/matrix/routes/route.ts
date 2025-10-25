import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Get all active routes
    const routes = await db.select()
      .from(schema.matrixRoutes)
      .where(eq(schema.matrixRoutes.isActive, true))
      .orderBy(asc(schema.matrixRoutes.outputNum))
      .all()

    return NextResponse.json({ 
      success: true,
      routes: routes.map(r => ({
        inputNum: r.inputNum,
        outputNum: r.outputNum,
        isActive: r.isActive
      }))
    })
  } catch (error) {
    logger.error('Error getting matrix routes:', error)
    return NextResponse.json(
      { error: 'Failed to get routes', routes: [] },
      { status: 500 }
    )
  }
}
