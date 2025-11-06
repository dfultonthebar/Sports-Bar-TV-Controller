import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { irCommands, irDevices } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id: deviceId } = params
    const { templateId, selectedCommands } = bodyValidation.data

    // Verify device exists
    const device = await db.select().from(irDevices).where(eq(irDevices.id, deviceId)).get()
    
    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Load template
    const templatesPath = path.join(process.cwd(), 'src/data/ir-command-templates.json')
    const templatesData = fs.readFileSync(templatesPath, 'utf-8')
    const templates = JSON.parse(templatesData)
    
    const template = templates.templates.find((t: any) => t.id === templateId)
    
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Determine which commands to add
    let commandsToAdd = template.commands
    if (selectedCommands && Array.isArray(selectedCommands) && selectedCommands.length > 0) {
      commandsToAdd = template.commands.filter((cmd: any) => 
        selectedCommands.includes(cmd.name)
      )
    }

    // Get existing commands for this device
    const existingCommands = await db
      .select()
      .from(irCommands)
      .where(eq(irCommands.deviceId, deviceId))

    const existingCommandNames = new Set(existingCommands.map(cmd => cmd.functionName))

    // Filter out commands that already exist
    const newCommands = commandsToAdd.filter((cmd: any) => 
      !existingCommandNames.has(cmd.name)
    )

    if (newCommands.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All commands from template already exist',
        added: 0,
        skipped: commandsToAdd.length
      })
    }

    // Create placeholder commands
    const commandsCreated = []
    for (const cmd of newCommands) {
      const command = await db
        .insert(irCommands)
        .values({
          deviceId: deviceId,
          functionName: cmd.name,
          irCode: 'PLACEHOLDER',
          category: cmd.category,
          description: `From ${template.name} template`
        })
        .returning()

      commandsCreated.push(command[0])
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('📋 [IR TEMPLATE] Commands loaded from template')
    logger.info('   Template:', template.name)
    logger.info('   Device ID:', { data: deviceId })
    logger.info('   Commands added:', { data: commandsCreated.length })
    logger.info('   Commands skipped:', { data: commandsToAdd.length - newCommands.length })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      message: `${commandsCreated.length} commands loaded from template`,
      added: commandsCreated.length,
      skipped: commandsToAdd.length - newCommands.length,
      commands: commandsCreated
    })

  } catch (error) {
    logger.error('Error loading commands from template:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load commands from template' },
      { status: 500 }
    )
  }
}
