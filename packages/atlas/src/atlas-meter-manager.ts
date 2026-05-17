/**
 * Atlas Meter Manager - Persistent Meter Subscriptions
 *
 * Maintains persistent connections to Atlas processors and subscribes to all meters.
 * Caches meter values as they arrive via UDP for instant API responses.
 */

import { getAtlasClient, releaseAtlasClient, type MeterUpdateCallback } from './atlas-client-manager'
import { atlasLogger } from './atlas-logger'
import { logger } from '@sports-bar/logger'

interface MeterValue {
  param: string
  value: number
  timestamp: number
}

interface ProcessorMeterCache {
  processorId: string
  processorIp: string
  inputMeters: Map<string, MeterValue>
  outputMeters: Map<string, MeterValue>
  groupMeters: Map<string, MeterValue>
  subscribed: boolean
  lastUpdate: number
}

/**
 * Singleton manager for Atlas meter subscriptions
 *
 * CRITICAL — cross-bundle singleton via globalThis. See the matching
 * note on AtlasClientManager. Without globalThis hoisting, each
 * Next.js route bundle had its own meter cache and its own UDP
 * subscription, so updates arriving on bundle A's socket never
 * reached bundle B's cache — the UI ended up reading stale frozen
 * values for hours (operator-caught 2026-05-17).
 */
export class AtlasMeterManager {
  private caches: Map<string, ProcessorMeterCache> = new Map()
  private updateCallbacks: Map<string, MeterUpdateCallback> = new Map()

  private constructor() {
    logger.info('[METER MANAGER] Atlas Meter Manager initialized')
  }

  public static getInstance(): AtlasMeterManager {
    const KEY = Symbol.for('@sports-bar/atlas/AtlasMeterManager.instance')
    const g = globalThis as any
    if (!g[KEY]) {
      g[KEY] = new AtlasMeterManager()
    }
    return g[KEY] as AtlasMeterManager
  }

  /**
   * Subscribe to all meters for a processor
   */
  public async subscribeToMeters(
    processorId: string,
    processorIp: string,
    inputCount: number = 14,
    outputCount: number = 8,
    groupCount: number = 8
  ): Promise<void> {
    const key = processorIp

    // Check if already subscribed
    let cache = this.caches.get(key)
    if (cache?.subscribed) {
      logger.debug(`[METER MANAGER] Already subscribed to ${processorIp}`)
      return
    }

    // Initialize cache
    if (!cache) {
      cache = {
        processorId,
        processorIp,
        inputMeters: new Map(),
        outputMeters: new Map(),
        groupMeters: new Map(),
        subscribed: false,
        lastUpdate: Date.now()
      }
      this.caches.set(key, cache)
    }

    try {
      // Get persistent client
      const client = await getAtlasClient(processorId, {
        ipAddress: processorIp,
        tcpPort: 5321,
        timeout: 10000
      })

      // Create callback for this processor
      const callback: MeterUpdateCallback = (procId, param, value, fullParams) => {
        this.handleMeterUpdate(processorIp, param, value)
      }

      // Register callback
      client.addUpdateCallback(callback)
      this.updateCallbacks.set(key, callback)

      logger.info(`[METER MANAGER] Subscribing to meters for ${processorIp}...`)

      // Subscribe to input meters
      for (let i = 0; i < inputCount; i++) {
        await client.subscribe(`SourceMeter_${i}`, 'val')
      }

      // Subscribe to output/zone meters
      for (let i = 0; i < outputCount; i++) {
        await client.subscribe(`ZoneMeter_${i}`, 'val')
      }

      // Subscribe to group meters
      for (let i = 0; i < groupCount; i++) {
        await client.subscribe(`GroupMeter_${i}`, 'val')
      }

      cache.subscribed = true

      logger.info(`[METER MANAGER] ✓ Subscribed to ${inputCount} input, ${outputCount} output, ${groupCount} group meters for ${processorIp}`)

      // Don't release client - keep it persistent for continuous updates

    } catch (error) {
      logger.error(`[METER MANAGER] Failed to subscribe to meters for ${processorIp}:`, error)
      throw error
    }
  }

