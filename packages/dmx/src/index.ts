/**
 * @sports-bar/dmx - DMX Lighting Control Package
 *
 * Provides comprehensive DMX512 lighting control with support for:
 * - USB DMX adapters (Enttec Pro, Enttec Open DMX, PKnight CR011R)
 * - Art-Net network adapters (Enttec ODE, DMXking, generic Art-Net nodes)
 * - Maestro DMX controllers (with built-in preset and function button access)
 *
 * Features:
 * - Multi-adapter support for expanded universes
 * - Singleton connection manager with reference counting
 * - Scene engine with fading transitions
 * - Effect engine (strobe, chase, color-burst)
 * - Game event integration for automatic celebrations
 */

// Configuration and constants
export * from './config'

// Logging
export { dmxLogger } from './dmx-logger'

// Clients
export {
  USBDMXClient,
  ArtNetClient,
  MaestroClient,
} from './clients'

export type {
  USBDMXConfig,
  USBDMXClientEvents,
  ArtNetConfig,
  ArtNetNode,
  MaestroConfig,
  MaestroStatus,
} from './clients'

// Connection Manager
export {
  dmxConnectionManager,
  DMXConnectionManagerClass,
} from './dmx-connection-manager'

export type {
  DMXClient,
  AdapterRegistration,
} from './dmx-connection-manager'

// Type definitions for fixtures and scenes
export interface DMXFixtureState {
  red?: number          // 0-255
  green?: number        // 0-255
  blue?: number         // 0-255
  white?: number        // 0-255
  amber?: number        // 0-255
  uv?: number           // 0-255
  dimmer?: number       // 0-255
  strobe?: number       // 0-255 (0 = off, 255 = max speed)
  pan?: number          // 0-65535 for 16-bit
  tilt?: number         // 0-65535 for 16-bit
  gobo?: number         // 0-255 (gobo wheel position)
  focus?: number        // 0-255
  zoom?: number         // 0-255
  prism?: number        // 0-255
  [key: string]: number | undefined  // Allow custom channels
}

export interface DMXChannelMap {
  red?: number          // Channel offset for red
  green?: number        // Channel offset for green
  blue?: number         // Channel offset for blue
  white?: number        // Channel offset for white
  amber?: number        // Channel offset for amber
  uv?: number           // Channel offset for UV
  dimmer?: number       // Channel offset for dimmer/intensity
  strobe?: number       // Channel offset for strobe
  pan?: number          // Channel offset for pan
  panFine?: number      // Channel offset for pan fine (16-bit)
  tilt?: number         // Channel offset for tilt
  tiltFine?: number     // Channel offset for tilt fine (16-bit)
  gobo?: number         // Channel offset for gobo
  goboRotation?: number // Channel offset for gobo rotation
  focus?: number        // Channel offset for focus
  zoom?: number         // Channel offset for zoom
  prism?: number        // Channel offset for prism
  colorWheel?: number   // Channel offset for color wheel
  [key: string]: number | undefined
}

export interface DMXSceneData {
  fixtureId: string
  state: DMXFixtureState
}

export interface DMXEffectConfig {
  type: 'strobe' | 'color-burst' | 'chase' | 'fade' | 'rainbow' | 'pulse'
  duration: number       // milliseconds
  fixtureIds: string[]   // Fixtures to affect
  colors?: string[]      // Hex colors for color effects
  speed?: number         // Effect speed (Hz or BPM)
  intensity?: number     // 0-100
  direction?: 'forward' | 'reverse' | 'bounce'
}

// Helper functions
export function calculateDMXAddress(universe: number, channel: number): number {
  return (universe * 512) + channel
}

export function parseUniverseAndChannel(address: number): { universe: number; channel: number } {
  return {
    universe: Math.floor(address / 512),
    channel: address % 512,
  }
}

export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, Math.round(x))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

export function interpolateColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  progress: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(from.r + (to.r - from.r) * progress),
    g: Math.round(from.g + (to.g - from.g) * progress),
    b: Math.round(from.b + (to.b - from.b) * progress),
  }
}
