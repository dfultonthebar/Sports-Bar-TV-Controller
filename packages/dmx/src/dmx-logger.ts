/**
 * DMX Lighting Control Logger
 * Structured logging with [DMX] component tags
 */

import { logger as baseLogger } from '@sports-bar/logger'

const COMPONENT = '[DMX]'

/**
 * DMX-specific logger with component tagging
 */
export const dmxLogger = {
  info: (message: string, data?: Record<string, unknown>) => {
    baseLogger.info(`${COMPONENT} ${message}`, data)
  },

  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    if (error instanceof Error) {
      baseLogger.error(`${COMPONENT} ${message}`, { error, data })
    } else {
      baseLogger.error(`${COMPONENT} ${message}`, { error, data })
    }
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    baseLogger.warn(`${COMPONENT} ${message}`, data)
  },

  debug: (message: string, data?: Record<string, unknown>) => {
    baseLogger.debug(`${COMPONENT} ${message}`, data)
  },

  // Specialized logging methods for DMX operations

  /**
   * Log adapter connection events
   */
  connection: (adapterId: string, status: 'connected' | 'disconnected' | 'error', details?: Record<string, unknown>) => {
    const message = `Adapter ${adapterId} ${status}`
    if (status === 'error') {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log scene recall events
   */
  sceneRecall: (sceneName: string, success: boolean, details?: Record<string, unknown>) => {
    const message = `Scene "${sceneName}" recall ${success ? 'succeeded' : 'failed'}`
    if (success) {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log effect start/stop events
   */
  effect: (effectType: string, action: 'start' | 'stop', details?: Record<string, unknown>) => {
    baseLogger.info(`${COMPONENT} Effect "${effectType}" ${action}ed`, details)
  },

  /**
   * Log game event triggers
   */
  gameEvent: (eventType: string, triggered: boolean, details?: Record<string, unknown>) => {
    const message = `Game event "${eventType}" ${triggered ? 'triggered lighting' : 'ignored'}`
    baseLogger.info(`${COMPONENT} ${message}`, details)
  },

  /**
   * Log DMX frame output (debug level, can be very verbose)
   */
  frame: (universe: number, channelCount: number) => {
    baseLogger.debug(`${COMPONENT} Sent frame to universe ${universe} (${channelCount} channels)`)
  },

  /**
   * Log Maestro preset/function calls
   */
  maestro: (action: 'preset' | 'function', number: number, success: boolean) => {
    const message = `Maestro ${action} #${number} ${success ? 'activated' : 'failed'}`
    if (success) {
      baseLogger.info(`${COMPONENT} ${message}`)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`)
    }
  },
}

export { dmxLogger as logger }
