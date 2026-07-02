/**
 * High-level OBSBOT Tail 2 control — wraps the low-level VISCA client/queue
 * with the actual PTZ/zoom/preset operations the bartender panel needs.
 */

import { getViscaClient } from './visca-client-manager'
import * as visca from './visca-commands'
import { logger } from '@sports-bar/logger'

export interface ObsbotTail2Config {
  ipAddress: string
  viscaPort: number
}

export class ObsbotTail2 {
  constructor(private config: ObsbotTail2Config) {}

  /** Non-destructive connectivity check — does not move the camera. */
  async testConnection(): Promise<boolean> {
    try {
      const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
      await client.send(visca.versionInquiry())
      return true
    } catch (error) {
      logger.warn(`[OBSBOT] Connection test failed for ${this.config.ipAddress}:`, error)
      return false
    }
  }

  async move(pan: visca.PanDirection, tilt: visca.TiltDirection, speed = 12): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.panTiltDrive(pan, tilt, speed, speed))
  }

  async stop(): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.panTiltStop())
  }

  async zoom(direction: visca.ZoomDirection, speed = 4): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.zoom(direction, speed))
  }

  async home(): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.home())
  }

  async presetSave(slot: number): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.presetSave(slot))
  }

  async presetRecall(slot: number): Promise<void> {
    const client = await getViscaClient(this.config.ipAddress, this.config.viscaPort)
    await client.send(visca.presetRecall(slot))
  }
}
