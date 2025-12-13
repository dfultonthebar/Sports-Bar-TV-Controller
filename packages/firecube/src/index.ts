/**
 * @sports-bar/firecube - Fire TV/Cube ADB control package
 *
 * Core functionality for Fire TV device management:
 * - ADB client with keep-alive support
 * - Device discovery (network scan and ADB)
 * - Type definitions and constants
 */

// Types and constants
export * from './types'

// ADB Client
export { ADBClient, type ADBConnectionOptions } from './adb-client'

// Discovery
export { FireCubeDiscovery } from './discovery'
