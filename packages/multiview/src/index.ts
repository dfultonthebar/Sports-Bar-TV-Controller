/**
 * @sports-bar/multiview
 *
 * Wolf Pack Multi-View Card Control Package
 *
 * Controls HDTVSupply 4K60 Quad-View Output Cards via RS-232 serial.
 * These cards plug into Wolf Pack matrix output slots and provide
 * multi-window display capabilities (PIP, quad view, split screen, etc.)
 */

// Types
export {
  MultiViewMode,
  MULTIVIEW_MODE_NAMES,
  MULTIVIEW_MODE_DESCRIPTIONS,
  SLOT_RANGE_OPTIONS,
  type MultiViewInputAssignments,
  type MultiViewCardConfig,
  type SerialConfig,
  type MultiViewCommandResult
} from './types'

// Command builders
export {
  buildModeCommand,
  buildInputSwapCommand,
  buildStatusQuery,
  commandToHexString,
  parseResponse,
  isValidInput,
  isValidMode
} from './commands'

// Serial client
export {
  MultiViewSerialClient,
  listSerialPorts,
  checkSerialPort
} from './serial-client'

// High-level service
export {
  setMode,
  setWindowInput,
  testConnection,
  getAvailablePorts,
  disconnect,
  disconnectAll,
  MULTIVIEW_PRESETS
} from './multiview-service'
