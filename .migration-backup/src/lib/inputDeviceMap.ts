
// Input device mapping configuration
// Maps Wolfpack input labels to device types for channel preset detection

export interface InputDeviceMapping {
  inputLabel: string
  deviceType: 'cable' | 'directv' | 'other'
  deviceIp?: string // For DirecTV IP control
  description?: string
}

// Default mappings - these can be customized per installation
export const DEFAULT_INPUT_MAPPINGS: InputDeviceMapping[] = [
  {
    inputLabel: 'Cable Box',
    deviceType: 'cable',
    description: 'Standard cable box with IR control'
  },
  {
    inputLabel: 'Cable Box 1',
    deviceType: 'cable',
    description: 'Cable box #1'
  },
  {
    inputLabel: 'Cable Box 2',
    deviceType: 'cable',
    description: 'Cable box #2'
  },
  {
    inputLabel: 'DirecTV',
    deviceType: 'directv',
    description: 'DirecTV receiver with IP control'
  },
  {
    inputLabel: 'DirecTV Receiver',
    deviceType: 'directv',
    description: 'DirecTV receiver'
  },
  {
    inputLabel: 'Satellite',
    deviceType: 'directv',
    description: 'Satellite receiver (DirecTV)'
  },
  {
    inputLabel: 'Satellite Box',
    deviceType: 'directv',
    description: 'Satellite box'
  },
  {
    inputLabel: 'Genie',
    deviceType: 'directv',
    description: 'DirecTV Genie receiver'
  },
  {
    inputLabel: 'Genie Mini',
    deviceType: 'directv',
    description: 'DirecTV Genie Mini client'
  }
]

/**
 * Detect device type from input label
 * Returns the device type if the input is a Cable Box or DirecTV receiver
 */
export function detectDeviceType(inputLabel: string): 'cable' | 'directv' | 'other' {
  const normalizedLabel = inputLabel.toLowerCase().trim()
  
  // Check for exact matches first
  const exactMatch = DEFAULT_INPUT_MAPPINGS.find(
    mapping => mapping.inputLabel.toLowerCase() === normalizedLabel
  )
  
  if (exactMatch) {
    return exactMatch.deviceType
  }
  
  // Check for partial matches
  if (normalizedLabel.includes('cable')) {
    return 'cable'
  }
  
  if (
    normalizedLabel.includes('directv') ||
    normalizedLabel.includes('satellite') ||
    normalizedLabel.includes('genie')
  ) {
    return 'directv'
  }
  
  return 'other'
}

/**
 * Check if an input should trigger the channel preset popup
 */
export function shouldShowChannelPresets(inputLabel: string): boolean {
  const deviceType = detectDeviceType(inputLabel)
  return deviceType === 'cable' || deviceType === 'directv'
}

/**
 * Get device mapping for an input label
 */
export function getDeviceMapping(inputLabel: string): InputDeviceMapping | null {
  const normalizedLabel = inputLabel.toLowerCase().trim()
  
  return DEFAULT_INPUT_MAPPINGS.find(
    mapping => mapping.inputLabel.toLowerCase() === normalizedLabel
  ) || null
}
