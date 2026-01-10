/**
 * DMX Effect Engine
 * Built-in lighting effects for DMX fixtures
 * Supports strobe, chase, color burst, rainbow, and more
 */

import { EventEmitter } from 'events'
import { dmxLogger } from './dmx-logger'
import { dmxConnectionManager } from './dmx-connection-manager'
import { DMX_CONFIG } from './config'
import { DMXFixtureState, DMXChannelMap, hexToRGB, rgbToHex, interpolateColor } from './index'

export interface EffectFixture {
  fixtureId: string
  universe: number
  startChannel: number
  channelMap: DMXChannelMap
}

export interface StrobeConfig {
  rate: number           // Hz (1-25)
  duration: number       // milliseconds
  intensity?: number     // 0-255, default 255
  color?: string         // hex color for RGB fixtures
}

export interface ChaseConfig {
  speed: number          // BPM (beats per minute)
  direction: 'forward' | 'reverse' | 'bounce'
  duration?: number      // milliseconds (0 or undefined = infinite)
  width?: number         // number of active fixtures at once (default 1)
  color?: string         // hex color for RGB fixtures
  fadePercent?: number   // 0-100, percentage of step to use for fading
}

export interface ColorBurstConfig {
  color: string          // hex color
  duration: number       // milliseconds
  fadeOutMs?: number     // fade out time (default half of duration)
  intensity?: number     // 0-255, default 255
}

export interface RainbowConfig {
  speed: number          // cycles per minute
  duration?: number      // milliseconds (0 or undefined = infinite)
  saturation?: number    // 0-100, default 100
  brightness?: number    // 0-100, default 100
  sync?: boolean         // all fixtures same color or offset (default false)
}

export interface PulseConfig {
  color: string          // hex color
  speed: number          // BPM
  duration?: number      // milliseconds (0 or undefined = infinite)
  minIntensity?: number  // 0-255, default 0
  maxIntensity?: number  // 0-255, default 255
}

interface ActiveEffect {
  id: string
  type: 'strobe' | 'chase' | 'colorBurst' | 'rainbow' | 'pulse'
  fixtures: EffectFixture[]
  config: StrobeConfig | ChaseConfig | ColorBurstConfig | RainbowConfig | PulseConfig
  startTime: number
  interval: NodeJS.Timeout | null
  state: Record<string, unknown>
  originalStates: Map<string, DMXFixtureState>
}

/**
 * Effect Engine for DMX lighting effects
 * Manages multiple concurrent effects on different fixtures
 */
export class EffectEngine extends EventEmitter {
  private activeEffects: Map<string, ActiveEffect> = new Map()
  private effectCounter: number = 0

  constructor() {
    super()
  }

  /**
   * Generate a unique effect ID
   */
  private generateEffectId(): string {
    return `effect-${Date.now()}-${++this.effectCounter}`
  }

  /**
   * Get list of active effect IDs
   */
  getActiveEffectIds(): string[] {
    return Array.from(this.activeEffects.keys())
  }

  /**
   * Get info about an active effect
   */
  getEffect(effectId: string): { type: string; fixtures: string[]; startTime: number } | null {
    const effect = this.activeEffects.get(effectId)
    if (!effect) return null

    return {
      type: effect.type,
      fixtures: effect.fixtures.map(f => f.fixtureId),
      startTime: effect.startTime,
    }
  }

