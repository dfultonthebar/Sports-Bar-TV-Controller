import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { asc, eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { findMany, create, update, deleteRecord } from '@/lib/db-helpers'
import { ATLAS_MODELS } from '@/lib/atlas-models-config'
import { encryptPassword, decryptPassword } from '@/lib/atlas-auth'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

// Helper function to get input/output counts from model config
function getModelCounts(model: string) {
  const modelConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
  if (modelConfig) {
    return {
      inputs: modelConfig.inputs.length,
      outputs: modelConfig.outputs.length
    }
  }
  // Fallback for unknown models
  return {
    inputs: model.includes('AZM8') || model.includes('AZMP8') ? 10 : 6,
    outputs: model.includes('AZM8') || model.includes('AZMP8') ? 8 : 4
  }
}

export async function GET() {
  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  logger.api.request('GET', '/api/audio-processor')
  
  try {
    const processors = await findMany('audioProcessors', {
      orderBy: asc(schema.audioProcessors.name)
    })
    
    // Add calculated inputs and outputs for each processor based on model config
    // Don't expose encrypted passwords in GET response
    const processorsWithCounts = processors.map(processor => {
      const counts = getModelCounts(processor.model)
      const { password, ...processorWithoutPassword } = processor
      return {
        ...processorWithoutPassword,
        inputs: counts.inputs,
        outputs: counts.outputs,
        hasCredentials: !!(processor.username && processor.password)
      }
    })
    
    logger.api.response('GET', '/api/audio-processor', 200, { count: processorsWithCounts.length })
    return NextResponse.json({ processors: processorsWithCounts })
  } catch (error: any) {
    logger.api.error('GET', '/api/audio-processor', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio processors', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  logger.api.request('POST', '/api/audio-processor')
  
  try {
    const data = await request.json()
    const { name, model, ipAddress, port, zones, description, username, password } = data

    if (!name || !model || !ipAddress) {
      logger.api.response('POST', '/api/audio-processor', 400, { error: 'Missing required fields' })
      return NextResponse.json(
        { error: 'Name, model, and IP address are required' },
        { status: 400 }
      )
    }

    // Get model configuration for accurate counts
    const modelConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
    const calculatedZones = zones || modelConfig?.zones || (model.includes('AZM8') || model.includes('AZMP8') ? 8 : 4)
    
    // Prepare processor data
    const processorData: any = {
      name,
      model,
      ipAddress,
      port: port || 80,
      zones: calculatedZones,
      description,
      status: 'offline'
    }

    // Add credentials if provided
    if (username && password) {
      processorData.username = username
      processorData.password = encryptPassword(password)
    }

    const processor = await create('audioProcessors', processorData)

    // Return processor with calculated values from model config
    // Don't expose encrypted password
    const counts = getModelCounts(processor.model)
    const { password: encryptedPassword, ...processorWithoutPassword } = processor
    const processorWithCounts = {
      ...processorWithoutPassword,
      inputs: counts.inputs,
      outputs: counts.outputs,
      hasCredentials: !!(processor.username && processor.password)
    }

    logger.api.response('POST', '/api/audio-processor', 200, { processorId: processor.id })
    return NextResponse.json({ processor: processorWithCounts })
  } catch (error: any) {
    logger.api.error('POST', '/api/audio-processor', error)
    return NextResponse.json(
      { error: 'Failed to create audio processor', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  logger.api.request('PUT', '/api/audio-processor')
  
  try {
    const data = await request.json()
    const { searchParams } = new URL(request.url)
    
    // Accept ID from either request body or query parameter
    const id = data.id || searchParams.get('id')
    const { name, model, ipAddress, port, zones, description, username, password } = data

    if (!id) {
      logger.api.response('PUT', '/api/audio-processor', 400, { error: 'Missing ID' })
      return NextResponse.json(
        { error: 'Processor ID is required (provide in body or query parameter)' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      name,
      model,
      ipAddress,
      port,
      zones,
      description
    }

    // Update credentials if provided
    if (username !== undefined) {
      updateData.username = username || null
    }
    if (password !== undefined && password !== '') {
      updateData.password = encryptPassword(password)
    }

    const processor = await update('audioProcessors',
      eq(schema.audioProcessors.id, id),
      updateData
    )

    // Return processor without exposing encrypted password
    const counts = getModelCounts(processor.model)
    const { password: encryptedPassword, ...processorWithoutPassword } = processor
    const processorWithCounts = {
      ...processorWithoutPassword,
      inputs: counts.inputs,
      outputs: counts.outputs,
      hasCredentials: !!(processor.username && processor.password)
    }

    logger.api.response('PUT', '/api/audio-processor', 200, { processorId: processor.id })
    return NextResponse.json({ processor: processorWithCounts })
  } catch (error: any) {
    logger.api.error('PUT', '/api/audio-processor', error)
    return NextResponse.json(
      { error: 'Failed to update audio processor', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  logger.api.request('DELETE', '/api/audio-processor')
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      logger.api.response('DELETE', '/api/audio-processor', 400, { error: 'Missing ID' })
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    await deleteRecord('audioProcessors',
      eq(schema.audioProcessors.id, id)
    )

    logger.api.response('DELETE', '/api/audio-processor', 200, { processorId: id })
    return NextResponse.json({ message: 'Processor deleted successfully' })
  } catch (error: any) {
    logger.api.error('DELETE', '/api/audio-processor', error)
    return NextResponse.json(
      { error: 'Failed to delete audio processor', details: error.message },
      { status: 500 }
    )
  }
}
