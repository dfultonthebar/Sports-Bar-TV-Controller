/**
 * Command Queue - Shared utility for sequential command execution
 * Prevents concurrent requests that could interfere with each other
 */

import { logger } from '@sports-bar/logger'

export class CommandQueue {
  private queue: (() => Promise<any>)[] = []
  private processing = false
  private delayMs: number
  private label: string

  constructor(options?: { delayMs?: number; label?: string }) {
    this.delayMs = options?.delayMs ?? 100
    this.label = options?.label ?? 'COMMAND-QUEUE'
  }

  async enqueue<T>(command: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await command()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const command = this.queue.shift()!
      try {
        await command()
      } catch (error) {
        logger.error(`[${this.label}] Command queue execution error`, { error })
      }

      // Delay between commands to prevent overwhelming the device
      await new Promise(resolve => setTimeout(resolve, this.delayMs))
    }

    this.processing = false
  }
}
