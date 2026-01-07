/**
 * Commercial Lighting Control Logger
 * Structured logging with [LIGHTING] component tags
 */

import { logger as baseLogger } from '@sports-bar/logger'

const COMPONENT = '[LIGHTING]'

/**
 * Commercial Lighting-specific logger with component tagging
 */
export const lightingLogger = {
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

  // Specialized logging methods for commercial lighting operations

  /**
   * Log system connection events
   */
  connection: (systemId: string, systemType: string, status: 'connected' | 'disconnected' | 'error', details?: Record<string, unknown>) => {
    const message = `${systemType} system ${systemId} ${status}`
    if (status === 'error') {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log scene recall events
   */
  sceneRecall: (systemType: string, sceneName: string, success: boolean, details?: Record<string, unknown>) => {
    const message = `[${systemType}] Scene "${sceneName}" recall ${success ? 'succeeded' : 'failed'}`
    if (success) {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log zone control events
   */
  zoneControl: (systemType: string, zoneName: string, level: number, success: boolean) => {
    const message = `[${systemType}] Zone "${zoneName}" set to ${level}% ${success ? 'succeeded' : 'failed'}`
    if (success) {
      baseLogger.info(`${COMPONENT} ${message}`)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`)
    }
  },

  /**
   * Log device control events
   */
  deviceControl: (systemType: string, deviceName: string, action: string, success: boolean, details?: Record<string, unknown>) => {
    const message = `[${systemType}] Device "${deviceName}" ${action} ${success ? 'succeeded' : 'failed'}`
    if (success) {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log Lutron LIP commands
   */
  lutronCommand: (command: string, response?: string, success?: boolean) => {
    const message = `[Lutron] Command: ${command}${response ? ` -> ${response}` : ''}`
    if (success === false) {
      baseLogger.error(`${COMPONENT} ${message}`)
    } else {
      baseLogger.debug(`${COMPONENT} ${message}`)
    }
  },

  /**
   * Log Hue API calls
   */
  hueApi: (method: string, path: string, success: boolean, details?: Record<string, unknown>) => {
    const message = `[Hue] ${method} ${path} ${success ? 'OK' : 'FAILED'}`
    if (success) {
      baseLogger.debug(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    }
  },

  /**
   * Log discovery events
   */
  discovery: (systemType: string, discovered: number, details?: Record<string, unknown>) => {
    baseLogger.info(`${COMPONENT} [${systemType}] Discovered ${discovered} device(s)`, details)
  },

  /**
   * Log pairing events
   */
  pairing: (systemType: string, status: 'started' | 'waiting' | 'success' | 'failed', details?: Record<string, unknown>) => {
    const message = `[${systemType}] Pairing ${status}`
    if (status === 'failed') {
      baseLogger.error(`${COMPONENT} ${message}`, details)
    } else {
      baseLogger.info(`${COMPONENT} ${message}`, details)
    }
  },
}

export { lightingLogger as logger }