  /**
   * Strobe effect - Flash fixtures at a given rate
   */
  strobe(fixtures: EffectFixture[], config: StrobeConfig): string {
    const effectId = this.generateEffectId()
    const rate = Math.min(DMX_CONFIG.STROBE_MAX_HZ, Math.max(DMX_CONFIG.STROBE_MIN_HZ, config.rate))
    const intervalMs = Math.floor(1000 / rate / 2) // Divide by 2 for on/off cycle

    dmxLogger.effect('strobe', 'start', {
      effectId,
      rate,
      duration: config.duration,
      fixtureCount: fixtures.length,
    })

    // Store original states
    const originalStates = new Map<string, DMXFixtureState>()
    for (const fixture of fixtures) {
      originalStates.set(fixture.fixtureId, {})
    }

    const effect: ActiveEffect = {
      id: effectId,
      type: 'strobe',
      fixtures,
      config,
      startTime: Date.now(),
      interval: null,
      state: { isOn: false },
      originalStates,
    }

    // Parse color if provided
    const color = config.color ? hexToRGB(config.color) : null
    const intensity = config.intensity ?? 255

    // Create strobe interval
    effect.interval = setInterval(() => {
      const isOn = !effect.state.isOn
      effect.state.isOn = isOn

      for (const fixture of fixtures) {
        if (isOn) {
          // Turn on
          if (color && fixture.channelMap.red !== undefined) {
            this.setFixtureRGB(fixture, color.r, color.g, color.b, intensity)
          } else if (fixture.channelMap.dimmer !== undefined) {
            dmxConnectionManager.setChannel(
              fixture.universe,
              fixture.startChannel + fixture.channelMap.dimmer,
              intensity
            )
          }
        } else {
          // Turn off
          if (color && fixture.channelMap.red !== undefined) {
            this.setFixtureRGB(fixture, 0, 0, 0, 0)
          } else if (fixture.channelMap.dimmer !== undefined) {
            dmxConnectionManager.setChannel(
              fixture.universe,
              fixture.startChannel + fixture.channelMap.dimmer,
              0
            )
          }
        }
      }
    }, intervalMs)

    this.activeEffects.set(effectId, effect)

    // Auto-stop after duration
    setTimeout(() => {
      this.stopEffect(effectId)
    }, config.duration)

    this.emit('effectStarted', effectId, 'strobe')
    return effectId
  }

