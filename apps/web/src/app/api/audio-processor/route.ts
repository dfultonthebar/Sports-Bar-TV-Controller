import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { asc, eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findMany, create, update, deleteRecord } from '@/lib/db-helpers'
import { ATLAS_MODELS } from '@/lib/atlas-models-config'
import { encryptPassword, decryptPassword } from '@/lib/atlas-auth'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

// dbx ZonePRO model configurations
const DBX_MODELS: Record<string, { inputs: number; outputs: number; zones: number; hasEthernet: boolean }> = {
  'ZonePRO 640': { inputs: 6, outputs: 4, zones: 4, hasEthernet: false },
  'ZonePRO 640m': { inputs: 6, outputs: 4, zones: 4, hasEthernet: true },
  'ZonePRO 641': { inputs: 6, outputs: 4, zones: 4, hasEthernet: false },
  'ZonePRO 641m': { inputs: 6, outputs: 4, zones: 4, hasEthernet: true },
  'ZonePRO 1260': { inputs: 12, outputs: 6, zones: 6, hasEthernet: false },
  'ZonePRO 1260m': { inputs: 12, outputs: 6, zones: 6, hasEthernet: true },
  'ZonePRO 1261': { inputs: 12, outputs: 6, zones: 6, hasEthernet: false },
  'ZonePRO 1261m': { inputs: 12, outputs: 6, zones: 6, hasEthernet: true },
}

// BSS Soundweb London BLU series model configurations
// All BSS BLU devices are network-only (HiQnet protocol over TCP port 1023)
const BSS_MODELS: Record<string, { inputs: number; outputs: number; zones: number; hasDante: boolean; hasCobraNet: boolean }> = {
  'BLU-50': { inputs: 4, outputs: 4, zones: 4, hasDante: false, hasCobraNet: false },
  'BLU-100': { inputs: 12, outputs: 8, zones: 8, hasDante: false, hasCobraNet: false },
  'BLU-120': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  'BLU-160': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  'BLU-320': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  'BLU-800': { inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  'BLU-806': { inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
  'BLU-806DA': { inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
}

// Helper function to get input/output counts from model config
function getModelCounts(model: string, processorType: string = 'atlas') {
  // Check BSS models
  if (processorType === 'bss-blu') {
    const bssConfig = BSS_MODELS[model]
    if (bssConfig) {
      return {
        inputs: bssConfig.inputs,
        outputs: bssConfig.outputs
      }
    }
  }

  // Check dbx models
  if (processorType === 'dbx-zonepro') {
    const dbxConfig = DBX_MODELS[model]
    if (dbxConfig) {
      return {
        inputs: dbxConfig.inputs,
        outputs: dbxConfig.outputs
      }
    }
  }

  // Atlas models
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

// Helper to get zones for a model
function getModelZones(model: string, processorType: string = 'atlas'): number {
  if (processorType === 'bss-blu') {
    const bssConfig = BSS_MODELS[model]
    return bssConfig?.zones || 8
  }
  if (processorType === 'dbx-zonepro') {
    const dbxConfig = DBX_MODELS[model]
    return dbxConfig?.zones || 4
  }
  const atlasConfig = ATLAS_MODELS[model as keyof typeof ATLAS_MODELS]
  return atlasConfig?.zones || (model.includes('8') ? 8 : 4)
}

export async function GET() {
  logger.api.request('GET', '/api/audio-processor')
  
  try {
    const processors = await findMany('audioProcessors', {
      orderBy: asc(schema.audioProcessors.name)
    })
    
    // Add calculated inputs and outputs for each processor based on model config
    // Don't expose encrypted passwords in GET response
    const processorsWithCounts = processors.map(processor => {
      const processorType = processor.processorType || 'atlas'
      const counts = getModelCounts(processor.model, processorType)
      const { password, ...processorWithoutPassword } = processor
      return {
        ...processorWithoutPassword,
        processorType,
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
  if (isValidationError(bodyValidation)) return bodyValidation.error


  logger.api.request('POST', '/api/audio-processor')

  try {
    const { data } = bodyValidation
    const {
      name, model, ipAddress, port, zones, description, username, password,
      processorType, connectionType, serialPort, baudRate, tcpPort
    } = data

    // Type conversions
    const modelStr = typeof model === 'string' ? model : String(model);
    const passwordStr = typeof password === 'string' ? password : undefined;
    const procType = (processorType as string) || 'atlas'

    if (!name || !model || !ipAddress) {
      logger.api.response('POST', '/api/audio-processor', 400, { error: 'Missing required fields' })
      return NextResponse.json(
        { error: 'Name, model, and IP address are required' },
        { status: 400 }
      )
    }

    // Get model configuration for accurate counts based on processor type
    const calculatedZones = zones || getModelZones(modelStr, procType)

    // Determine default TCP port based on processor type
    const defaultTcpPort = procType === 'bss-blu' ? 1023 : procType === 'dbx-zonepro' ? 3804 : 5321

    // Prepare processor data
    const processorData: any = {
      name,
      model: modelStr,
      processorType: procType,
      ipAddress,
      port: port || 80,
      tcpPort: tcpPort || defaultTcpPort,
      zones: calculatedZones,
      description,
      status: 'offline',
      // dbx-specific fields
      connectionType: connectionType || 'ethernet',
      serialPort: serialPort || null,
      baudRate: baudRate || 57600
    }

    // Add credentials if provided (mainly for Atlas)
    if (username && passwordStr) {
      processorData.username = username
      processorData.password = encryptPassword(passwordStr)
    }

    const processor = await create('audioProcessors', processorData)

    // Return processor with calculated values from model config
    // Don't expose encrypted password
    const counts = getModelCounts(processor.model, processor.processorType || 'atlas')
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
  if (isValidationError(bodyValidation)) return bodyValidation.error


  logger.api.request('PUT', '/api/audio-processor')

  try {
    const { data: data } = bodyValidation
    const { searchParams } = new URL(request.url)

    // Accept ID from either request body or query parameter
    const id = (data.id as string | undefined) || searchParams.get('id')
    const {
      name, model, ipAddress, port, zones, description, username, password,
      processorType, connectionType, serialPort, baudRate, tcpPort
    } = data

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

    // Add processor type and connection settings if provided
    if (processorType !== undefined) {
      updateData.processorType = processorType
    }
    if (connectionType !== undefined) {
      updateData.connectionType = connectionType
    }
    if (serialPort !== undefined) {
      updateData.serialPort = serialPort
    }
    if (baudRate !== undefined) {
      updateData.baudRate = baudRate
    }
    if (tcpPort !== undefined) {
      updateData.tcpPort = tcpPort
    }

    // Update credentials if provided
    if (username !== undefined) {
      updateData.username = username || null
    }
    if (password !== undefined && password !== '') {
      const passwordStr = typeof password === 'string' ? password : String(password);
      updateData.password = encryptPassword(passwordStr)
    }

    const processor = await update('audioProcessors',
      eq(schema.audioProcessors.id, id as string),
      updateData
    )

    // Return processor without exposing encrypted password
    const counts = getModelCounts(processor.model, processor.processorType || 'atlas')
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
