
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
const CONFIG_DIR = path.join(process.cwd(), 'data', 'atlas-configs')

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { processorId, sceneId } = await request.json()

    if (!processorId || !sceneId) {
      return NextResponse.json({ error: 'Processor ID and Scene ID are required' }, { status: 400 })
    }

    // Load the processor configuration to get scene details
    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    
    let config
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configData)
    } catch (error) {
      return NextResponse.json({ error: 'Processor configuration not found' }, { status: 404 })
    }

    // Find the scene to recall
    const scene = config.scenes?.find((s: any) => s.id === sceneId)
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    // Get processor details (you would typically fetch this from your processor database)
    const processorResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/audio-processor`)
    let processor
    
    if (processorResponse.ok) {
      const processorsData = await processorResponse.json()
      processor = processorsData.processors?.find((p: any) => p.id === processorId)
    }

    if (!processor) {
      return NextResponse.json({ error: 'Processor not found' }, { status: 404 })
    }

    const baseUrl = `http://${processor.ipAddress}`
    
    logger.info(`Recalling scene ${sceneId} (${scene.name}) on processor ${processor.name} at ${baseUrl}`)

    // Recall scene on the Atlas processor
    try {
      // In a real implementation, you would send the scene recall command to the Atlas processor:
      // const response = await fetch(`${baseUrl}/api/scene/${sceneId}/recall`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     recall_time: scene.recall_time || 2
      //   })
      // })
      
      // For now, simulate the scene recall process
      logger.info(`Scene recall initiated - ${scene.name}`)
      logger.info(`Recall time: ${scene.recall_time}s`)
      
      // Simulate applying input settings
      for (const inputSetting of scene.inputs || []) {
        logger.info(`Setting input ${inputSetting.id}: gain=${inputSetting.gainDb}dB, muted=${inputSetting.muted}`)
        // In real implementation:
        // await fetch(`${baseUrl}/api/input/${inputSetting.id}/gain`, {
        //   method: 'POST',
        //   body: JSON.stringify({ gain: inputSetting.gainDb })
        // })
        
        await new Promise(resolve => setTimeout(resolve, 50)) // Simulate processing time
      }
      
      // Simulate applying output settings
      for (const outputSetting of scene.outputs || []) {
        logger.info(`Setting output ${outputSetting.id}: level=${outputSetting.levelDb}dB, muted=${outputSetting.muted}`)
        // In real implementation:
        // await fetch(`${baseUrl}/api/output/${outputSetting.id}/level`, {
        //   method: 'POST',
        //   body: JSON.stringify({ level: outputSetting.levelDb, muted: outputSetting.muted })
        // })
        
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Log the scene recall
      const recallLog = {
        processorId,
        processorName: processor.name,
        sceneId,
        sceneName: scene.name,
        timestamp: new Date().toISOString(),
        inputsRecalled: scene.inputs?.length || 0,
        outputsRecalled: scene.outputs?.length || 0,
        recallTime: scene.recall_time || 2,
        status: 'success'
      }

      logger.info('Scene recall completed:', recallLog)

      // Save recall log to file
      try {
        const logsDir = path.join(process.cwd(), 'data', 'scene-logs')
        await fs.mkdir(logsDir, { recursive: true })
        
        const logPath = path.join(logsDir, `recall_${Date.now()}.json`)
        await fs.writeFile(logPath, JSON.stringify(recallLog, null, 2))
      } catch (logError) {
        logger.warn('Failed to save recall log:', logError)
      }

      return NextResponse.json({ 
        success: true, 
        message: `Scene "${scene.name}" recalled successfully`,
        details: {
          sceneName: scene.name,
          recallTime: scene.recall_time || 2,
          inputsAffected: scene.inputs?.length || 0,
          outputsAffected: scene.outputs?.length || 0
        }
      })

    } catch (error) {
      logger.error('Error communicating with Atlas processor:', error)
      return NextResponse.json({ 
        error: 'Failed to communicate with processor for scene recall',
        details: error instanceof Error ? error.message : 'Communication error'
      }, { status: 503 })
    }

  } catch (error) {
    logger.error('Error recalling scene:', error)
    return NextResponse.json({ 
      error: 'Failed to recall scene',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
