/**
 * HTD Audio System Type Definitions
 *
 * Supports MC-66, MCA-66, Lync 6, and Lync 12 whole-house audio controllers
 */

/**
 * Supported HTD controller models
 */
export type HTDModel = 'MC-66' | 'MCA-66' | 'Lync6' | 'Lync12';

/**
 * Connection type for HTD devices
 */
export type HTDConnectionType = 'tcp' | 'serial';

/**
 * Model-specific configuration
 */
export interface HTDModelConfig {
  name: string;
  zones: number;
  sources: number;
  hasAmplifier: boolean;
  supportsWebSocket: boolean;
}

/**
 * Device configuration for connecting to an HTD controller
 */
export interface HTDDeviceConfig {
  /** Unique device identifier */
  id: string;
  /** Display name for the device */
  name: string;
  /** HTD model type */
  model: HTDModel;
  /** Connection method */
  connectionType: HTDConnectionType;
  /** IP address of the gateway (for TCP) */
  ipAddress?: string;
  /** TCP port number (default: 10006) */
  port?: number;
  /** Serial port path (for RS-232, e.g., /dev/ttyUSB0) */
  serialPort?: string;
  /** Serial baud rate (default: 57600) */
  baudRate?: number;
  /** Command delay in milliseconds (default: 100) */
  commandDelay?: number;
}

/**
 * Required device configuration with defaults applied
 */
export interface HTDDeviceConfigRequired {
  id: string;
  name: string;
  model: HTDModel;
  connectionType: HTDConnectionType;
  ipAddress: string;
  port: number;
  serialPort: string;
  baudRate: number;
  commandDelay: number;
}

/**
 * Zone state representing current status of a single zone
 */
export interface HTDZoneState {
  /** Zone number (1-12) */
  zone: number;
  /** Power state */
  power: boolean;
  /** Mute state */
  muted: boolean;
  /** Volume as percentage (0-100) */
  volume: number;
  /** Raw volume value from controller (196-256, 0=256) */
  rawVolume: number;
  /** Current source input (1-6) */
  source: number;
  /** Bass level (-7 to +7) */
  bass: number;
  /** Treble level (-7 to +7) */
  treble: number;
  /** Balance (-7=left to +7=right) */
  balance: number;
  /** Do Not Disturb mode */
  doNotDisturb: boolean;
  /** Party mode (follows zone 1) */
  partyMode: boolean;
}

/**
 * Raw zone data from controller response (14 bytes per zone)
 */
export interface HTDZoneRawData {
  zone: number;
  power: number;
  source: number;
  volume: number;
  treble: number;
  bass: number;
  balance: number;
  flags: number;
}

/**
 * HTD command structure
 */
export interface HTDCommand {
  /** Target zone (1-12) */
  zone: number;
  /** Command code */
  commandCode: number;
  /** Data/parameter code */
  dataCode: number;
}

/**
 * Pending command awaiting response
 */
export interface HTDPendingCommand {
  /** Command buffer sent */
  command: Buffer;
  /** Resolve function for promise */
  resolve: (value: Buffer) => void;
  /** Reject function for promise */
  reject: (reason: Error) => void;
  /** Timeout handle */
  timeout: NodeJS.Timeout;
  /** Timestamp when command was sent */
  timestamp: number;
}

/**
 * Connection state information
 */
export interface HTDConnectionState {
  /** Whether currently connected */
  isConnected: boolean;
  /** Last successful connection time */
  lastConnected?: Date;
  /** Last error message */
  lastError?: string;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
}

/**
 * Control service configuration
 */
export interface HTDControlServiceConfig extends HTDDeviceConfig {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms (default: 2000) */
  reconnectDelay?: number;
  /** State poll interval in ms (default: 5000, 0 to disable) */
  pollInterval?: number;
}

/**
 * Events emitted by HTD control service
 */
export interface HTDControlEvents {
  /** Emitted when connection is established */
  connected: () => void;
  /** Emitted when connection is lost */
  disconnected: () => void;
  /** Emitted on error */
  error: (error: Error) => void;
  /** Emitted when zone state changes */
  zoneUpdate: (state: HTDZoneState) => void;
  /** Emitted when all zones are updated */
  zonesUpdate: (states: HTDZoneState[]) => void;
  /** Emitted on reconnection attempt */
  reconnecting: (attempt: number) => void;
}

/**
 * Control command types
 */
export type HTDControlCommand =
  | 'power'
  | 'powerAll'
  | 'volumeUp'
  | 'volumeDown'
  | 'setVolume'
  | 'mute'
  | 'setSource'
  | 'bassUp'
  | 'bassDown'
  | 'trebleUp'
  | 'trebleDown'
  | 'balanceLeft'
  | 'balanceRight';

/**
 * Control request for API
 */
export interface HTDControlRequest {
  /** Device ID */
  deviceId: string;
  /** Command to execute */
  command: HTDControlCommand;
  /** Target zone (required except for powerAll) */
  zone?: number;
  /** Value for setVolume (0-100) or setSource (1-6) */
  value?: number;
}

/**
 * Control response
 */
export interface HTDControlResponse {
  /** Success status */
  success: boolean;
  /** Response message */
  message: string;
  /** Updated zone state (if applicable) */
  zoneState?: HTDZoneState;
  /** Error details */
  error?: string;
}
