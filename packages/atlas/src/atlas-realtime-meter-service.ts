/**
 * Atlas Real-Time Meter Service
 * Handles real-time audio meter data via UDP subscriptions
 * Based on ATS006993-B specification
 */

import * as dgram from 'dgram'
import { EventEmitter } from 'events'
import { atlasLogger } from './atlas-logger'

import { logger } from '@sports-bar/logger'
export interface MeterData {
  param: string
  value: number
  timestamp: number
  type: 'input' | 'output' | 'group' | 'zone'
  index: number
  name?: string
}

export interface MeterSubscription {
  param: string
  format: 'val' | 'pct'
  type: 'input' | 'output' | 'group' | 'zone'
  index: number
}

/**
 * Real-time meter service using UDP for meter updates
 */
export class AtlasRealtimeMeterService extends EventEmitter {
  private udpSocket: dgram.Socket | null = null
  private subscriptions: Map<string, MeterSubscription> = new Map()
  private meterCache: Map<string, MeterData> = new Map()
  private isListening: boolean = false
  private readonly udpPort: number = 3131 // Atlas UDP meter port

  constructor() {
    super()
  }

  /**
   * Start listening for UDP meter updates
   */
  startListening(): void {
    if (this.isListening) {
      logger.info('Already listening for meter updates')
      return
    }

    this.udpSocket = dgram.createSocket('udp4')

    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = msg.toString().trim()
        const updates = data.split('\n').filter(line => line.length > 0)
        
        updates.forEach(update => {
          try {
            const parsed = JSON.parse(update)
            if (parsed.method === 'update' && parsed.params) {
              this.handleMeterUpdate(parsed.params)
            }
          } catch (e) {
            // Ignore parse errors for individual updates
          }
        })
      } catch (error) {
        logger.error('Error processing UDP meter data:', error)
      }
    })

    this.udpSocket.on('error', (err) => {
      logger.error('UDP socket error:', { data: err })
      this.emit('error', err)
    })

    this.udpSocket.bind(this.udpPort, () => {
      this.isListening = true
      logger.info(`Listening for Atlas meter updates on UDP port ${this.udpPort}`)
      this.emit('listening')
    })
  }

  /**
   * Stop listening for UDP meter updates
   */
  stopListening(): void {
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
      this.isListening = false
      logger.info('Stopped listening for meter updates')
      this.emit('stopped')
    }
  }

  /**
   * Handle incoming meter update
   */
  private handleMeterUpdate(params: any): void {
    const param = params.param
    const value = params.val !== undefined ? params.val : params.pct
    
    if (!param || value === undefined) return

    const subscription = this.subscriptions.get(param)
    if (!subscription) return

    const meterData: MeterData = {
      param,
      value,
      timestamp: Date.now(),
      type: subscription.type,
      index: subscription.index,
      name: subscription.param
    }

    this.meterCache.set(param, meterData)
    this.emit('meter-update', meterData)
  }

  /**
   * Add meter subscription
   */
  addSubscription(subscription: MeterSubscription): void {
    this.subscriptions.set(subscription.param, subscription)
  }

  /**
   * Remove meter subscription
   */
  removeSubscription(param: string): void {
    this.subscriptions.delete(param)
    this.meterCache.delete(param)
  }

  /**
   * Get current meter value from cache
   */
  getMeterValue(param: string): MeterData | null {
    return this.meterCache.get(param) || null
  }

  /**
   * Get all cached meter values
   */
  getAllMeterValues(): MeterData[] {
    return Array.from(this.meterCache.values())
  }

  /**
   * Clear all subscriptions and cache
   */
  clearAll(): void {
    this.subscriptions.clear()
    this.meterCache.clear()
  }
}

// Singleton instance
let meterServiceInstance: AtlasRealtimeMeterService | null = null

export function getRealtimeMeterService(): AtlasRealtimeMeterService {
  if (!meterServiceInstance) {
    meterServiceInstance = new AtlasRealtimeMeterService()
  }
  return meterServiceInstance
}

// Alias for backward compatibility
export const createRealtimeMeterService = getRealtimeMeterService
