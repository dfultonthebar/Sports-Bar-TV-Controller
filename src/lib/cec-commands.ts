/**
 * CEC Command Mappings for TV Power Control
 *
 * This file contains CEC user control codes for controlling TVs
 * via HDMI-CEC. These codes are standardized in CEC specification 13.13.
 *
 * NOTE: Cable box CEC control has been deprecated as Spectrum/Charter
 * disables CEC in their firmware. Use IR control for cable boxes instead.
 */

export interface CECCommand {
  name: string
  code: string // Hex code for CEC command
  description: string
  category: 'navigation' | 'channel' | 'playback' | 'power' | 'number'
}

// CEC User Control Codes (from CEC Spec 13.13)
// Format: tx 40:44:XX where XX is the user control code
export const CEC_USER_CONTROL_CODES = {
  // Navigation Controls
  SELECT: '00',
  UP: '01',
  DOWN: '02',
  LEFT: '03',
  RIGHT: '04',
  ROOT_MENU: '09',
  SETUP_MENU: '0A',
  CONTENTS_MENU: '0B',
  FAVORITE_MENU: '0C',
  EXIT: '0D',

  // Channel Controls
  CHANNEL_UP: '30',
  CHANNEL_DOWN: '31',
  PREVIOUS_CHANNEL: '32',

  // Number Keys (0-9)
  NUMBER_0: '20',
  NUMBER_1: '21',
  NUMBER_2: '22',
  NUMBER_3: '23',
  NUMBER_4: '24',
  NUMBER_5: '25',
  NUMBER_6: '26',
  NUMBER_7: '27',
  NUMBER_8: '28',
  NUMBER_9: '29',
  DOT: '2A', // Decimal point for sub-channels
  ENTER: '2B', // Enter/confirm channel number

  // Playback Controls (for DVR functionality)
  PLAY: '44',
  STOP: '45',
  PAUSE: '46',
  RECORD: '47',
  REWIND: '48',
  FAST_FORWARD: '49',
  EJECT: '4A',
  FORWARD: '4B', // Skip forward
  BACKWARD: '4C', // Skip backward

  // Color Buttons (common on cable box remotes)
  F1_BLUE: '71',
  F2_RED: '72',
  F3_GREEN: '73',
  F4_YELLOW: '74',
  F5: '75',

  // Additional Controls
  INFO: '35', // Display program info
  GUIDE: '53', // Electronic program guide
  PAGE_UP: '54',
  PAGE_DOWN: '55',
  POWER: '40', // Power toggle
  VOLUME_UP: '41',
  VOLUME_DOWN: '42',
  MUTE: '43',

  // Spectrum-specific helpful codes
  HELP: '36',
  INPUT_SELECT: '34',
  DATA: '76', // Data button (on-demand, etc.)
} as const

// Helper function to build CEC transmit command
export function buildCECCommand(userControlCode: string): string {
  // CEC command format: tx [source]:[destination]:[opcode]:[params]
  // 4 = Playback Device (cable box typically registers as this)
  // 0 = TV
  // 44 = User Control Pressed opcode
  return `tx 40:44:${userControlCode}`
}

// Helper function to send number sequence for channel tuning
export function buildChannelSequence(channel: string): string[] {
  const commands: string[] = []

  // Remove any non-numeric characters except dot
  const cleanChannel = channel.replace(/[^0-9.]/g, '')

  // Convert each digit to a CEC command
  for (const char of cleanChannel) {
    if (char === '.') {
      commands.push(buildCECCommand(CEC_USER_CONTROL_CODES.DOT))
    } else {
      const digit = parseInt(char, 10)
      const code = CEC_USER_CONTROL_CODES[`NUMBER_${digit}` as keyof typeof CEC_USER_CONTROL_CODES]
      commands.push(buildCECCommand(code))
    }
  }

  // Add ENTER command at the end to confirm channel
  commands.push(buildCECCommand(CEC_USER_CONTROL_CODES.ENTER))

  return commands
}

// TV Power Control Commands
// DEPRECATED: SPECTRUM_COMMANDS removed - use IR control for cable boxes
// Only TV power control commands are supported via CEC
export const TV_POWER_COMMANDS = {
  powerOn: () => buildCECCommand(CEC_USER_CONTROL_CODES.POWER),
  powerOff: () => buildCECCommand(CEC_USER_CONTROL_CODES.POWER),
  powerToggle: () => buildCECCommand(CEC_USER_CONTROL_CODES.POWER),
}

