

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irCommands, irDatabaseCredentials, irDevices } from '@/db/schema'
import { findFirst, create, update } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * POST /api/ir/database/download
 * Download IR codes for a device
 * Body: { deviceId, codesetId, functions: [{functionName, category}] }
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('⬇️  [IR DATABASE API] Downloading IR codes')
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const { deviceId, codesetId, functions } = bodyValidation.data

    if (!deviceId || !codesetId || !functions || !Array.isArray(functions)) {
      logger.info('❌ [IR DATABASE API] Invalid request body')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Device ID, codeset ID, and functions array are required' },
        { status: 400 }
      )
    }

    logger.info('   Device ID:', deviceId)
    logger.info('   Codeset ID:', codesetId)
    logger.info('   Functions count:', { data: functions.length })

    // Get active credentials
    const credentials = await db.select().from(irDatabaseCredentials).where(eq(irDatabaseCredentials.isActive, true)).limit(1).get()

    if (!credentials || !credentials.apiKey) {
      logger.info('❌ [IR DATABASE API] No active credentials found')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'No active IR database credentials. Please login first.' },
        { status: 401 }
      )
    }

    const downloadedCommands = []
    const errors = []

    // Download each function
    for (const func of functions) {
      try {
        logger.info(`\n📥 Downloading: ${func.functionName}`)
        
        const code = await irDatabaseService.downloadCode(
          codesetId as string,
          func.functionName,
          credentials.apiKey,
          'gc'
        )

        // Validate that we received a valid code
        if (!code || !code.Code1) {
          throw new Error('Invalid IR code received: Code1 field is missing or undefined')
        }

        logger.info(`   ✓ Code1 received: ${code.Code1.substring(0, 50)}...`)
        logger.info(`   ✓ HexCode1: ${code.HexCode1 ? 'Yes' : 'No'}`)

        // Check if command already exists
        const existingCommand = await db.select()
          .from(irCommands)
          .where(
            and(
              eq(irCommands.deviceId, deviceId as string),
              eq(irCommands.functionName, func.functionName)
            )
          )
          .limit(1)
          .get()

        if (existingCommand) {
          // Update existing command
          const updated = await update(
            'irCommands',
            and(
              eq(schema.irCommands.deviceId, deviceId as string),
              eq(schema.irCommands.functionName, func.functionName)
            ),
            {
              irCode: code.Code1,
              hexCode: code.HexCode1 || null,
              codeSetId: codesetId,
              category: func.category
            }
          )
          downloadedCommands.push(updated)
          logger.info(`✅ Updated command: ${func.functionName}`)
        } else {
          // Create new command
          const created = await create('irCommands', {
            deviceId,
            functionName: func.functionName,
            irCode: code.Code1,
            hexCode: code.HexCode1 || null,
            codeSetId: codesetId,
            category: func.category
          })
          downloadedCommands.push(created)
          logger.info(`✅ Created command: ${func.functionName}`)
        }
      } catch (error: any) {
        logger.error(`❌ Error downloading ${func.functionName}:`)
        logger.error(`   Error type: ${error.constructor.name}`)
        logger.error(`   Error message: ${error.message}`)
        if (error.stack) {
          logger.error(`   Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`)
        }
        
        errors.push({
          functionName: func.functionName,
          error: error.message
        })
      }
    }

    // Update device with codeset ID
    await update('irDevices', eq(schema.irDevices.id, deviceId as string), { irCodeSetId: codesetId })

    logger.info('✅ [IR DATABASE API] Download complete')
    logger.info('   Success:', { data: downloadedCommands.length })
    logger.info('   Errors:', { data: errors.length })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'download_codes', {
      deviceId,
      codesetId,
      successCount: downloadedCommands.length,
      errorCount: errors.length
    })

    return NextResponse.json({
      success: true,
      downloadedCount: downloadedCommands.length,
      commands: downloadedCommands,
      errors
    })
  } catch (error: any) {
    logger.error('❌ [IR DATABASE API] Error downloading codes:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'download_codes_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
