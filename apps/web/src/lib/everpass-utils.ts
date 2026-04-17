/**
 * EverPass Streaming Box Utilities
 *
 * Types and helpers for EverPass device management with CEC control
 */

export interface EverPassDevice {
  id: string                    // everpass_<timestamp>_<random>
  name: string                  // "EverPass 1"
  cecDevicePath: string         // "/dev/ttyACM0" - Pulse-Eight USB path
  inputChannel: number          // Matrix input (e.g., 18)
  deviceModel?: string          // Hardware model if known
  isOnline: boolean             // Connection status
  lastSeen?: string             // ISO timestamp
  addedAt: string               // ISO timestamp
  updatedAt?: string            // ISO timestamp
}

export interface CECAdapter {
  path: string                  // "/dev/ttyACM0"
  vendor: string                // "Pulse-Eight"
  firmwareVersion?: string
  serialNumber?: string
}

/**
 * Generate unique ID for EverPass device
 */
export function generateEverPassDeviceId(): string {
  return `everpass_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * CEC User Control Codes for EverPass navigation
 * Reference: CEC specification Table 30 (User Control Codes)
 */
export const EVERPASS_CEC_COMMANDS: Record<string, number> = {
  // Navigation
  SELECT: 0x00,
  UP: 0x01,
  DOWN: 0x02,
  LEFT: 0x03,
  RIGHT: 0x04,

  // Menu controls
  ROOT_MENU: 0x09,
  SETUP_MENU: 0x0A,
  CONTENTS_MENU: 0x0B,
  EXIT: 0x0D,

  // Numeric (for potential channel entry)
  NUMBER_0: 0x20,
  NUMBER_1: 0x21,
  NUMBER_2: 0x22,
  NUMBER_3: 0x23,
  NUMBER_4: 0x24,
  NUMBER_5: 0x25,
  NUMBER_6: 0x26,
  NUMBER_7: 0x27,
  NUMBER_8: 0x28,
  NUMBER_9: 0x29,
  ENTER: 0x2B,

  // Info
  INFO: 0x35,
  GUIDE: 0x53,

  // Power
  POWER: 0x40,
  POWER_ON: 0x6D,
  POWER_OFF: 0x6C,

  // Volume (if CEC passthrough enabled)
  VOLUME_UP: 0x41,
  VOLUME_DOWN: 0x42,
  MUTE: 0x43,

  // Playback
  PLAY: 0x44,
  STOP: 0x45,
  PAUSE: 0x46,
  RECORD: 0x47,
  REWIND: 0x48,
  FAST_FORWARD: 0x49,
  SKIP_FORWARD: 0x4B,
  SKIP_BACKWARD: 0x4C,

  // Color buttons (for EverPass menus)
  F1_BLUE: 0x71,
  F2_RED: 0x72,
  F3_GREEN: 0x73,
  F4_YELLOW: 0x74,
}

/**
 * Command categories for UI organization
 */
export const EVERPASS_COMMAND_CATEGORIES = {
  navigation: ['up', 'down', 'left', 'right', 'select', 'exit'],
  menu: ['root_menu', 'setup_menu', 'contents_menu', 'guide', 'info'],
  playback: ['play', 'pause', 'stop', 'rewind', 'fast_forward', 'skip_forward', 'skip_backward'],
  power: ['power', 'power_on', 'power_off'],
  volume: ['volume_up', 'volume_down', 'mute'],
  color: ['f1_blue', 'f2_red', 'f3_green', 'f4_yellow'],
}

/**
 * Map command name to CEC code
 */
export function getCECCodeForCommand(command: string): number | undefined {
  const key = command.toUpperCase().replace(/-/g, '_')
  return EVERPASS_CEC_COMMANDS[key]
}

/**
 * Build CEC command string for cec-client
 * Format: tx <src>:<dest>:<opcode>:<data>
 *
 * Source: 4 (Playback Device 1)
 * Destination: 0 (TV) or F (Broadcast)
 * Opcode: 44 (User Control Pressed)
 */
export function buildCECCommand(cecCode: number, destination: string = '0'): string {
  const hexCode = cecCode.toString(16).padStart(2, '0')
  return `tx 4${destination}:44:${hexCode}`
}

/**
 * Build CEC key release command
 * Opcode: 45 (User Control Released)
 */
export function buildCECReleaseCommand(destination: string = '0'): string {
  return `tx 4${destination}:45`
}

/**
 * Validate CEC device path format
 */
export function isValidCECDevicePath(path: string): boolean {
  return /^\/dev\/tty(ACM|USB)\d+$/.test(path)
}

/**
 * Get display name for command
 */
export function getCommandDisplayName(command: string): string {
  const names: Record<string, string> = {
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
    select: 'OK/Select',
    exit: 'Back',
    root_menu: 'Menu',
    setup_menu: 'Setup',
    contents_menu: 'Contents',
    guide: 'Guide',
    info: 'Info',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    rewind: 'Rewind',
    fast_forward: 'Fast Forward',
    skip_forward: 'Skip Forward',
    skip_backward: 'Skip Back',
    power: 'Power',
    power_on: 'Power On',
    power_off: 'Power Off',
    volume_up: 'Vol +',
    volume_down: 'Vol -',
    mute: 'Mute',
    f1_blue: 'Blue',
    f2_red: 'Red',
    f3_green: 'Green',
    f4_yellow: 'Yellow',
  }
  return names[command.toLowerCase()] || command
}
