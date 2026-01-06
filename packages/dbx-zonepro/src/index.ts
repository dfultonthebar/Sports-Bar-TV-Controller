/**
 * @sports-bar/dbx-zonepro - dbx ZonePRO Audio Processor Control Package
 *
 * Comprehensive library for controlling dbx ZonePRO audio processors:
 * - TCP client for m-models with Ethernet (640m, 641m, 1260m, 1261m)
 * - RS-232 serial client for all models
 * - HiQnet v1.0 protocol implementation
 * - Zone volume, mute, and source control
 * - Scene/preset recall
 * - Stereo pair support
 *
 * Supported Models:
 * - ZonePRO 640/640m  - 6 inputs, 4 outputs
 * - ZonePRO 641/641m  - 6 inputs, 4 outputs (with mic preamps)
 * - ZonePRO 1260/1260m - 12 inputs, 6 outputs
 * - ZonePRO 1261/1261m - 12 inputs, 6 outputs (with mic preamps)
 */

// Configuration
export {
  DBX_NETWORK_CONFIG,
  DBX_SERIAL_CONFIG,
  DBX_PROTOCOL,
  DBX_MODELS,
  getModelConfig,
  supportsEthernet,
  dbToVolume,
  volumeToDb,
  percentToVolume,
  volumeToPercent,
  type DbxModelConfig,
  type DbxModelName,
} from './config'

// Protocol
export {
  calculateCRC8,
  buildFrame,
  buildMultiSVSetPayload,
  buildGetPayload,
  buildRecallScenePayload,
  buildPingFrame,
  buildVolumeSetFrame,
  buildMuteSetFrame,
  buildSourceSetFrame,
  buildRecallSceneFrame,
  parseFrame,
  FrameBuffer,
  type HiQnetHeader,
  type StateVariableSet,
} from './dbx-protocol'

// TCP Client (for m-models with Ethernet)
export {
  DbxTcpClient,
  createDbxTcpClient,
  type DbxTcpClientConfig,
  type DbxClientEvents,
} from './dbx-tcp-client'

// Serial Client (for RS-232 connection)
export {
  DbxSerialClient,
  createDbxSerialClient,
  type DbxSerialClientConfig,
} from './dbx-serial-client'

// Control Service (high-level unified interface)
export {
  DbxControlService,
  getDbxControlService,
  disconnectDbxService,
  disconnectAllDbxServices,
  listDbxServices,
  type DbxControlServiceConfig,
  type DbxControlEvents,
  type ZoneState,
} from './dbx-control-service'
