/**
 * Atlas Communication Logger
 * 
 * Provides comprehensive logging for all Atlas TCP communication
 * Logs to: ~/Sports-Bar-TV-Controller/log/atlas-communication.log
 */

import fs from 'fs'
import path from 'path'

import { logger } from '@/lib/logger'
const LOG_DIR = path.join(process.cwd(), 'log')
const LOG_FILE = path.join(LOG_DIR, 'atlas-communication.log')

// Ensure log directory exists
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

// Format timestamp
function timestamp(): string {
  return new Date().toISOString()
}

// Write to log file and console
function writeLog(level: string, category: string, message: string, data?: any) {
  ensureLogDir()
  
  const logEntry = {
    timestamp: timestamp(),
    level,
    category,
    message,
    ...(data && { data })
  }
  
  const logLine = `[${logEntry.timestamp}] [${level}] [${category}] ${message}${
    data ? ' | ' + JSON.stringify(data, null, 2) : ''
  }\n`
  
  // Write to console
  if (level === 'ERROR') {
    logger.error(logLine)
  } else if (level === 'WARN') {
    logger.warn(logLine)
  } else {
    logger.info(logLine)
  }
  
  // Write to file
  try {
    fs.appendFileSync(LOG_FILE, logLine)
  } catch (error) {
    logger.error('Failed to write to atlas-communication.log:', error)
  }
}

export const atlasLogger = {
  /**
   * Log connection attempt
   */
  connectionAttempt(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Attempting to connect to Atlas processor`, {
      ipAddress,
      port,
      protocol: 'TCP'
    })
  },

  /**
   * Log successful connection
   */
  connectionSuccess(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Successfully connected to Atlas processor`, {
      ipAddress,
      port,
      status: 'connected'
    })
  },

  /**
   * Log connection failure
   */
  connectionFailure(ipAddress: string, port: number, error: any) {
    writeLog('ERROR', 'CONNECTION', `Failed to connect to Atlas processor`, {
      ipAddress,
      port,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  },

  /**
   * Log connection closed
   */
  connectionClosed(ipAddress: string, port: number) {
    writeLog('INFO', 'CONNECTION', `Connection closed`, {
      ipAddress,
      port
    })
  },

  /**
   * Log command sent to processor
   */
  commandSent(command: any, ipAddress: string) {
    writeLog('DEBUG', 'COMMAND', `Sent command to Atlas processor`, {
      ipAddress,
      method: command.method,
      params: command.params,
      id: command.id,
      rawCommand: JSON.stringify(command)
    })
  },

  /**
   * Log response received from processor
   */
  responseReceived(response: any, ipAddress: string) {
    writeLog('DEBUG', 'RESPONSE', `Received response from Atlas processor`, {
      ipAddress,
      response: response,
      hasError: !!response.error,
      hasResult: !!response.result
    })
  },

  /**
   * Log command timeout
   */
  commandTimeout(commandId: number, ipAddress: string) {
    writeLog('ERROR', 'TIMEOUT', `Command timed out`, {
      ipAddress,
      commandId
    })
  },

  /**
   * Log parameter update (from subscription)
   */
  parameterUpdate(param: string, value: any, ipAddress: string) {
    writeLog('DEBUG', 'UPDATE', `Parameter update received`, {
      ipAddress,
      parameter: param,
      value
    })
  },

  /**
   * Log zone control action
   */
  zoneControl(action: string, zone: number, value: any, ipAddress: string) {
    writeLog('INFO', 'ZONE_CONTROL', `Zone control action`, {
      ipAddress,
      action,
      zone,
      value
    })
  },

  /**
   * Log input gain adjustment
   */
  inputGainAdjustment(inputNumber: number, gain: number, ipAddress: string) {
    writeLog('INFO', 'INPUT_GAIN', `Input gain adjusted`, {
      ipAddress,
      inputNumber,
      gain,
      unit: 'dB'
    })
  },

  /**
   * Log error
   */
  error(category: string, message: string, error: any) {
    writeLog('ERROR', category.toUpperCase(), message, {
      error: error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error)),
      stack: error instanceof Error ? error.stack : undefined
    })
  },

  /**
   * Log warning
   */
  warn(category: string, message: string, data?: any) {
    writeLog('WARN', category.toUpperCase(), message, data)
  },

  /**
   * Log info
   */
  info(category: string, message: string, data?: any) {
    writeLog('INFO', category.toUpperCase(), message, data)
  },

  /**
   * Log debug
   */
  debug(category: string, message: string, data?: any) {
    writeLog('DEBUG', category.toUpperCase(), message, data)
  }
}

// Export as default
export default atlasLogger