// Command execution delays (milliseconds between commands)
export const CEC_DELAYS = {
  BETWEEN_DIGITS: 150, // Delay between digit presses when entering channel
  AFTER_ENTER: 500, // Wait after pressing Enter
  BETWEEN_COMMANDS: 100, // General delay between commands
  CHANNEL_CHANGE_TIMEOUT: 3000, // Max time to wait for channel change
}

// Command categories for UI grouping
export const CEC_COMMAND_CATEGORIES: Record<string, CECCommand[]> = {
  navigation: [
    { name: 'Up', code: CEC_USER_CONTROL_CODES.UP, description: 'Navigate up', category: 'navigation' },
    { name: 'Down', code: CEC_USER_CONTROL_CODES.DOWN, description: 'Navigate down', category: 'navigation' },
    { name: 'Left', code: CEC_USER_CONTROL_CODES.LEFT, description: 'Navigate left', category: 'navigation' },
    { name: 'Right', code: CEC_USER_CONTROL_CODES.RIGHT, description: 'Navigate right', category: 'navigation' },
    { name: 'Select', code: CEC_USER_CONTROL_CODES.SELECT, description: 'Select/OK', category: 'navigation' },
    { name: 'Menu', code: CEC_USER_CONTROL_CODES.ROOT_MENU, description: 'Main menu', category: 'navigation' },
    { name: 'Exit', code: CEC_USER_CONTROL_CODES.EXIT, description: 'Exit/Back', category: 'navigation' },
    { name: 'Guide', code: CEC_USER_CONTROL_CODES.GUIDE, description: 'Program guide', category: 'navigation' },
    { name: 'Info', code: CEC_USER_CONTROL_CODES.INFO, description: 'Program info', category: 'navigation' },
  ],
  channel: [
    { name: 'Channel Up', code: CEC_USER_CONTROL_CODES.CHANNEL_UP, description: 'Next channel', category: 'channel' },
    { name: 'Channel Down', code: CEC_USER_CONTROL_CODES.CHANNEL_DOWN, description: 'Previous channel', category: 'channel' },
    { name: 'Last Channel', code: CEC_USER_CONTROL_CODES.PREVIOUS_CHANNEL, description: 'Return to last channel', category: 'channel' },
  ],
  playback: [
    { name: 'Play', code: CEC_USER_CONTROL_CODES.PLAY, description: 'Play', category: 'playback' },
    { name: 'Pause', code: CEC_USER_CONTROL_CODES.PAUSE, description: 'Pause', category: 'playback' },
    { name: 'Stop', code: CEC_USER_CONTROL_CODES.STOP, description: 'Stop', category: 'playback' },
    { name: 'Rewind', code: CEC_USER_CONTROL_CODES.REWIND, description: 'Rewind', category: 'playback' },
    { name: 'Fast Forward', code: CEC_USER_CONTROL_CODES.FAST_FORWARD, description: 'Fast forward', category: 'playback' },
    { name: 'Record', code: CEC_USER_CONTROL_CODES.RECORD, description: 'Record', category: 'playback' },
  ],
  numbers: [
    { name: '0', code: CEC_USER_CONTROL_CODES.NUMBER_0, description: 'Number 0', category: 'number' },
    { name: '1', code: CEC_USER_CONTROL_CODES.NUMBER_1, description: 'Number 1', category: 'number' },
    { name: '2', code: CEC_USER_CONTROL_CODES.NUMBER_2, description: 'Number 2', category: 'number' },
    { name: '3', code: CEC_USER_CONTROL_CODES.NUMBER_3, description: 'Number 3', category: 'number' },
    { name: '4', code: CEC_USER_CONTROL_CODES.NUMBER_4, description: 'Number 4', category: 'number' },
    { name: '5', code: CEC_USER_CONTROL_CODES.NUMBER_5, description: 'Number 5', category: 'number' },
    { name: '6', code: CEC_USER_CONTROL_CODES.NUMBER_6, description: 'Number 6', category: 'number' },
    { name: '7', code: CEC_USER_CONTROL_CODES.NUMBER_7, description: 'Number 7', category: 'number' },
    { name: '8', code: CEC_USER_CONTROL_CODES.NUMBER_8, description: 'Number 8', category: 'number' },
    { name: '9', code: CEC_USER_CONTROL_CODES.NUMBER_9, description: 'Number 9', category: 'number' },
    { name: 'Enter', code: CEC_USER_CONTROL_CODES.ENTER, description: 'Enter/Confirm', category: 'number' },
  ],
}
