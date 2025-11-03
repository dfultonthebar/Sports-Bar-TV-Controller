
// Enhanced CEC command library with extended functionality

export type CECCommand = 
  // Power commands
  | 'power_on'
  | 'power_off'
  | 'standby'
  // Volume commands
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'unmute'
  | 'volume_toggle_mute'
  // Input/Source commands
  | 'set_stream_path'
  | 'active_source'
  | 'inactive_source'
  // Navigation commands
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'exit'
  | 'root_menu'
  | 'setup_menu'
  | 'contents_menu'
  | 'favorite_menu'
  // Playback commands
  | 'play'
  | 'pause'
  | 'stop'
  | 'fast_forward'
  | 'rewind'
  | 'record'
  // System commands
  | 'give_device_power_status'
  | 'give_osd_name'
  | 'give_physical_address'
  | 'request_active_source'

export interface CECCommandMapping {
  command: CECCommand
  opcode: string
  hexCode: string
  description: string
  supportsParameter: boolean
}

export const CEC_COMMAND_MAPPINGS: CECCommandMapping[] = [
  // Power Commands
  { command: 'power_on', opcode: 'on', hexCode: '0x04', description: 'Power on the device', supportsParameter: false },
  { command: 'power_off', opcode: 'standby', hexCode: '0x36', description: 'Put device in standby', supportsParameter: false },
  { command: 'standby', opcode: 'standby', hexCode: '0x36', description: 'Put device in standby', supportsParameter: false },
  
  // Volume Commands
  { command: 'volume_up', opcode: 'volup', hexCode: '0x41', description: 'Increase volume', supportsParameter: false },
  { command: 'volume_down', opcode: 'voldown', hexCode: '0x42', description: 'Decrease volume', supportsParameter: false },
  { command: 'mute', opcode: 'mute', hexCode: '0x43', description: 'Mute audio', supportsParameter: false },
  { command: 'unmute', opcode: 'mute', hexCode: '0x43', description: 'Unmute audio (same as mute)', supportsParameter: false },
  { command: 'volume_toggle_mute', opcode: 'mute', hexCode: '0x43', description: 'Toggle mute state', supportsParameter: false },
  
  // Input/Source Commands
  { command: 'set_stream_path', opcode: 'tx', hexCode: '0x86', description: 'Set active input source', supportsParameter: true },
  { command: 'active_source', opcode: 'as', hexCode: '0x82', description: 'Declare as active source', supportsParameter: true },
  { command: 'inactive_source', opcode: 'is', hexCode: '0x9D', description: 'Declare as inactive source', supportsParameter: true },
  
  // Navigation Commands
  { command: 'up', opcode: 'up', hexCode: '0x44:01', description: 'Navigate up', supportsParameter: false },
  { command: 'down', opcode: 'down', hexCode: '0x44:02', description: 'Navigate down', supportsParameter: false },
  { command: 'left', opcode: 'left', hexCode: '0x44:03', description: 'Navigate left', supportsParameter: false },
  { command: 'right', opcode: 'right', hexCode: '0x44:04', description: 'Navigate right', supportsParameter: false },
  { command: 'select', opcode: 'select', hexCode: '0x44:00', description: 'Select/OK', supportsParameter: false },
  { command: 'exit', opcode: 'exit', hexCode: '0x44:0D', description: 'Exit menu', supportsParameter: false },
  { command: 'root_menu', opcode: 'root', hexCode: '0x44:09', description: 'Open root menu', supportsParameter: false },
  { command: 'setup_menu', opcode: 'setup', hexCode: '0x44:0A', description: 'Open setup menu', supportsParameter: false },
  { command: 'contents_menu', opcode: 'contents', hexCode: '0x44:0B', description: 'Open contents menu', supportsParameter: false },
  { command: 'favorite_menu', opcode: 'favorite', hexCode: '0x44:0C', description: 'Open favorite menu', supportsParameter: false },
  
  // Playback Commands
  { command: 'play', opcode: 'play', hexCode: '0x44:24', description: 'Play', supportsParameter: false },
  { command: 'pause', opcode: 'pause', hexCode: '0x44:25', description: 'Pause', supportsParameter: false },
  { command: 'stop', opcode: 'stop', hexCode: '0x44:26', description: 'Stop', supportsParameter: false },
  { command: 'fast_forward', opcode: 'forward', hexCode: '0x44:2B', description: 'Fast forward', supportsParameter: false },
  { command: 'rewind', opcode: 'rewind', hexCode: '0x44:2C', description: 'Rewind', supportsParameter: false },
  { command: 'record', opcode: 'record', hexCode: '0x44:27', description: 'Record', supportsParameter: false },
  
  // System Query Commands
  { command: 'give_device_power_status', opcode: 'pow', hexCode: '0x8F', description: 'Query power status', supportsParameter: false },
  { command: 'give_osd_name', opcode: 'osd', hexCode: '0x46', description: 'Query device name', supportsParameter: false },
  { command: 'give_physical_address', opcode: 'pa', hexCode: '0x83', description: 'Query physical address', supportsParameter: false },
  { command: 'request_active_source', opcode: 'ras', hexCode: '0x85', description: 'Request active source', supportsParameter: false }
]

export const getCECCommandMapping = (command: CECCommand): CECCommandMapping | undefined => {
  return CEC_COMMAND_MAPPINGS.find(m => m.command === command)
}

export const getAllCECCommands = (): CECCommand[] => {
  return CEC_COMMAND_MAPPINGS.map(m => m.command)
}

export const getCECCommandsByCategory = () => {
  return {
    power: CEC_COMMAND_MAPPINGS.filter(m => ['power_on', 'power_off', 'standby'].includes(m.command)),
    volume: CEC_COMMAND_MAPPINGS.filter(m => ['volume_up', 'volume_down', 'mute', 'unmute', 'volume_toggle_mute'].includes(m.command)),
    input: CEC_COMMAND_MAPPINGS.filter(m => ['set_stream_path', 'active_source', 'inactive_source'].includes(m.command)),
    navigation: CEC_COMMAND_MAPPINGS.filter(m => ['up', 'down', 'left', 'right', 'select', 'exit', 'root_menu', 'setup_menu', 'contents_menu', 'favorite_menu'].includes(m.command)),
    playback: CEC_COMMAND_MAPPINGS.filter(m => ['play', 'pause', 'stop', 'fast_forward', 'rewind', 'record'].includes(m.command)),
    system: CEC_COMMAND_MAPPINGS.filter(m => ['give_device_power_status', 'give_osd_name', 'give_physical_address', 'request_active_source'].includes(m.command))
  }
}
