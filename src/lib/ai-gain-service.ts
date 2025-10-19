
import { prisma } from '@/lib/db'
import * as net from 'net'

interface AIGainConfig {
  id: string
  processorId: string
  inputNumber: number
  inputType: string
  aiEnabled: boolean
  targetLevel: number
  fastModeThreshold: number
  currentGain: number
  adjustmentMode: string
  silenceThreshold: number
  silenceDuration: number
  lastAudioDetected: Date | null
  fastModeStep: number
  slowModeStep: number
  adjustmentInterval: number
  minGain: number
  maxGain: number
  lastAdjustment: Date | null
  adjustmentCount: number
}

interface InputLevel {
  inputNumber: number
  currentLevel: number
  timestamp: Date
}

export class AIGainService {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private processorConnections: Map<string, net.Socket> = new Map()

  /**
   * Start monitoring and AI gain adjustment for a processor
   */
  async startMonitoring(processorId: string): Promise<void> {
    console.log(`Starting AI gain monitoring for processor ${processorId}`)

    // Stop existing monitoring if any
    this.stopMonitoring(processorId)

    // Get processor details
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
      throw new Error(`Processor ${processorId} not found`)
    }

    // Start monitoring interval (every 500ms)
    const interval = setInterval(async () => {
      try {
        await this.processAIGainAdjustments(processorId)
      } catch (error) {
        console.error(`Error in AI gain monitoring for ${processorId}:`, error)
      }
    }, 500)

