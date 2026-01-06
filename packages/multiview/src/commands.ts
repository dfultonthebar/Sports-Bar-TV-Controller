/**
 * Multi-View Card Command Builder
 *
 * Builds hex commands for the HDTVSupply Multi-View card
 * Commands are sent via RS-232 serial at 115200 baud
 */

import { MultiViewMode, MultiViewInputAssignments } from './types'

/**
 * Command header bytes (fixed prefix for all commands)
 * EB 90 00 11 00 ff
 */
const COMMAND_HEADER = Buffer.from([0xEB, 0x90, 0x00, 0x11, 0x00, 0xFF])

/**
 * Mode command byte prefix
 * 32 [mode]
 */
const MODE_PREFIX = 0x32

/**
 * Build a mode change command
 *
 * Full format: EB 90 00 11 00 ff 32 [mode] 00 [in1] [in2] [in3] [in4] 00 00 00 00 00
 *
 * @param mode - Display mode (0-7)
 * @param inputs - Optional input assignments for windows 1-4
 * @returns Buffer containing the complete command
 */
export function buildModeCommand(
  mode: MultiViewMode,
  inputs?: MultiViewInputAssignments
): Buffer {
  const in1 = inputs?.window1 ?? 1
  const in2 = inputs?.window2 ?? 2
  const in3 = inputs?.window3 ?? 3
  const in4 = inputs?.window4 ?? 4

  const command = Buffer.alloc(18)

  // Copy header (6 bytes)
  COMMAND_HEADER.copy(command, 0)

  // Mode bytes (2 bytes)
  command[6] = MODE_PREFIX
  command[7] = mode

  // Separator (1 byte)
  command[8] = 0x00

  // Input assignments (4 bytes)
  command[9] = in1
  command[10] = in2
  command[11] = in3
  command[12] = in4

  // Padding (5 bytes)
  command[13] = 0x00
  command[14] = 0x00
  command[15] = 0x00
  command[16] = 0x00
  command[17] = 0x00

  return command
}

/**
 * Build an input swap command for a specific window
 *
 * @param windowNumber - Window to change (1-4)
 * @param inputNumber - Wolf Pack input to route to this window
 * @param currentMode - Current display mode
 * @param currentInputs - Current input assignments
 * @returns Buffer containing the command
 */
export function buildInputSwapCommand(
  windowNumber: 1 | 2 | 3 | 4,
  inputNumber: number,
  currentMode: MultiViewMode,
  currentInputs: MultiViewInputAssignments
): Buffer {
  const newInputs = { ...currentInputs }

  switch (windowNumber) {
    case 1: newInputs.window1 = inputNumber; break
    case 2: newInputs.window2 = inputNumber; break
    case 3: newInputs.window3 = inputNumber; break
    case 4: newInputs.window4 = inputNumber; break
  }

  return buildModeCommand(currentMode, newInputs)
}

/**
 * Build a query/status command
 * Note: The multi-view card may not support status queries via serial.
 * This is a placeholder for potential future use.
 *
 * @returns Buffer containing the query command
 */
export function buildStatusQuery(): Buffer {
  // GET HELP command in ASCII
  return Buffer.from('GET HELP\r\n')
}

/**
 * Convert a command buffer to a hex string for logging
 *
 * @param command - Command buffer
 * @returns Hex string representation
 */
export function commandToHexString(command: Buffer): string {
  return Array.from(command)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

/**
 * Parse a response from the multi-view card
 *
 * @param response - Response string from card
 * @returns Object with success status and parsed data
 */
export function parseResponse(response: string): { success: boolean; message: string } {
  const trimmed = response.trim().toUpperCase()

  if (trimmed === 'OK' || trimmed.includes('OK')) {
    return { success: true, message: 'Command executed successfully' }
  }

  if (trimmed === 'ERR' || trimmed.includes('ERR')) {
    return { success: false, message: 'Command error' }
  }

  // Unknown response - might be help text or other data
  return { success: true, message: response }
}

/**
 * Validate input number is within Wolf Pack range
 *
 * @param input - Input number to validate
 * @returns True if valid (1-36 for Wolf Pack 36x36)
 */
export function isValidInput(input: number): boolean {
  return Number.isInteger(input) && input >= 1 && input <= 36
}

/**
 * Validate mode is within supported range
 *
 * @param mode - Mode to validate
 * @returns True if valid (0-7)
 */
export function isValidMode(mode: number): boolean {
  return Number.isInteger(mode) && mode >= 0 && mode <= 7
}
