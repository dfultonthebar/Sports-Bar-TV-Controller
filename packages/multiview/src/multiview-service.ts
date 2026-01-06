/**
 * Multi-View Card Service
 *
 * High-level service for controlling Wolf Pack Multi-View cards
 */

import { logger } from '@sports-bar/logger'
import { MultiViewSerialClient, listSerialPorts, checkSerialPort } from './serial-client'
import {
  MultiViewMode,
  MultiViewCardConfig,
  MultiViewInputAssignments,
  MultiViewCommandResult,
  MULTIVIEW_MODE_NAMES
} from './types'
import { buildModeCommand, buildInputSwapCommand, isValidInput, isValidMode } from './commands'

// Cache of serial clients by device path
const clientCache: Map<string, MultiViewSerialClient> = new Map()

/**
 * Get or create a serial client for a device path
 */
function getClient(serialPort: string, baudRate: number): MultiViewSerialClient {
  const cacheKey = `${serialPort}:${baudRate}`

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new MultiViewSerialClient(serialPort, baudRate))
  }

  return clientCache.get(cacheKey)!
}

/**
 * Set the display mode on a multi-view card
 *
 * @param config - Card configuration
 * @param mode - Target display mode (0-7)
 * @param inputs - Optional input assignments
 */
export async function setMode(
  config: MultiViewCardConfig,
  mode: MultiViewMode,
  inputs?: MultiViewInputAssignments
): Promise<MultiViewCommandResult> {
  if (!isValidMode(mode)) {
    return { success: false, message: `Invalid mode: ${mode}. Must be 0-7.` }
  }

  const client = getClient(config.serialPort, config.baudRate)
  const command = buildModeCommand(mode, inputs ?? config.inputAssignments ?? undefined)

  logger.info(`[MULTIVIEW] Setting ${config.name} to mode ${mode} (${MULTIVIEW_MODE_NAMES[mode]})`)

  const result = await client.sendCommand(command)

  if (result.success) {
    logger.info(`[MULTIVIEW] Mode change successful for ${config.name}`)
  } else {
    logger.error(`[MULTIVIEW] Mode change failed for ${config.name}: ${result.message}`)
  }

  return result
}

/**
 * Change input for a specific window
 *
 * @param config - Card configuration
 * @param windowNumber - Window to change (1-4)
 * @param inputNumber - Wolf Pack input to route
 */
export async function setWindowInput(
  config: MultiViewCardConfig,
  windowNumber: 1 | 2 | 3 | 4,
  inputNumber: number
): Promise<MultiViewCommandResult> {
  if (!isValidInput(inputNumber)) {
    return { success: false, message: `Invalid input: ${inputNumber}. Must be 1-36.` }
  }

  if (!config.inputAssignments) {
    return { success: false, message: 'No current input assignments. Set mode first.' }
  }

  const client = getClient(config.serialPort, config.baudRate)
  const command = buildInputSwapCommand(
    windowNumber,
    inputNumber,
    config.currentMode,
    config.inputAssignments
  )

  logger.info(`[MULTIVIEW] Setting ${config.name} window ${windowNumber} to input ${inputNumber}`)

  return client.sendCommand(command)
}

/**
 * Test connection to a multi-view card
 *
 * @param serialPort - Serial port path
 * @param baudRate - Baud rate (default 115200)
 */
export async function testConnection(
  serialPort: string,
  baudRate: number = 115200
): Promise<MultiViewCommandResult> {
  // First check if port exists
  const portExists = await checkSerialPort(serialPort)
  if (!portExists) {
    return { success: false, message: `Serial port ${serialPort} not found` }
  }

  const client = getClient(serialPort, baudRate)
  return client.testConnection()
}

/**
 * Get available serial ports for multi-view cards
 */
export async function getAvailablePorts(): Promise<{ path: string; manufacturer?: string }[]> {
  return listSerialPorts()
}

/**
 * Disconnect a specific client
 */
export async function disconnect(serialPort: string, baudRate: number = 115200): Promise<void> {
  const cacheKey = `${serialPort}:${baudRate}`
  const client = clientCache.get(cacheKey)

  if (client) {
    await client.disconnect()
    clientCache.delete(cacheKey)
  }
}

/**
 * Disconnect all clients
 */
export async function disconnectAll(): Promise<void> {
  for (const [key, client] of clientCache) {
    await client.disconnect()
  }
  clientCache.clear()
}

/**
 * Quick mode presets for common scenarios
 */
export const MULTIVIEW_PRESETS = {
  /**
   * Single game focus - full screen
   */
  singleGame: (config: MultiViewCardConfig, input: number) =>
    setMode(config, MultiViewMode.SINGLE, {
      window1: input,
      window2: input,
      window3: input,
      window4: input
    }),

  /**
   * Two games side by side
   */
  twoGames: (config: MultiViewCardConfig, input1: number, input2: number) =>
    setMode(config, MultiViewMode.SPLIT_2, {
      window1: input1,
      window2: input2,
      window3: input1,
      window4: input2
    }),

  /**
   * Main game with score ticker PIP
   */
  mainWithPIP: (config: MultiViewCardConfig, mainInput: number, pipInput: number) =>
    setMode(config, MultiViewMode.PIP_RIGHT_BOTTOM, {
      window1: mainInput,
      window2: pipInput,
      window3: mainInput,
      window4: pipInput
    }),

  /**
   * Four games in quad view
   */
  quadGames: (
    config: MultiViewCardConfig,
    input1: number,
    input2: number,
    input3: number,
    input4: number
  ) =>
    setMode(config, MultiViewMode.QUAD, {
      window1: input1,
      window2: input2,
      window3: input3,
      window4: input4
    })
}
