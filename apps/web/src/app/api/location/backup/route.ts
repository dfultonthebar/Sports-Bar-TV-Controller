import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, sql } from 'drizzle-orm'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody } from '@/lib/validation'
import { z } from 'zod'
import { logger } from '@sports-bar/logger'

const execFileAsync = promisify(execFile)

const backupSchema = z.object({
  action: z.enum(['backup', 'restore']),
  commitId: z.string().optional(), // For restore action
})

// Tables to backup (in order of dependencies)
const BACKUP_TABLES = [
  // Location first (parent)
  'locations',
  // Matrix configuration
  'matrixConfigurations',
  'matrixInputs',
  'matrixOutputs',
  'matrixRoutes',
  // Audio configuration
  'audioProcessors',
  'audioZones',
  'audioGroups',
  'audioScenes',
  // Devices
  'fireTVDevices',
  'fireCubeDevices',
  'globalCacheDevices',
  'globalCachePorts',
  'irDevices',
  'irCommands',
  'networkTVDevices',
  'bartenderRemotes',
  'cableBoxes',
  // Channel presets
  'channelPresets',
  // Teams and scheduling
  'homeTeams',
  'schedules',
  'scheduledCommands',
  // AI profiles
  'aiVenueProfiles',
  'aiTvAvailability',
  // Soundtrack
  'soundtrackConfigs',
  'soundtrackPlayers',
  // Sports guide
  'sportsGuideConfigurations',
  // TV Layout
  'tvLayouts',
  // Input sources
  'inputSources',
  'inputCurrentChannels',
  // Device mappings
  'deviceMappings',
]

async function exportTableToJson(tableName: string): Promise<any[]> {
  try {
    // Use raw SQL to get all data from the table
    const result = await db.all(sql.raw(`SELECT * FROM "${tableName}"`))
    return result as any[]
  } catch (error) {
    logger.warn(`[LOCATION BACKUP] Table ${tableName} not found or empty`)
    return []
  }
}

async function createBackupManifest(location: any, tables: Record<string, any[]>): Promise<object> {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    location: {
      id: location.id,
      name: location.name,
      city: location.city,
      state: location.state
    },
    tables: Object.keys(tables).map(name => ({
      name,
      rowCount: tables[name].length
    })),
    totalRows: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0)
  }
}

// POST - Trigger backup or restore
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, backupSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { action, commitId } = bodyValidation.data

  try {
    // Get current location
    const location = await db.select()
      .from(schema.locations)
      .where(eq(schema.locations.isActive, true))
      .limit(1)
      .get()

    if (!location) {
      return NextResponse.json(
        { success: false, error: 'No location configured. Please set up your location first.' },
        { status: 400 }
      )
    }

    // Get gitBranch from metadata
    let gitBranch = ''
    if (location.metadata) {
      try {
        const metadata = JSON.parse(location.metadata)
        gitBranch = metadata.gitBranch || ''
      } catch {
        // Ignore parse errors
      }
    }

    if (!gitBranch) {
      return NextResponse.json(
        { success: false, error: 'No GitHub branch configured for this location' },
        { status: 400 }
      )
    }

    if (action === 'backup') {
      return await performBackup(location, gitBranch)
    } else if (action === 'restore') {
      return await performRestore(location, gitBranch, commitId)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    logger.error('[LOCATION BACKUP] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Backup operation failed: ' + error.message },
      { status: 500 }
    )
  }
}

async function performBackup(location: any, gitBranch: string): Promise<NextResponse> {
  const backupDir = path.join(process.cwd(), 'backup', 'location-data')

  try {
    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true })
    }

    // Export all tables
    logger.info('[LOCATION BACKUP] Starting backup for location:', location.name)
    const tableData: Record<string, any[]> = {}

    for (const tableName of BACKUP_TABLES) {
      const data = await exportTableToJson(tableName)
      if (data.length > 0) {
        tableData[tableName] = data
        logger.debug(`[LOCATION BACKUP] Exported ${tableName}: ${data.length} rows`)
      }
    }

    // Create manifest
    const manifest = await createBackupManifest(location, tableData)

    // Write files
    await writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    await writeFile(
      path.join(backupDir, 'data.json'),
      JSON.stringify(tableData, null, 2)
    )

    // Write restore instructions
    const restoreInstructions = `# Location Backup Restore Instructions

## Location: ${location.name}
## Backup Date: ${new Date().toISOString()}
## Location ID: ${location.id}

## To restore this backup:

1. Clone this repository
2. Navigate to backup/location-data/
3. Import data.json into your database

## Files in this backup:
- manifest.json - Backup metadata
- data.json - All database tables

## Tables included:
${Object.keys(tableData).map(t => `- ${t}: ${tableData[t].length} rows`).join('\n')}
`

    await writeFile(
      path.join(backupDir, 'RESTORE.md'),
      restoreInstructions
    )

    // Git operations - commit backup files on current branch and push
    const cwd = process.cwd()

    // Add backup files to staging
    await execFileAsync('git', ['add', 'backup/location-data/'], { cwd })

    // Check if there are changes to commit
    const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain', 'backup/location-data/'], { cwd })

    if (statusOutput.trim()) {
      // Commit the backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const commitMessage = `backup(${location.name}): ${timestamp}\n\nLocation: ${location.name}\nTables: ${Object.keys(tableData).length}\nRows: ${Object.values(tableData).reduce((sum, rows) => sum + rows.length, 0)}`

      await execFileAsync('git', ['commit', '-m', commitMessage], { cwd })
      logger.info('[LOCATION BACKUP] Committed backup files')
    }

    // Push current branch to remote
    const { stdout: currentBranch } = await execFileAsync('git', ['branch', '--show-current'], { cwd })
    const branch = currentBranch.trim()

    try {
      await execFileAsync('git', ['push', 'origin', branch], { cwd })
      logger.info('[LOCATION BACKUP] Pushed backup to GitHub on branch:', branch)
    } catch (pushError: any) {
      logger.warn('[LOCATION BACKUP] Push failed, backup saved locally:', pushError.message)
      return NextResponse.json({
        success: true,
        message: `Backup saved locally! Push manually with: git push origin ${branch}`,
        branch: branch,
        tables: Object.keys(tableData).length,
        totalRows: Object.values(tableData).reduce((sum, rows) => sum + rows.length, 0),
        warning: 'Could not push to GitHub automatically'
      })
    }

    return NextResponse.json({
      success: true,
      message: `Backup successful! Committed and pushed to branch: ${branch}`,
      branch: branch,
      tables: Object.keys(tableData).length,
      totalRows: Object.values(tableData).reduce((sum, rows) => sum + rows.length, 0)
    })

  } catch (error: any) {
    logger.error('[LOCATION BACKUP] Backup failed:', error)
    return NextResponse.json(
      { success: false, error: 'Backup failed: ' + error.message },
      { status: 500 }
    )
  }
}

async function performRestore(location: any, gitBranch: string, commitId?: string): Promise<NextResponse> {
  // TODO: Implement restore functionality
  // This would:
  // 1. Checkout the backup branch
  // 2. Read the data.json file
  // 3. Clear existing tables
  // 4. Import data in dependency order

  return NextResponse.json({
    success: false,
    error: 'Restore functionality not yet implemented. Please restore manually using the backup files.'
  }, { status: 501 })
}
