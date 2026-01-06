/**
 * Wolf Pack Multi-View Card Types
 *
 * HDTVSupply 4K60 Quad-View Output Card for Wolf Pack matrices
 * Control via RS-232 serial (USB adapter)
 */

// 8 display modes supported by the multi-view card
export enum MultiViewMode {
  SINGLE = 0,           // Single window (full screen)
  SPLIT_2 = 1,          // 2-window left/right split
  PIP_LEFT_TOP = 2,     // 2-window PIP (small window left top)
  PIP_RIGHT_BOTTOM = 3, // 2-window PIP (small window right bottom)
  THREE_TOP_1 = 4,      // 3-window (1 top, 2 bottom)
  THREE_ALT = 5,        // 3-window alternative layout
  THREE_PIP = 6,        // 3-window with PIP x2
  QUAD = 7              // 4-window 2x2 quad view
}

// Human-readable mode names
export const MULTIVIEW_MODE_NAMES: Record<MultiViewMode, string> = {
  [MultiViewMode.SINGLE]: 'Single Window',
  [MultiViewMode.SPLIT_2]: '2-Window Split',
  [MultiViewMode.PIP_LEFT_TOP]: 'PIP (Left Top)',
  [MultiViewMode.PIP_RIGHT_BOTTOM]: 'PIP (Right Bottom)',
  [MultiViewMode.THREE_TOP_1]: '3-Window (1 Top, 2 Bottom)',
  [MultiViewMode.THREE_ALT]: '3-Window Alternative',
  [MultiViewMode.THREE_PIP]: '3-Window PIP',
  [MultiViewMode.QUAD]: 'Quad View (2x2)'
}

// Mode descriptions for UI
export const MULTIVIEW_MODE_DESCRIPTIONS: Record<MultiViewMode, string> = {
  [MultiViewMode.SINGLE]: 'Display a single input full screen',
  [MultiViewMode.SPLIT_2]: 'Two inputs side by side',
  [MultiViewMode.PIP_LEFT_TOP]: 'Main display with small window in top-left corner',
  [MultiViewMode.PIP_RIGHT_BOTTOM]: 'Main display with small window in bottom-right corner',
  [MultiViewMode.THREE_TOP_1]: 'One large window on top, two smaller below',
  [MultiViewMode.THREE_ALT]: 'Alternative 3-window layout',
  [MultiViewMode.THREE_PIP]: 'Main window with two PIP windows',
  [MultiViewMode.QUAD]: 'Four equal windows in 2x2 grid'
}

// Input assignments for each window
export interface MultiViewInputAssignments {
  window1: number  // Wolf Pack input number for window 1
  window2: number  // Wolf Pack input number for window 2
  window3: number  // Wolf Pack input number for window 3
  window4: number  // Wolf Pack input number for window 4
}

// Multi-view card configuration
export interface MultiViewCardConfig {
  id: string
  name: string
  startSlot: number      // First of 4 consecutive Wolf Pack output slots
  endSlot: number        // Last slot (startSlot + 3)
  serialPort: string     // USB serial device path, e.g., "/dev/ttyUSB0"
  baudRate: number       // Default 115200
  currentMode: MultiViewMode
  inputAssignments: MultiViewInputAssignments | null
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: string
}

// Serial port configuration
export interface SerialConfig {
  path: string           // Device path, e.g., "/dev/ttyUSB0"
  baudRate: number       // 115200 for multi-view card
  dataBits: 8
  stopBits: 1
  parity: 'none'
}

// Command result
export interface MultiViewCommandResult {
  success: boolean
  message: string
  response?: string
}

// Slot range options for UI (groups of 4)
export const SLOT_RANGE_OPTIONS = [
  { startSlot: 1, endSlot: 4, label: 'Slots 1-4' },
  { startSlot: 5, endSlot: 8, label: 'Slots 5-8' },
  { startSlot: 9, endSlot: 12, label: 'Slots 9-12' },
  { startSlot: 13, endSlot: 16, label: 'Slots 13-16' },
  { startSlot: 17, endSlot: 20, label: 'Slots 17-20' },
  { startSlot: 21, endSlot: 24, label: 'Slots 21-24' },
  { startSlot: 25, endSlot: 28, label: 'Slots 25-28' },
  { startSlot: 29, endSlot: 32, label: 'Slots 29-32' },
  { startSlot: 33, endSlot: 36, label: 'Slots 33-36' },
]
