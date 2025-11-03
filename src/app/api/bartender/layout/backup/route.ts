/**
 * Layout Backup API
 *
 * Backup and restore TV layout configurations to preserve mappings
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const LAYOUT_FILE = join(process.cwd(), 'data', 'tv-layout.json')
const BACKUP_DIR = join(process.cwd(), 'data', 'backups')

/**
 * GET - List all backups
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true })

    // Read all backup files
    const files = await fs.readdir(BACKUP_DIR)
    const backupFiles = files
      .filter(f => f.startsWith('tv-layout-') && f.endsWith('.json'))
      .sort()
      .reverse() // Most recent first

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
          name: layout.name || 'Unknown'
        }
      })
    )

    return NextResponse.json({
      success: true,
      backups,
      currentLayout: LAYOUT_FILE
    })
  } catch (error) {
    console.error('[Backup API] Error listing backups:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list backups',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Create backup or restore from backup
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { action, filename } = await request.json()

    if (action === 'create') {
      // Create backup
      await fs.mkdir(BACKUP_DIR, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFilename = `tv-layout-${timestamp}.json`
      const backupPath = join(BACKUP_DIR, backupFilename)

      // Read current layout
      const layoutData = await fs.readFile(LAYOUT_FILE, 'utf-8')
      const layout = JSON.parse(layoutData)

      // Write backup
      await fs.writeFile(backupPath, JSON.stringify(layout, null, 2), 'utf-8')

      console.log(`[Backup API] Created backup: ${backupPath}`)

      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          filename: backupFilename,
          filepath: backupPath,
          timestamp: new Date(),
          zonesCount: layout.zones?.length || 0
        }
      })
    } else if (action === 'restore') {
      // Restore from backup
      if (!filename) {
        return NextResponse.json(
          { success: false, error: 'Filename is required for restore' },
          { status: 400 }
        )
      }

      const backupPath = join(BACKUP_DIR, filename)

      // Verify backup exists
      try {
        await fs.access(backupPath)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Backup file not found' },
          { status: 404 }
        )
      }

      // Create backup of current layout before restoring
      const preRestoreBackup = `tv-layout-pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const currentLayout = await fs.readFile(LAYOUT_FILE, 'utf-8')
      await fs.writeFile(join(BACKUP_DIR, preRestoreBackup), currentLayout, 'utf-8')

      // Restore backup
      const backupData = await fs.readFile(backupPath, 'utf-8')
      await fs.writeFile(LAYOUT_FILE, backupData, 'utf-8')

      const restoredLayout = JSON.parse(backupData)

      console.log(`[Backup API] Restored from backup: ${backupPath}`)

      return NextResponse.json({
        success: true,
        message: 'Layout restored successfully',
        preRestoreBackup,
        zonesCount: restoredLayout.zones?.length || 0
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "create" or "restore"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Backup API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Backup operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a backup
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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

    // Verify backup exists
    try {
      await fs.access(backupPath)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Backup file not found' },
        { status: 404 }
      )
    }

    // Delete backup
    await fs.unlink(backupPath)

    console.log(`[Backup API] Deleted backup: ${backupPath}`)

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully'
    })
  } catch (error) {
    console.error('[Backup API] Error deleting backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete backup',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
