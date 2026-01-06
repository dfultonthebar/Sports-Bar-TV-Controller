/**
 * @sports-bar/crestron
 *
 * Crestron DigitalMedia matrix switcher control library.
 * Supports DM-MD, HD-MD, DMPS, and NVX series devices.
 *
 * Control is via Telnet (port 23) or CTP (port 41795) protocols.
 */

// Types
export * from './types'

// Telnet client
export { CrestronTelnetClient } from './crestron-telnet-client'

// Main service
export { CrestronService, createCrestronService } from './crestron-service'