  /**
   * Handle incoming meter update from UDP
   */
  private handleMeterUpdate(processorIp: string, param: string, value: any): void {
    const cache = this.caches.get(processorIp)
    if (!cache) {
      logger.warn(`[METER MANAGER] No cache for ${processorIp}, ignoring update for ${param}`)
      return
    }

    const meterValue: MeterValue = {
      param,
      value: typeof value === 'number' ? value : -80,
      timestamp: Date.now()
    }

    // Store in appropriate cache based on parameter name
    if (param.startsWith('SourceMeter_')) {
      cache.inputMeters.set(param, meterValue)
      logger.debug(`[METER MANAGER] Stored input: ${param} = ${value} dB`)
    } else if (param.startsWith('ZoneMeter_')) {
      cache.outputMeters.set(param, meterValue)
      logger.debug(`[METER MANAGER] Stored output: ${param} = ${value} dB`)
    } else if (param.startsWith('GroupMeter_')) {
      cache.groupMeters.set(param, meterValue)
      logger.debug(`[METER MANAGER] Stored group: ${param} = ${value} dB`)
    } else {
      logger.warn(`[METER MANAGER] Unknown meter param: ${param}`)
    }

    cache.lastUpdate = Date.now()
  }

  /**
   * Get input meters for a processor
   */
  public getInputMeters(processorIp: string, count: number = 14): Array<{index: number, name: string, level: number, peak: number, clipping: boolean}> {
    const cache = this.caches.get(processorIp)
    if (!cache) {
      logger.warn(`[METER MANAGER] No cache found for ${processorIp}`)
      return []
    }

    const meters = []
    for (let i = 0; i < count; i++) {
      const meterValue = cache.inputMeters.get(`SourceMeter_${i}`)
      const level = meterValue?.value ?? -80

      meters.push({
        index: i,
        name: `Input ${i + 1}`,
        level,
        peak: level,
        clipping: level > -3
      })
    }

    return meters
  }

  /**
   * Get output meters for a processor
   */
  public getOutputMeters(processorIp: string, count: number = 8): Array<{index: number, name: string, type: string, level: number, peak: number, clipping: boolean, muted: boolean}> {
    const cache = this.caches.get(processorIp)
    if (!cache) {
      logger.warn(`[METER MANAGER] No cache found for ${processorIp}`)
      return []
    }

    const meters = []
    for (let i = 0; i < count; i++) {
      const meterValue = cache.outputMeters.get(`ZoneMeter_${i}`)
      const level = meterValue?.value ?? -80

      meters.push({
        index: i,
        name: `Zone ${i + 1}`,
        type: 'output',
        level,
        peak: level,
        clipping: level > -3,
        muted: false // TODO: Track mute state
      })
    }

    return meters
  }

  /**
   * Get group meters for a processor
   */
  public getGroupMeters(processorIp: string, count: number = 8): Array<{index: number, name: string, type: string, level: number, peak: number, clipping: boolean, muted: boolean}> {
    const cache = this.caches.get(processorIp)
    if (!cache) {
      return []
    }

    const meters = []
    for (let i = 0; i < count; i++) {
      const meterValue = cache.groupMeters.get(`GroupMeter_${i}`)
      const level = meterValue?.value ?? -80

      meters.push({
        index: i,
        name: `Group ${i + 1}`,
        type: 'group',
        level,
        peak: level,
        clipping: level > -3,
        muted: false
      })
    }

    return meters
  }

  /**
   * Check if meters are subscribed for a processor
   */
  public isSubscribed(processorIp: string): boolean {
    return this.caches.get(processorIp)?.subscribed ?? false
  }

  /**
   * Get subscription status for debugging
   */
  public getStatus() {
    return Array.from(this.caches.entries()).map(([ip, cache]) => ({
      processorIp: ip,
      processorId: cache.processorId,
      subscribed: cache.subscribed,
      inputMeterCount: cache.inputMeters.size,
      outputMeterCount: cache.outputMeters.size,
      groupMeterCount: cache.groupMeters.size,
      lastUpdate: new Date(cache.lastUpdate).toISOString()
    }))
  }

  /**
   * Unsubscribe from meters for a processor.
   *
   * Note: we deliberately do NOT call getAtlasClient() to remove the
   * callback. getAtlasClient increments refCount; the matching
   * releaseAtlasClient below decrements by 1. Net effect was a leak
   * of +1 refCount per unsubscribe (caught 2026-05-17 audit) — the
   * managed client never reached 0 and was never cleaned up. Dropping
   * our cache entry and releasing the original subscribe reference is
   * sufficient; the callback registration dies with the client when
   * cleanupIdleClients eventually disconnects it.
   */
  public async unsubscribe(processorIp: string): Promise<void> {
    const cache = this.caches.get(processorIp)
    if (!cache) return

    this.updateCallbacks.delete(processorIp)
    releaseAtlasClient(processorIp)
    this.caches.delete(processorIp)

    logger.info(`[METER MANAGER] Unsubscribed from ${processorIp}`)
  }
}

// Export singleton
export const atlasMeterManager = AtlasMeterManager.getInstance()