  /**
   * Chase effect - Sequential pattern across fixtures
   */
  chase(fixtures: EffectFixture[], config: ChaseConfig): string {
    const effectId = this.generateEffectId()
    const stepMs = Math.floor(60000 / config.speed) // Convert BPM to ms per step
    const width = config.width ?? 1
    const fadePercent = config.fadePercent ?? 0

    dmxLogger.effect('chase', 'start', {
      effectId,
      speed: config.speed,
      direction: config.direction,
      fixtureCount: fixtures.length,
    })

    const originalStates = new Map<string, DMXFixtureState>()
    for (const fixture of fixtures) {
      originalStates.set(fixture.fixtureId, {})
    }

    const effect: ActiveEffect = {
      id: effectId,
      type: 'chase',
      fixtures,
      config,
      startTime: Date.now(),
      interval: null,
      state: {
        position: 0,
        direction: 1, // 1 = forward, -1 = reverse
        stepCount: 0,
      },
      originalStates,
    }

    const color = config.color ? hexToRGB(config.color) : { r: 255, g: 255, b: 255 }
    const fixtureCount = fixtures.length

    // Initial direction
    if (config.direction === 'reverse') {
      effect.state.direction = -1
      effect.state.position = fixtureCount - 1
    }

    // Create chase interval
    effect.interval = setInterval(() => {
      const pos = effect.state.position as number
      const dir = effect.state.direction as number

      // Turn off all fixtures first
      for (const fixture of fixtures) {
        if (fixture.channelMap.red !== undefined) {
          this.setFixtureRGB(fixture, 0, 0, 0, 0)
        } else if (fixture.channelMap.dimmer !== undefined) {
          dmxConnectionManager.setChannel(
            fixture.universe,
            fixture.startChannel + fixture.channelMap.dimmer,
            0
          )
        }
      }

      // Turn on active fixtures
      for (let i = 0; i < width; i++) {
        const idx = (pos + i) % fixtureCount
        const fixture = fixtures[idx]

        // Calculate intensity for width > 1 (gradient effect)
        const intensityFactor = width > 1 ? 1 - (i / width) * 0.5 : 1

        if (fixture.channelMap.red !== undefined) {
          this.setFixtureRGB(
            fixture,
            Math.round(color.r * intensityFactor),
            Math.round(color.g * intensityFactor),
            Math.round(color.b * intensityFactor),
            255
          )
        } else if (fixture.channelMap.dimmer !== undefined) {
          dmxConnectionManager.setChannel(
            fixture.universe,
            fixture.startChannel + fixture.channelMap.dimmer,
            Math.round(255 * intensityFactor)
          )
        }
      }

      // Update position
      let newPos = pos + dir
      let newDir = dir

      if (config.direction === 'bounce') {
        if (newPos >= fixtureCount - 1) {
          newPos = fixtureCount - 1
          newDir = -1
        } else if (newPos <= 0) {
          newPos = 0
          newDir = 1
        }
      } else {
        // Wrap around
        if (newPos >= fixtureCount) {
          newPos = 0
        } else if (newPos < 0) {
          newPos = fixtureCount - 1
        }
      }

      effect.state.position = newPos
      effect.state.direction = newDir
      effect.state.stepCount = (effect.state.stepCount as number) + 1
    }, stepMs)

    this.activeEffects.set(effectId, effect)

    // Auto-stop after duration if specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        this.stopEffect(effectId)
      }, config.duration)
    }

    this.emit('effectStarted', effectId, 'chase')
    return effectId
  }

  /**
   * Color Burst effect - Flash a color then fade out
   */
  colorBurst(fixtures: EffectFixture[], config: ColorBurstConfig): string {
    const effectId = this.generateEffectId()
    const fadeOutMs = config.fadeOutMs ?? Math.floor(config.duration / 2)
    const fadeSteps = Math.floor(fadeOutMs / DMX_CONFIG.FADE_STEP_MS)

    dmxLogger.effect('colorBurst', 'start', {
      effectId,
      color: config.color,
      duration: config.duration,
      fixtureCount: fixtures.length,
    })

    const originalStates = new Map<string, DMXFixtureState>()
    for (const fixture of fixtures) {
      originalStates.set(fixture.fixtureId, {})
    }

    const effect: ActiveEffect = {
      id: effectId,
      type: 'colorBurst',
      fixtures,
      config,
      startTime: Date.now(),
      interval: null,
      state: { phase: 'burst', fadeStep: 0 },
      originalStates,
    }

    const color = hexToRGB(config.color)
    const intensity = config.intensity ?? 255

    // Start with full color burst
    for (const fixture of fixtures) {
      if (fixture.channelMap.red !== undefined) {
        this.setFixtureRGB(fixture, color.r, color.g, color.b, intensity)
      } else if (fixture.channelMap.dimmer !== undefined) {
        dmxConnectionManager.setChannel(
          fixture.universe,
          fixture.startChannel + fixture.channelMap.dimmer,
          intensity
        )
      }
    }

    this.activeEffects.set(effectId, effect)

    // Wait for burst duration, then start fade out
    const holdTime = config.duration - fadeOutMs
    setTimeout(() => {
      effect.state.phase = 'fade'

      // Start fade out
      effect.interval = setInterval(() => {
        const step = effect.state.fadeStep as number
        const progress = step / fadeSteps
        const currentIntensity = Math.round(intensity * (1 - progress))

        for (const fixture of fixtures) {
          if (fixture.channelMap.red !== undefined) {
            this.setFixtureRGB(
              fixture,
              Math.round(color.r * (1 - progress)),
              Math.round(color.g * (1 - progress)),
              Math.round(color.b * (1 - progress)),
              currentIntensity
            )
          } else if (fixture.channelMap.dimmer !== undefined) {
            dmxConnectionManager.setChannel(
              fixture.universe,
              fixture.startChannel + fixture.channelMap.dimmer,
              currentIntensity
            )
          }
        }

        effect.state.fadeStep = step + 1

        if (step >= fadeSteps) {
          this.stopEffect(effectId)
        }
      }, DMX_CONFIG.FADE_STEP_MS)
    }, holdTime)

    this.emit('effectStarted', effectId, 'colorBurst')
    return effectId
  }

  /**
   * Rainbow effect - Cycle through colors
   */
  rainbow(fixtures: EffectFixture[], config: RainbowConfig): string {
    const effectId = this.generateEffectId()
    const cycleMs = Math.floor(60000 / config.speed) // ms per full cycle
    const stepMs = DMX_CONFIG.FADE_STEP_MS
    const stepsPerCycle = Math.floor(cycleMs / stepMs)

    dmxLogger.effect('rainbow', 'start', {
      effectId,
      speed: config.speed,
      duration: config.duration,
      fixtureCount: fixtures.length,
    })

    const originalStates = new Map<string, DMXFixtureState>()
    for (const fixture of fixtures) {
      originalStates.set(fixture.fixtureId, {})
    }

    const effect: ActiveEffect = {
      id: effectId,
      type: 'rainbow',
      fixtures,
      config,
      startTime: Date.now(),
      interval: null,
      state: { step: 0 },
      originalStates,
    }

    const saturation = (config.saturation ?? 100) / 100
    const brightness = (config.brightness ?? 100) / 100
    const sync = config.sync ?? false

    effect.interval = setInterval(() => {
      const step = effect.state.step as number

      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i]

        // Calculate hue (0-360) based on step and fixture index
        let hue: number
        if (sync) {
          hue = (step / stepsPerCycle) * 360
        } else {
          // Offset each fixture
          const offset = (i / fixtures.length) * 360
          hue = ((step / stepsPerCycle) * 360 + offset) % 360
        }

        // Convert HSV to RGB
        const rgb = this.hsvToRgb(hue, saturation, brightness)

        if (fixture.channelMap.red !== undefined) {
          this.setFixtureRGB(fixture, rgb.r, rgb.g, rgb.b, 255)
        }
      }

      effect.state.step = (step + 1) % stepsPerCycle
    }, stepMs)

    this.activeEffects.set(effectId, effect)

    // Auto-stop after duration if specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        this.stopEffect(effectId)
      }, config.duration)
    }

    this.emit('effectStarted', effectId, 'rainbow')
    return effectId
  }

  /**
   * Pulse effect - Fade intensity up and down
   */
  pulse(fixtures: EffectFixture[], config: PulseConfig): string {
    const effectId = this.generateEffectId()
    const cycleMs = Math.floor(60000 / config.speed) // ms per full cycle
    const stepMs = DMX_CONFIG.FADE_STEP_MS
    const stepsPerHalfCycle = Math.floor(cycleMs / stepMs / 2)

    dmxLogger.effect('pulse', 'start', {
      effectId,
      speed: config.speed,
      color: config.color,
      duration: config.duration,
      fixtureCount: fixtures.length,
    })

    const originalStates = new Map<string, DMXFixtureState>()
    for (const fixture of fixtures) {
      originalStates.set(fixture.fixtureId, {})
    }

    const effect: ActiveEffect = {
      id: effectId,
      type: 'pulse',
      fixtures,
      config,
      startTime: Date.now(),
      interval: null,
      state: { step: 0, direction: 1 },
      originalStates,
    }

    const color = hexToRGB(config.color)
    const minIntensity = config.minIntensity ?? 0
    const maxIntensity = config.maxIntensity ?? 255
    const intensityRange = maxIntensity - minIntensity

    effect.interval = setInterval(() => {
      const step = effect.state.step as number
      const dir = effect.state.direction as number

      // Calculate intensity using sine wave for smooth pulsing
      const progress = step / stepsPerHalfCycle
      const intensity = minIntensity + Math.round(intensityRange * progress)

      for (const fixture of fixtures) {
        if (fixture.channelMap.red !== undefined) {
          const factor = intensity / 255
          this.setFixtureRGB(
            fixture,
            Math.round(color.r * factor),
            Math.round(color.g * factor),
            Math.round(color.b * factor),
            intensity
          )
        } else if (fixture.channelMap.dimmer !== undefined) {
          dmxConnectionManager.setChannel(
            fixture.universe,
            fixture.startChannel + fixture.channelMap.dimmer,
            intensity
          )
        }
      }

      // Update step
      let newStep = step + dir
      let newDir = dir

      if (newStep >= stepsPerHalfCycle) {
        newStep = stepsPerHalfCycle
        newDir = -1
      } else if (newStep <= 0) {
        newStep = 0
        newDir = 1
      }

      effect.state.step = newStep
      effect.state.direction = newDir
    }, stepMs)

    this.activeEffects.set(effectId, effect)

    // Auto-stop after duration if specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        this.stopEffect(effectId)
      }, config.duration)
    }

    this.emit('effectStarted', effectId, 'pulse')
    return effectId
  }

  /**
   * Start a generic effect by type and config
   */
  startEffect(
    effectType: 'strobe' | 'chase' | 'colorBurst' | 'rainbow' | 'pulse',
    fixtures: EffectFixture[],
    config: StrobeConfig | ChaseConfig | ColorBurstConfig | RainbowConfig | PulseConfig
  ): string {
    switch (effectType) {
      case 'strobe':
        return this.strobe(fixtures, config as StrobeConfig)
      case 'chase':
        return this.chase(fixtures, config as ChaseConfig)
      case 'colorBurst':
        return this.colorBurst(fixtures, config as ColorBurstConfig)
      case 'rainbow':
        return this.rainbow(fixtures, config as RainbowConfig)
      case 'pulse':
        return this.pulse(fixtures, config as PulseConfig)
      default:
        throw new Error(`Unknown effect type: ${effectType}`)
    }
  }

  /**
   * Stop a specific effect
   */
  stopEffect(effectId: string): boolean {
    const effect = this.activeEffects.get(effectId)
    if (!effect) {
      return false
    }

    // Clear interval
    if (effect.interval) {
      clearInterval(effect.interval)
      effect.interval = null
    }

    // Turn off fixtures
    for (const fixture of effect.fixtures) {
      if (fixture.channelMap.red !== undefined) {
        this.setFixtureRGB(fixture, 0, 0, 0, 0)
      } else if (fixture.channelMap.dimmer !== undefined) {
        dmxConnectionManager.setChannel(
          fixture.universe,
          fixture.startChannel + fixture.channelMap.dimmer,
          0
        )
      }
    }

    this.activeEffects.delete(effectId)

    dmxLogger.effect(effect.type, 'stop', { effectId })
    this.emit('effectStopped', effectId, effect.type)

    return true
  }

  /**
   * Stop all active effects
   */
  stopAllEffects(): void {
    const effectIds = Array.from(this.activeEffects.keys())

    for (const effectId of effectIds) {
      this.stopEffect(effectId)
    }

    dmxLogger.info('All effects stopped', { count: effectIds.length })
    this.emit('allEffectsStopped')
  }

  /**
   * Helper: Set RGB color on a fixture
   */
  private setFixtureRGB(
    fixture: EffectFixture,
    r: number,
    g: number,
    b: number,
    dimmer?: number
  ): void {
    const { universe, startChannel, channelMap } = fixture

    if (channelMap.red !== undefined) {
      dmxConnectionManager.setChannel(universe, startChannel + channelMap.red, r)
    }
    if (channelMap.green !== undefined) {
      dmxConnectionManager.setChannel(universe, startChannel + channelMap.green, g)
    }
    if (channelMap.blue !== undefined) {
      dmxConnectionManager.setChannel(universe, startChannel + channelMap.blue, b)
    }
    if (dimmer !== undefined && channelMap.dimmer !== undefined) {
      dmxConnectionManager.setChannel(universe, startChannel + channelMap.dimmer, dimmer)
    }
  }

  /**
   * Helper: Convert HSV to RGB
   */
  private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const c = v * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = v - c

    let r = 0, g = 0, b = 0

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c
    } else {
      r = c; g = 0; b = x
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAllEffects()
    this.removeAllListeners()
    dmxLogger.info('Effect engine destroyed')
  }
}

// Export singleton instance
let effectEngineInstance: EffectEngine | null = null

export function getEffectEngine(): EffectEngine {
  if (!effectEngineInstance) {
    effectEngineInstance = new EffectEngine()
  }
  return effectEngineInstance
}

export { EffectEngine as default }
