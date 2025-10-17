

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { irDatabaseService } from '@/lib/services/ir-database'
import { logDatabaseOperation } from '@/lib/database-logger'

const prisma = new PrismaClient()

/**
 * POST /api/ir/database/download
 * Download IR codes for a device
 * Body: { deviceId, codesetId, functions: [{functionName, category}] }
 */
export async function POST(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⬇️  [IR DATABASE API] Downloading IR codes')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const { deviceId, codesetId, functions } = body

    if (!deviceId || !codesetId || !functions || !Array.isArray(functions)) {
      console.log('❌ [IR DATABASE API] Invalid request body')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Device ID, codeset ID, and functions array are required' },
        { status: 400 }
      )
    }

    console.log('   Device ID:', deviceId)
    console.log('   Codeset ID:', codesetId)
    console.log('   Functions count:', functions.length)

    // Get active credentials
    const credentials = await prisma.iRDatabaseCredentials.findFirst({
      where: { isActive: true }
    })

    if (!credentials || !credentials.apiKey) {
      console.log('❌ [IR DATABASE API] No active credentials found')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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
        const code = await irDatabaseService.downloadCode(
          codesetId,
          func.functionName,
          credentials.apiKey,
          'gc'
        )

        // Check if command already exists
        const existingCommand = await prisma.iRCommand.findUnique({
          where: {
            deviceId_functionName: {
              deviceId,
              functionName: func.functionName
            }
          }
        })

        if (existingCommand) {
          // Update existing command
          const updated = await prisma.iRCommand.update({
            where: { id: existingCommand.id },
            data: {
              irCode: code.Code1,
              hexCode: code.HexCode1,
              codeSetId: codesetId,
              category: func.category
            }
          })
          downloadedCommands.push(updated)
          console.log('✅ Updated command:', func.functionName)
        } else {
          // Create new command
          const created = await prisma.iRCommand.create({
            data: {
              deviceId,
              functionName: func.functionName,
              irCode: code.Code1,
              hexCode: code.HexCode1,
              codeSetId: codesetId,
              category: func.category
            }
          })
          downloadedCommands.push(created)
          console.log('✅ Created command:', func.functionName)
        }
      } catch (error: any) {
        console.error(`❌ Error downloading ${func.functionName}:`, error.message)
        errors.push({
          functionName: func.functionName,
          error: error.message
        })
      }
    }

    // Update device with codeset ID
    await prisma.iRDevice.update({
      where: { id: deviceId },
      data: { irCodeSetId: codesetId }
    })

    console.log('✅ [IR DATABASE API] Download complete')
    console.log('   Success:', downloadedCommands.length)
    console.log('   Errors:', errors.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
    console.error('❌ [IR DATABASE API] Error downloading codes:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DATABASE_API', 'download_codes_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