    this.monitoringIntervals.set(processorId, interval)
    console.log(`AI gain monitoring started for processor ${processorId}`)
  }

  /**
   * Stop monitoring for a processor
   */
  stopMonitoring(processorId: string): void {
    const interval = this.monitoringIntervals.get(processorId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(processorId)
      console.log(`AI gain monitoring stopped for processor ${processorId}`)
    }

    const connection = this.processorConnections.get(processorId)
    if (connection) {
      connection.end()
      this.processorConnections.delete(processorId)
    }
  }

  /**
   * Process AI gain adjustments for all enabled inputs
   */
  private async processAIGainAdjustments(processorId: string): Promise<void> {
    // Get all AI-enabled configurations for this processor
    const aiConfigs = await prisma.aIGainConfiguration.findMany({
      where: {
        processorId: processorId,
        aiEnabled: true,
        inputType: 'line' // Only adjust line-level inputs, not microphones
      },
      include: {
        inputMeter: true
      }
    })

    if (aiConfigs.length === 0) {
      return // No AI-enabled inputs
    }

    // Get processor details
    const processor = await prisma.audioProcessor.findUnique({
      where: { id: processorId }
    })

    if (!processor) {
      return
    }

    // Process each AI-enabled input
    for (const config of aiConfigs) {
      try {
        await this.processInputAdjustment(processor, config)
      } catch (error) {
        console.error(`Error processing input ${config.inputNumber}:`, error)
      }
    }
  }

  /**
   * Process gain adjustment for a single input
   */
  private async processInputAdjustment(processor: any, config: any): Promise<void> {
    const inputMeter = config.inputMeter
    
    if (!inputMeter || !inputMeter.currentLevel) {
      return // No level data available
    }

    const currentLevel = inputMeter.currentLevel
    const currentGain = config.currentGain
    const targetLevel = config.targetLevel

    // Check if audio is present (above silence threshold)
    const isAudioPresent = currentLevel > config.silenceThreshold

    // Update last audio detected timestamp
    if (isAudioPresent) {
      await prisma.aIGainConfiguration.update({
        where: { id: config.id },
        data: { lastAudioDetected: new Date() }
      })
    }

    // Check if we should wait for audio
    if (!isAudioPresent) {
      const lastAudioTime = config.lastAudioDetected
      if (lastAudioTime) {
        const silenceDurationMs = Date.now() - lastAudioTime.getTime()
        const silenceThresholdMs = config.silenceDuration * 1000

        if (silenceDurationMs > silenceThresholdMs) {
          // Been silent too long, switch to waiting mode
          if (config.adjustmentMode !== 'waiting') {
            await prisma.aIGainConfiguration.update({
              where: { id: config.id },
              data: { adjustmentMode: 'waiting' }
            })
            console.log(`Input ${config.inputNumber}: Waiting for audio source`)
          }
          return // Don't adjust while waiting
        }
      }
    }

    // Check if adjustment is needed
    const levelDifference = targetLevel - currentLevel
    const tolerance = 0.5 // dB tolerance

    if (Math.abs(levelDifference) < tolerance) {
      // Level is within tolerance, mark as idle
      if (config.adjustmentMode !== 'idle') {
        await prisma.aIGainConfiguration.update({
          where: { id: config.id },
          data: { adjustmentMode: 'idle' }
        })
        console.log(`Input ${config.inputNumber}: Target level reached (${currentLevel.toFixed(1)}dB)`)
      }
      return
    }

    // Determine adjustment mode (fast or slow)
    let adjustmentMode: string
    let adjustmentStep: number

    if (currentLevel < config.fastModeThreshold) {
      // Fast mode: below -10dB
      adjustmentMode = 'fast'
      adjustmentStep = config.fastModeStep
    } else {
      // Slow mode: between -10dB and target
      adjustmentMode = 'slow'
      adjustmentStep = config.slowModeStep
    }

    // Calculate new gain
    let newGain = currentGain
    if (levelDifference > 0) {
      // Need to increase gain
      newGain = Math.min(currentGain + adjustmentStep, config.maxGain)
    } else {
      // Need to decrease gain
      newGain = Math.max(currentGain - adjustmentStep, config.minGain)
    }

    // Check if we've hit the limits
    if (newGain === currentGain) {
      console.log(`Input ${config.inputNumber}: Gain limit reached (${currentGain}dB)`)
      return
    }

    // Apply the gain adjustment
    try {
      await this.setInputGain(processor, config.inputNumber, newGain)

      // Update configuration
      await prisma.aIGainConfiguration.update({
        where: { id: config.id },
        data: {
          currentGain: newGain,
          adjustmentMode: adjustmentMode,
          lastAdjustment: new Date(),
          adjustmentCount: { increment: 1 }
        }
      })

      // Log the adjustment
      await prisma.aIGainAdjustmentLog.create({
        data: {
          configId: config.id,
          processorId: processor.id,
          inputNumber: config.inputNumber,
          previousGain: currentGain,
          newGain: newGain,
          gainChange: newGain - currentGain,
          inputLevel: currentLevel,
          targetLevel: targetLevel,
          adjustmentMode: adjustmentMode,
          reason: 'tracking',
          success: true
        }
      })

      console.log(
        `Input ${config.inputNumber}: Adjusted gain ${currentGain.toFixed(1)}dB → ${newGain.toFixed(1)}dB ` +
        `(level: ${currentLevel.toFixed(1)}dB, target: ${targetLevel.toFixed(1)}dB, mode: ${adjustmentMode})`
      )

    } catch (error) {
      console.error(`Failed to adjust gain for input ${config.inputNumber}:`, error)
      
      // Log the failed adjustment
      await prisma.aIGainAdjustmentLog.create({
        data: {
          configId: config.id,
          processorId: processor.id,
          inputNumber: config.inputNumber,
          previousGain: currentGain,
          newGain: newGain,
          gainChange: newGain - currentGain,
          inputLevel: currentLevel,
          targetLevel: targetLevel,
          adjustmentMode: adjustmentMode,
          reason: 'tracking',
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }

  /**
   * Set input gain on the processor
   * Uses Atlas protocol: SourceGain_X with 0-based indexing
   * @param processor Processor configuration
   * @param inputNumber Input number (1-based from UI)
   * @param gain Gain in dB
   */
  private async setInputGain(processor: any, inputNumber: number, gain: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket()

      client.connect(5321, processor.ipAddress, () => {
        // Convert 1-based UI input number to 0-based Atlas index
        const atlasIndex = inputNumber - 1
        
        const command = {
          jsonrpc: "2.0",
          id: 1,
          method: "set",
          params: {
            param: `SourceGain_${atlasIndex}`,  // Fixed: Use SourceGain_X with 0-based indexing
            val: gain
          }
        }

        console.log(`[AI Gain Service] Setting input ${inputNumber} (atlas index ${atlasIndex}) gain to ${gain}dB`)
        client.write(JSON.stringify(command) + '\r\n')  // Fixed: Use \r\n as per Atlas protocol
      })

      client.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString())
          client.end()
          if (response.error) {
            reject(new Error(response.error.message || 'Failed to set gain'))
          } else {
            resolve()
          }
        } catch (error) {
          client.end()
          reject(error)
        }
      })

      client.on('error', (error) => {
        reject(error)
      })

      setTimeout(() => {
        client.end()
        reject(new Error('Set gain timeout'))
      }, 3000)
    })
  }

  /**
   * Get adjustment history for an input
   */
  async getAdjustmentHistory(
    processorId: string, 
    inputNumber: number, 
    limit: number = 100
  ): Promise<any[]> {
    return await prisma.aIGainAdjustmentLog.findMany({
      where: {
        processorId: processorId,
        inputNumber: inputNumber
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    })
  }

  /**
   * Get current status of all AI-enabled inputs
   */
  async getAIGainStatus(processorId: string): Promise<any[]> {
    const configs = await prisma.aIGainConfiguration.findMany({
      where: {
        processorId: processorId,
        aiEnabled: true
      },
      include: {
        inputMeter: true
      },
      orderBy: {
        inputNumber: 'asc'
      }
    })

    return configs.map(config => ({
      inputNumber: config.inputNumber,
      inputType: config.inputType,
      currentLevel: config.inputMeter?.currentLevel || null,
      currentGain: config.currentGain,
      targetLevel: config.targetLevel,
      adjustmentMode: config.adjustmentMode,
      lastAdjustment: config.lastAdjustment,
      adjustmentCount: config.adjustmentCount
    }))
  }
}

// Singleton instance
export const aiGainService = new AIGainService()
