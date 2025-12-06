/**
 * Atlas Client Manager - Singleton Pattern
 * 
 * Centralized management of Atlas TCP/UDP clients to prevent duplicate socket bindings.
 * Ensures only ONE UDP socket is bound to port 3131 per processor.
 * 
 * FIXES: EADDRINUSE error caused by multiple UDP socket bindings on port 3131
 */

import { AtlasTCPClient, AtlasConnectionConfig } from './atlasClient'
import { atlasLogger } from './atlas-logger'

interface ManagedClient {
  client: ExtendedAtlasClient
  processorId: string
  ipAddress: string
  refCount: number
  lastUsed: Date
}

type MeterUpdateCallback = (processorId: string, param: string, value: any, fullParams: any) => void | Promise<void>

/**
 * Extended Atlas client with callback support for meter updates
 */
class ExtendedAtlasClient extends AtlasTCPClient {
  private updateCallbacks: Set<MeterUpdateCallback> = new Set()
  private processorId: string
  
  constructor(config: AtlasConnectionConfig, processorId: string) {
    super(config)
    this.processorId = processorId
  }
  
  public addUpdateCallback(callback: MeterUpdateCallback): void {
    this.updateCallbacks.add(callback)
  }
  
  public removeUpdateCallback(callback: MeterUpdateCallback): void {
    this.updateCallbacks.delete(callback)
  }
  
  protected handleParameterUpdate(param: string, value: any, fullParams: any): void {
    // Call all registered callbacks
    for (const callback of this.updateCallbacks) {
      try {
        callback(this.processorId, param, value, fullParams)
      } catch (error) {
        atlasLogger.error('CALLBACK', 'Error in update callback', { error, param })
      }
    }
  }
}

/**
 * Singleton manager for Atlas clients
 * Prevents duplicate UDP socket creation on port 3131
 */
class AtlasClientManager {
  private static instance: AtlasClientManager
  private clients: Map<string, ManagedClient> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  
  private constructor() {
    // Start cleanup timer (check every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients()
    }, 300000) // 5 minutes
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): AtlasClientManager {
    if (!AtlasClientManager.instance) {
      AtlasClientManager.instance = new AtlasClientManager()
    }
    return AtlasClientManager.instance
  }
  
  /**
   * Get or create an Atlas client for a processor
   * This ensures only ONE client (and ONE UDP socket) exists per processor
   */
  public async getClient(processorId: string, config: AtlasConnectionConfig): Promise<ExtendedAtlasClient> {
    const key = `${config.ipAddress}:${config.tcpPort || 5321}`
    
    let managed = this.clients.get(key)
    
    if (managed) {
      // Client exists, increment ref count and return
      managed.refCount++
      managed.lastUsed = new Date()
      
      atlasLogger.info('CLIENT_MANAGER', 'Reusing existing Atlas client', {
        key,
        processorId,
        refCount: managed.refCount
      })
      
      // Reconnect if disconnected
      if (!managed.client.isConnected()) {
        atlasLogger.info('CLIENT_MANAGER', 'Reconnecting existing client', { key })
        await managed.client.connect()
      }
      
      return managed.client
    }
    
    // Create new client with UDP enabled (only the client manager should enable UDP)
    atlasLogger.info('CLIENT_MANAGER', 'Creating new Atlas client WITH UDP', {
      key,
      processorId
    })

    const clientConfig = {
      ...config,
      enableUdp: true  // Enable UDP for meter updates
    }
    const client = new ExtendedAtlasClient(clientConfig, processorId)
    await client.connect()
    
    managed = {
      client,
      processorId,
      ipAddress: config.ipAddress,
      refCount: 1,
      lastUsed: new Date()
    }
    
    this.clients.set(key, managed)
    
    return client
  }
  
  /**
   * Release a client (decrement ref count)
   * Client will be cleaned up when ref count reaches 0 and idle timeout expires
   */
  public releaseClient(ipAddress: string, tcpPort: number = 5321): void {
    const key = `${ipAddress}:${tcpPort}`
    const managed = this.clients.get(key)
    
    if (managed) {
      managed.refCount = Math.max(0, managed.refCount - 1)
      managed.lastUsed = new Date()
      
      atlasLogger.info('CLIENT_MANAGER', 'Released Atlas client', {
        key,
        refCount: managed.refCount
      })
    }
  }
  
  /**
   * Force disconnect a client
   */
  public async disconnectClient(ipAddress: string, tcpPort: number = 5321): Promise<void> {
    const key = `${ipAddress}:${tcpPort}`
    const managed = this.clients.get(key)
    
    if (managed) {
      atlasLogger.info('CLIENT_MANAGER', 'Force disconnecting Atlas client', { key })
      
      managed.client.disconnect()
      this.clients.delete(key)
    }
  }
  
  /**
   * Clean up idle clients with zero ref count
   */
  private cleanupIdleClients(): void {
    const now = new Date()
    const idleTimeout = 10 * 60 * 1000 // 10 minutes
    
    for (const [key, managed] of this.clients.entries()) {
      if (managed.refCount === 0) {
        const idleTime = now.getTime() - managed.lastUsed.getTime()
        
        if (idleTime > idleTimeout) {
          atlasLogger.info('CLIENT_MANAGER', 'Cleaning up idle client', {
            key,
            idleMinutes: Math.round(idleTime / 60000)
          })
          
          managed.client.disconnect()
          this.clients.delete(key)
        }
      }
    }
  }
  
  /**
   * Get all active clients (for debugging)
   */
  public getActiveClients(): Array<{key: string, processorId: string, refCount: number}> {
    return Array.from(this.clients.entries()).map(([key, managed]) => ({
      key,
      processorId: managed.processorId,
      refCount: managed.refCount
    }))
  }
  
  /**
   * Shutdown all clients
   */
  public shutdown(): void {
    atlasLogger.info('CLIENT_MANAGER', 'Shutting down all clients', {
      count: this.clients.size
    })
    
    for (const managed of this.clients.values()) {
      managed.client.disconnect()
    }
    
    this.clients.clear()
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Export singleton instance
export const atlasClientManager = AtlasClientManager.getInstance()

// Export types
export type { MeterUpdateCallback }

// Helper function for easy client access
export async function getAtlasClient(processorId: string, config: AtlasConnectionConfig): Promise<ExtendedAtlasClient> {
  return atlasClientManager.getClient(processorId, config)
}

export function releaseAtlasClient(ipAddress: string, tcpPort?: number): void {
  atlasClientManager.releaseClient(ipAddress, tcpPort)
}

export async function disconnectAtlasClient(ipAddress: string, tcpPort?: number): Promise<void> {
  return atlasClientManager.disconnectClient(ipAddress, tcpPort)
}
