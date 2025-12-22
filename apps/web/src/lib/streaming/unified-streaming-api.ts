/**
 * Unified Streaming API - Web Application Bridge
 *
 * This file provides a bridge between the @sports-bar/streaming package
 * and the web application's streaming-service-manager.
 *
 * It configures the UnifiedStreamingAPI with a FireTV adapter that wraps
 * the streaming-service-manager for dependency injection.
 */

import {
  UnifiedStreamingAPI,
  FireTVAdapter,
  InstalledStreamingApp,
  UnifiedEvent,
  ServiceStatus
} from '@sports-bar/streaming'
import { streamingManager } from '@/services/streaming-service-manager'

/**
 * FireTV adapter implementation that wraps the streaming-service-manager
 */
class FireTVAdapterImpl implements FireTVAdapter {
  async getInstalledApps(
    deviceId: string,
    ipAddress: string,
    port: number = 5555
  ): Promise<InstalledStreamingApp[]> {
    return streamingManager.getInstalledApps(deviceId, ipAddress, port)
  }
}

/**
 * Create configured instance with FireTV adapter
 */
const fireTVAdapter = new FireTVAdapterImpl()
export const unifiedStreamingApi = UnifiedStreamingAPI.getInstance(fireTVAdapter)

/**
 * Re-export types for convenience
 */
export type { UnifiedEvent, ServiceStatus, FireTVAdapter, InstalledStreamingApp }
