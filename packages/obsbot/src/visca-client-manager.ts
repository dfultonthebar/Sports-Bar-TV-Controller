/**
 * Singleton manager for ViscaClient instances — one UDP socket per camera,
 * shared across every Next.js route bundle.
 *
 * CRITICAL — cross-bundle singleton (CLAUDE.md Gotcha #10). Next.js bundles
 * each API route handler separately; a per-module `private static instance`
 * would yield one manager PER BUNDLE, each binding its own UDP socket and
 * each only receiving replies addressed to its own ephemeral port. Hoist to
 * globalThis with Symbol.for() so every bundle shares one instance. Pattern
 * copied from packages/atlas/src/atlas-client-manager.ts, including its
 * per-key in-flight promise lock so two concurrent getClient() calls for the
 * same camera don't both pass the map-check before either inserts.
 */

import { ViscaClient } from './visca-client'
import { logger } from '@sports-bar/logger'

interface ManagedClient {
  client: ViscaClient
  lastUsed: Date
}

class ViscaClientManager {
  private clients: Map<string, ManagedClient> = new Map()
  private inFlight: Map<string, Promise<void>> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupIdleClients(), 5 * 60 * 1000)
  }

  public static getInstance(): ViscaClientManager {
    const KEY = Symbol.for('@sports-bar/obsbot/ViscaClientManager.instance')
    const g = globalThis as any
    if (!g[KEY]) g[KEY] = new ViscaClientManager()
    return g[KEY] as ViscaClientManager
  }

  public async getClient(ipAddress: string, port: number): Promise<ViscaClient> {
    const key = `${ipAddress}:${port}`

    const pending = this.inFlight.get(key)
    if (pending) await pending

    let managed = this.clients.get(key)
    if (managed) {
      managed.lastUsed = new Date()
      if (!managed.client.isConnected()) {
        logger.info(`[OBSBOT] Reconnecting VISCA client for ${key}`)
        await managed.client.connect()
      }
      return managed.client
    }

    logger.info(`[OBSBOT] Creating new VISCA client for ${key}`)
    const createPromise = (async () => {
      const client = new ViscaClient(ipAddress, port)
      await client.connect()
      this.clients.set(key, { client, lastUsed: new Date() })
    })()
    this.inFlight.set(key, createPromise.finally(() => this.inFlight.delete(key)))
    await this.inFlight.get(key)

    managed = this.clients.get(key)!
    managed.lastUsed = new Date()
    return managed.client
  }

  private cleanupIdleClients(): void {
    const idleTimeoutMs = 30 * 60 * 1000
    const now = Date.now()
    for (const [key, managed] of this.clients.entries()) {
      if (now - managed.lastUsed.getTime() > idleTimeoutMs) {
        logger.info(`[OBSBOT] Closing idle VISCA client for ${key}`)
        managed.client.disconnect()
        this.clients.delete(key)
      }
    }
  }
}

export const viscaClientManager = ViscaClientManager.getInstance()

export async function getViscaClient(ipAddress: string, port: number): Promise<ViscaClient> {
  return viscaClientManager.getClient(ipAddress, port)
}
