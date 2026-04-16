/**
 * Layout Backup API
 *
 * Backup and restore TV layout configurations from BartenderLayout DB table.
 * Backups are still stored as JSON files in data/backups/ for easy portability.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

const BACKUP_DIR = join(process.cwd(), 'data', 'backups')

/**
 * GET - List all backups
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })

    const files = await fs.readdir(BACKUP_DIR)
    const backupFiles = files
      .filter(f => f.startsWith('tv-layout-') && f.endsWith('.json'))
      .sort()
      .reverse()

    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const filepath = join(BACKUP_DIR, filename)
        const stats = await fs.stat(filepath)
        const content = await fs.readFile(filepath, 'utf-8')
        const layout = JSON.parse(content)

        return {
          filename,
          filepath,
          timestamp: stats.mtime,
          size: stats.size,
          zonesCount: layout.zones?.length || 0,
          name: layout.name || 'Unknown',
        }
      })
    )

    return NextResponse.json({ success: true, backups })
  } catch (error) {
    logger.error('[Backup API] Error listing backups:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list backups', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create backup or restore from backup
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    action: z.enum(['create', 'restore']),
    filename: z.string().optional(),
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { action, filename } = bodyValidation.data

    if (action === 'create') {
      await fs.mkdir(BACKUP_DIR, { recursive: true })

      // Read current layout from DB
      const row = await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isDefault, true))
        .get()
        || await db.select().from(schema.bartenderLayouts)
          .where(eq(schema.bartenderLayouts.isActive, true))
          .get()

      const layout = row
        ? { name: row.name, zones: JSON.parse(row.zones || '[]'), backgroundImage: row.imageUrl }
        : { name: 'Bar Layout', zones: [], backgroundImage: null }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFilename = `tv-layout-${timestamp}.json`
      const backupPath = join(BACKUP_DIR, backupFilename)

      await fs.writeFile(backupPath, JSON.stringify(layout, null, 2), 'utf-8')

      logger.info(`[Backup API] Created backup: ${backupPath}`)

      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          filename: backupFilename,
          filepath: backupPath,
          timestamp: new Date(),
          zonesCount: layout.zones?.length || 0,
        },
      })
    } else if (action === 'restore') {
      if (!filename) {
        return NextResponse.json(
          { success: false, error: 'Filename is required for restore' },
          { status: 400 }
        )
      }

      const backupPath = join(BACKUP_DIR, filename)

      try {
        await fs.access(backupPath)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Backup file not found' },
          { status: 404 }
        )
      }

      // Create backup of current state before restoring
      const currentRow = await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isDefault, true))
        .get()
      if (currentRow) {
        const preRestoreBackup = `tv-layout-pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        const currentLayout = { name: currentRow.name, zones: JSON.parse(currentRow.zones || '[]'), backgroundImage: currentRow.imageUrl }
        await fs.writeFile(join(BACKUP_DIR, preRestoreBackup), JSON.stringify(currentLayout, null, 2), 'utf-8')
      }

      // Restore backup into DB
      const backupData = await fs.readFile(backupPath, 'utf-8')
      const restoredLayout = JSON.parse(backupData)
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

      const existing = await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isDefault, true))
        .get()

      if (existing) {
        await db.update(schema.bartenderLayouts)
          .set({
            name: restoredLayout.name || 'Bar Layout',
            zones: JSON.stringify(restoredLayout.zones || []),
            imageUrl: restoredLayout.backgroundImage || null,
            updatedAt: now,
          })
          .where(eq(schema.bartenderLayouts.id, existing.id))
      } else {
        await db.insert(schema.bartenderLayouts).values({
          name: restoredLayout.name || 'Bar Layout',
          zones: JSON.stringify(restoredLayout.zones || []),
          imageUrl: restoredLayout.backgroundImage || null,
          isDefault: true,
          isActive: true,
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
      }

      logger.info(`[Backup API] Restored from backup: ${backupPath}`)

      return NextResponse.json({
        success: true,
        message: 'Layout restored successfully',
        zonesCount: restoredLayout.zones?.length || 0,
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    logger.error('[Backup API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Backup operation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a backup
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename is required' },
        { status: 400 }
      )
    }

    const backupPath = join(BACKUP_DIR, filename)

    try {
      await fs.access(backupPath)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Backup file not found' },
        { status: 404 }
      )
    }

    await fs.unlink(backupPath)

    logger.info(`[Backup API] Deleted backup: ${backupPath}`)

    return NextResponse.json({ success: true, message: 'Backup deleted successfully' })
  } catch (error) {
    logger.error('[Backup API] Error deleting backup:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete backup', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
