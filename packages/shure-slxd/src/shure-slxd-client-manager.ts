/**
 * Shure SLX-D Client Manager — globalThis singleton + per-key race lock
 *
 * Same lesson as @sports-bar/atlas: Next.js App Router compiles each
 * route handler into its own bundle, so a `private static instance`
 * field yields ONE manager per bundle (each owning its own TCP socket
 * to the receiver). We hoist the singleton to `globalThis` via
 * Symbol.for() so every bundle's lookup hits the same slot.
 *
 * See CLAUDE.md Gotcha #10 + atlas-client-manager.ts for the full
 * incident report.
 */

import { logger } from '@sports-bar/logger'
import { ShureSlxdClient } from './shure-slxd-client'
import { SHURE_NETWORK_CONFIG } from './config'
import type { ShureSlxdClientConfig, ShureReceiverSnapshot } from './types'

interface ManagedClient {
  client: ShureSlxdClient
  receiverId: string
  ipAddress: string
  port: number
  refCount: number
  lastUsed: number
}

class ShureSlxdClientManager {
  private clients: Map<string, ManagedClient> = new Map()
  private inFlight: Map<string, Promise<void>> = new Map()
  private cleanupTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupIdle(), 5 * 60 * 1000)
  }

  static getInstance(): ShureSlxdClientManager {
    const KEY = Symbol.for('@sports-bar/shure-slxd/ShureSlxdClientManager.instance')
    const g = globalThis as any
    if (!g[KEY]) g[KEY] = new ShureSlxdClientManager()
    return g[KEY] as ShureSlxdClientManager
  }

  /**
   * Get-or-create a connected client for an IP:port. Concurrent callers
   * for the same key converge on the same instance via the in-flight
   * Promise lock (closes the race window we hit on Atlas v2.33.51).
   */
  async getClient(receiverId: string, config: ShureSlxdClientConfig): Promise<ShureSlxdClient> {
    const port = config.port ?? SHURE_NETWORK_CONFIG.TCP_PORT
    const key = `${config.ipAddress}:${port}`

    const pending = this.inFlight.get(key)
    if (pending) await pending

    let managed = this.clients.get(key)
    if (managed) {
      managed.refCount += 1
      managed.lastUsed = Date.now()
      if (!managed.client.isConnected()) {
        // Same in-flight Promise lock around the RECONNECT path as
        // around the CREATE path — without this, two concurrent
        // getClient() calls on a disconnected client both call
        // client.connect() concurrently. Atlas hit this exact race
        // in v2.33.50 (duplicate TCP/UDP sockets per receiver).
        const reconnectPending = this.inFlight.get(key)
        if (reconnectPending) {
          await reconnectPending
        } else {
          const reconnectPromise = managed.client.connect()
          this.inFlight.set(key, reconnectPromise.finally(() => this.inFlight.delete(key)))
          await reconnectPromise
        }
      }
      return managed.client
    }

    const createPromise = (async () => {
      const client = new ShureSlxdClient({ ...config, receiverId })
      await client.connect()
      this.clients.set(key, {
        client,
        receiverId,
        ipAddress: config.ipAddress,
        port,
        refCount: 0,
        lastUsed: Date.now(),
      })
    })()
    this.inFlight.set(key, createPromise.finally(() => this.inFlight.delete(key)))
    await this.inFlight.get(key)

    managed = this.clients.get(key)!
    managed.refCount += 1
    managed.lastUsed = Date.now()
    return managed.client
  }

  releaseClient(ipAddress: string, port: number = SHURE_NETWORK_CONFIG.TCP_PORT): void {
    const key = `${ipAddress}:${port}`
    const managed = this.clients.get(key)
    if (!managed) return
    managed.refCount = Math.max(0, managed.refCount - 1)
    managed.lastUsed = Date.now()
  }

  async disconnectClient(ipAddress: string, port: number = SHURE_NETWORK_CONFIG.TCP_PORT): Promise<void> {
    const key = `${ipAddress}:${port}`
    const managed = this.clients.get(key)
    if (!managed) return
    managed.client.disconnect()
    this.clients.delete(key)
  }

  /**
   * Snapshot all live clients. Useful for `/api/shure-rf` to list
   * the receivers being monitored.
   */
  listClients(): Array<{ receiverId: string; ipAddress: string; port: number; refCount: number; connected: boolean }> {
    return Array.from(this.clients.values()).map((m) => ({
      receiverId: m.receiverId,
      ipAddress: m.ipAddress,
      port: m.port,
      refCount: m.refCount,
      connected: m.client.isConnected(),
    }))
  }

  /**
   * Full per-receiver state snapshot including receiver-scope metadata
   * (model, firmware, RF band) and every channel's current state.
   * Powers `/api/shure-rf/status` and the bartender battery+RSSI tile.
   * Return type ShureReceiverSnapshot is exported from `./types` so
   * the consuming endpoint + UI component share a single source.
   */
  getSnapshots(): ShureReceiverSnapshot[] {
    return Array.from(this.clients.values()).map((m) => {
      const receiver = m.client.getReceiverState()
      const states = m.client.getAllChannelStates()
      return {
        receiverId: m.receiverId,
        receiverName: m.client.receiverName,
        ipAddress: m.ipAddress,
        port: m.port,
        connected: m.client.isConnected(),
        model: receiver.model,
        firmwareVersion: receiver.firmwareVersion,
        rfBand: receiver.rfBand,
        deviceId: receiver.deviceId,
        channels: Array.from(states.values()).sort((a, b) => a.channel - b.channel),
      }
    })
  }

  private cleanupIdle(): void {
    const idleLimitMs = 10 * 60 * 1000
    const now = Date.now()
    for (const [key, managed] of this.clients.entries()) {
      if (managed.refCount === 0 && now - managed.lastUsed > idleLimitMs) {
        logger.info(`[SHURE-SLXD-MGR] Closing idle client ${key}`)
        managed.client.disconnect()
        this.clients.delete(key)
      }
    }
  }

  shutdown(): void {
    for (const managed of this.clients.values()) managed.client.disconnect()
    this.clients.clear()
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export const shureSlxdClientManager = ShureSlxdClientManager.getInstance()

export async function getShureSlxdClient(receiverId: string, config: ShureSlxdClientConfig): Promise<ShureSlxdClient> {
  return shureSlxdClientManager.getClient(receiverId, config)
}

export function releaseShureSlxdClient(ipAddress: string, port?: number): void {
  shureSlxdClientManager.releaseClient(ipAddress, port)
}

export async function disconnectShureSlxdClient(ipAddress: string, port?: number): Promise<void> {
  return shureSlxdClientManager.disconnectClient(ipAddress, port)
}
