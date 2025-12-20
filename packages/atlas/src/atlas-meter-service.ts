/**
 * Atlas Audio Input Meter Monitoring Service
 * Collects and stores real-time audio level data from Atlas processors
 */

import { db, schema, eq, and, lt } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

interface MeterReading {
  inputNumber: number
  inputName: string
  level: number
  peak: number
  clipping: boolean
}

export class AtlasMeterService {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Start monitoring input levels for a processor
   */
  async startMonitoring(processorId: string, intervalMs: number = 5000) {
    // Stop existing monitoring if any
    this.stopMonitoring(processorId)

    logger.debug(`Starting Atlas meter monitoring for processor ${processorId}`)

    // Start periodic monitoring
    const interval = setInterval(async () => {
      try {
        await this.collectAndStoreMeterData(processorId)
      } catch (error) {
        logger.error(`Error collecting meter data for ${processorId}`, { error })
      }
    }, intervalMs)

    this.monitoringIntervals.set(processorId, interval)

    // Collect initial data immediately
    await this.collectAndStoreMeterData(processorId)
  }

  /**
   * Stop monitoring for a processor
   */
  stopMonitoring(processorId: string) {
    const interval = this.monitoringIntervals.get(processorId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(processorId)
      logger.debug(`Stopped Atlas meter monitoring for processor ${processorId}`)
    }
  }

  /**
   * Collect meter data from Atlas processor and store in database
   */
  private async collectAndStoreMeterData(processorId: string) {
    try {
      // Fetch processor info
      const processor = await db
        .select()
        .from(schema.audioProcessors)
        .where(eq(schema.audioProcessors.id, processorId))
        .limit(1)
        .get()

      if (!processor) {
        logger.error(`Processor ${processorId} not found`)
        return
      }

      // In a real implementation, this would query the actual Atlas hardware
      // For now, we'll generate simulated meter data based on the processor model
      const meterReadings = await this.fetchMeterDataFromAtlas(processor)

      // Store meter readings in database
      for (const reading of meterReadings) {
        // Check if record exists
        const existing = await db
          .select()
          .from(schema.audioInputMeters)
          .where(
            and(
              eq(schema.audioInputMeters.processorId, processor.id),
              eq(schema.audioInputMeters.inputNumber, reading.inputNumber)
            )
          )
          .limit(1)
          .get()

        if (existing) {
          // Update existing record
          await db
            .update(schema.audioInputMeters)
            .set({
              level: reading.level,
              peak: reading.peak,
              clipping: reading.clipping,
              timestamp: new Date().toISOString()
            })
            .where(eq(schema.audioInputMeters.id, existing.id))
            .run()
        } else {
          // Create new record
          await db
            .insert(schema.audioInputMeters)
            .values({
              processorId: processor.id,
              inputNumber: reading.inputNumber,
              inputName: reading.inputName,
              level: reading.level,
              peak: reading.peak,
              clipping: reading.clipping,
              timestamp: new Date().toISOString()
            })
            .run()
        }
      }

      // Update processor last seen
      await db
        .update(schema.audioProcessors)
        .set({
          lastSeen: new Date().toISOString(),
          status: 'online'
        })
        .where(eq(schema.audioProcessors.id, processor.id))
        .run()

      logger.debug(`Stored ${meterReadings.length} meter readings for ${processor.name}`)

    } catch (error) {
      logger.error(`Failed to collect meter data for ${processorId}`, { error })
    }
  }

  /**
   * Fetch meter data from actual Atlas hardware
   * This would use the Atlas API/protocol to get real-time levels
   */
  private async fetchMeterDataFromAtlas(processor: any): Promise<MeterReading[]> {
    // TODO: Implement actual Atlas API communication
    // For now, return simulated data based on processor model

    const inputCount = this.getInputCount(processor.model)
    const readings: MeterReading[] = []

    for (let i = 1; i <= inputCount; i++) {
      // Generate realistic audio levels (-60 to -6 dBFS)
      const baseLevel = -20 + (Math.random() * 10 - 5)
      const peak = baseLevel + (Math.random() * 3)
      const clipping = peak > -3

      readings.push({
        inputNumber: i,
        inputName: `Input ${i}`,
        level: baseLevel,
        peak: peak,
        clipping: clipping
      })
    }

    return readings
  }

  /**
   * Get input count for Atlas model
   */
  private getInputCount(model: string): number {
    const modelMap: { [key: string]: number } = {
      'AZM4': 4,
      'AZM8': 8,
      'AZMP4': 4,
      'AZMP8': 8,
      'Atmosphere': 12
    }

    return modelMap[model] || 8
  }

  /**
   * Clean up old meter data
   */
  async cleanupOldData(olderThanHours: number = 24) {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()

    const result = await db
      .delete(schema.audioInputMeters)
      .where(lt(schema.audioInputMeters.timestamp, cutoffDate))
      .run()

    const deletedCount = result.changes || 0
    logger.debug(`Cleaned up ${deletedCount} old meter readings`)
    return deletedCount
  }
}

// Export singleton instance
export const atlasMeterService = new AtlasMeterService()
