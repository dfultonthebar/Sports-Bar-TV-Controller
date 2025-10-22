
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), 'data', 'atlas-configs')

// Ensure config directory exists
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR)
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json({ error: 'Processor ID is required' }, { status: 400 })
    }

    await ensureConfigDir()
    
    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      console.log('[Atlas Config GET] Loaded configuration for processor:', processorId)
      console.log('[Atlas Config GET] Inputs count:', config.inputs?.length || 0)
      console.log('[Atlas Config GET] Outputs count:', config.outputs?.length || 0)
      
      // Ensure names are strings, not objects
      const inputs = (config.inputs || []).map((input: any) => ({
        ...input,
        name: typeof input.name === 'string' ? input.name : (input.name?.str || input.name?.val || `Input ${input.number || input.id || '?'}`)
      }))
      
      const outputs = (config.outputs || []).map((output: any) => ({
        ...output,
        name: typeof output.name === 'string' ? output.name : (output.name?.str || output.name?.val || `Zone ${output.number || output.id || '?'}`)
      }))
      
      console.log('[Atlas Config GET] Sample input name:', inputs[0]?.name)
      console.log('[Atlas Config GET] Sample output name:', outputs[0]?.name)
      
      return NextResponse.json({
        success: true,
        inputs,
        outputs,
        scenes: config.scenes || [],
        messages: config.messages || []
      })
    } catch (error) {
      // Config doesn't exist, return empty configuration
      return NextResponse.json({
        success: true,
        inputs: [] as any[],
        outputs: [] as any[],
        scenes: [] as any[],
        messages: [] as any[]
      })
    }
  } catch (error) {
    console.error('Error fetching Atlas configuration:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { processorId, inputs, outputs, scenes, messages } = await request.json()

    if (!processorId) {
      return NextResponse.json({ error: 'Processor ID is required' }, { status: 400 })
    }

    await ensureConfigDir()

    const config = {
      processorId,
      inputs,
      outputs,
      scenes,
      messages,
      lastUpdated: new Date().toISOString()
    }

    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))

    // Also save a backup with timestamp
    const backupPath = path.join(CONFIG_DIR, `${processorId}_backup_${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2))

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration saved successfully',
      savedAt: config.lastUpdated
    })
  } catch (error) {
    console.error('Error saving Atlas configuration:', error)
    return NextResponse.json({ 
      error: 'Failed to save configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
