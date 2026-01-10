/**
 * DMX Scene Engine
 * Handles scene transitions with smooth fading and interpolation
 * Uses requestAnimationFrame-style timing for smooth transitions
 */

import { EventEmitter } from 'events'
import { dmxLogger } from './dmx-logger'
import { dmxConnectionManager, DMXClient } from './dmx-connection-manager'
import { DMX_CONFIG } from './config'
import { DMXFixtureState, DMXChannelMap, hexToRGB, interpolateColor } from './index'

export interface SceneFixtureData {
  fixtureId: string
  universe: number
  startChannel: number
  channelMap: DMXChannelMap
  state: DMXFixtureState
}

export interface SceneData {
  id: string
  name: string
  fixtures: SceneFixtureData[]
  fadeTimeMs?: number
}

interface ActiveFade {
  id: string
  startTime: number
  duration: number
  fromState: Map<string, DMXFixtureState>
  toState: Map<string, DMXFixtureState>
  fixtureConfigs: Map<string, { universe: number; startChannel: number; channelMap: DMXChannelMap }>
  onComplete?: () => void
}

interface CurrentChannelState {
  universe: number
  channel: number
  value: number
}

/**
 * Scene Engine for DMX lighting control
 * Manages scene transitions with smooth fading between states
 */
export class SceneEngine extends EventEmitter {
  private currentState: Map<string, DMXFixtureState> = new Map()
  private fixtureConfigs: Map<string, { universe: number; startChannel: number; channelMap: DMXChannelMap }> = new Map()
  private activeFade: ActiveFade | null = null
  private fadeInterval: NodeJS.Timeout | null = null
  private currentSceneId: string | null = null

  constructor() {
    super()
  }

  /**
   * Get the current state of all fixtures
   */
  getCurrentState(): Map<string, DMXFixtureState> {
    return new Map(this.currentState)
  }

  /**
   * Get the current scene ID
   */
  getCurrentSceneId(): string | null {
    return this.currentSceneId
  }

  /**
   * Check if a fade is currently in progress
   */
  isFading(): boolean {
    return this.activeFade !== null
  }

  /**
   * Recall a scene with optional fade time
   * @param sceneData The scene data to recall
   * @param fadeTimeMs Fade time in milliseconds (0 for instant)
   */
  async recallScene(sceneData: SceneData, fadeTimeMs?: number): Promise<void> {
    const fadeDuration = fadeTimeMs ?? sceneData.fadeTimeMs ?? DMX_CONFIG.DEFAULT_FADE_MS

    dmxLogger.info('Recalling scene', {
      sceneId: sceneData.id,
      sceneName: sceneData.name,
      fadeTimeMs: fadeDuration,
      fixtureCount: sceneData.fixtures.length,
    })

    // Stop any active fade
    this.stopFade()

    // Build target state from scene data
    const targetState = new Map<string, DMXFixtureState>()
    const fixtureConfigs = new Map<string, { universe: number; startChannel: number; channelMap: DMXChannelMap }>()

    for (const fixture of sceneData.fixtures) {
      targetState.set(fixture.fixtureId, fixture.state)
      fixtureConfigs.set(fixture.fixtureId, {
        universe: fixture.universe,
        startChannel: fixture.startChannel,
        channelMap: fixture.channelMap,
      })
    }

    // Update fixture configs
    for (const [fixtureId, config] of fixtureConfigs) {
      this.fixtureConfigs.set(fixtureId, config)
    }

    if (fadeDuration <= 0) {
      // Instant change
      await this.applyStateInstantly(targetState)
    } else {
      // Fade to new state
      await this.fadeToState(targetState, fadeDuration)
    }

    this.currentSceneId = sceneData.id
    dmxLogger.sceneRecall(sceneData.name, true, { sceneId: sceneData.id })
    this.emit('sceneRecalled', sceneData.id, sceneData.name)
  }

  /**
   * Crossfade between two scenes
   * @param fromScene Starting scene (if null, uses current state)
   * @param toScene Target scene
   * @param durationMs Crossfade duration in milliseconds
   */
  async crossfade(fromScene: SceneData | null, toScene: SceneData, durationMs: number): Promise<void> {
    dmxLogger.info('Starting crossfade', {
      fromScene: fromScene?.name ?? 'current',
      toScene: toScene.name,
      durationMs,
    })

    // Stop any active fade
    this.stopFade()

    // If fromScene is provided, first apply it instantly
    if (fromScene) {
      const fromState = new Map<string, DMXFixtureState>()
      for (const fixture of fromScene.fixtures) {
        fromState.set(fixture.fixtureId, fixture.state)
        this.fixtureConfigs.set(fixture.fixtureId, {
          universe: fixture.universe,
          startChannel: fixture.startChannel,
          channelMap: fixture.channelMap,
        })
      }
      await this.applyStateInstantly(fromState)
    }

    // Build target state
    const targetState = new Map<string, DMXFixtureState>()
    for (const fixture of toScene.fixtures) {
      targetState.set(fixture.fixtureId, fixture.state)
      this.fixtureConfigs.set(fixture.fixtureId, {
        universe: fixture.universe,
        startChannel: fixture.startChannel,
        channelMap: fixture.channelMap,
      })
    }

    // Start the crossfade
    await this.fadeToState(targetState, durationMs)

    this.currentSceneId = toScene.id
    dmxLogger.sceneRecall(toScene.name, true, { crossfade: true, durationMs })
    this.emit('crossfadeComplete', fromScene?.id ?? null, toScene.id)
  }

  /**
   * Apply a state instantly without fading
   */
  private async applyStateInstantly(targetState: Map<string, DMXFixtureState>): Promise<void> {
    for (const [fixtureId, state] of targetState) {
      this.currentState.set(fixtureId, { ...state })
      this.applyFixtureState(fixtureId, state)
    }
  }

  /**
   * Fade to a target state over duration
   */
  private fadeToState(targetState: Map<string, DMXFixtureState>, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      // Capture current state as starting point
      const fromState = new Map<string, DMXFixtureState>()

      // For fixtures in target state, get their current state or default to zeros
      for (const [fixtureId, targetFixtureState] of targetState) {
        const currentFixtureState = this.currentState.get(fixtureId)
        if (currentFixtureState) {
          fromState.set(fixtureId, { ...currentFixtureState })
        } else {
          // Initialize to zeros for all channels in target state
          const zeroState: DMXFixtureState = {}
          for (const key of Object.keys(targetFixtureState)) {
            zeroState[key] = 0
          }
          fromState.set(fixtureId, zeroState)
        }
      }

      this.activeFade = {
        id: `fade-${Date.now()}`,
        startTime: Date.now(),
        duration: durationMs,
        fromState,
        toState: targetState,
        fixtureConfigs: new Map(this.fixtureConfigs),
        onComplete: resolve,
      }

      // Start the fade loop
      this.startFadeLoop()
    })
  }

  /**
   * Start the fade interpolation loop
   */
  private startFadeLoop(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
    }

    const stepMs = DMX_CONFIG.FADE_STEP_MS

    this.fadeInterval = setInterval(() => {
      if (!this.activeFade) {
        this.stopFade()
        return
      }

      const elapsed = Date.now() - this.activeFade.startTime
      const progress = Math.min(1, elapsed / this.activeFade.duration)

      // Apply eased progress (ease-in-out curve)
      const easedProgress = this.easeInOutCubic(progress)

      // Interpolate all fixtures
      for (const [fixtureId, toState] of this.activeFade.toState) {
        const fromState = this.activeFade.fromState.get(fixtureId)
        if (!fromState) continue

        const interpolatedState = this.interpolateState(fromState, toState, easedProgress)
        this.currentState.set(fixtureId, interpolatedState)
        this.applyFixtureState(fixtureId, interpolatedState)
      }

      // Check if fade is complete
      if (progress >= 1) {
        const onComplete = this.activeFade.onComplete
        this.stopFade()
        this.emit('fadeComplete', this.currentSceneId)
        if (onComplete) {
          onComplete()
        }
      }
    }, stepMs)
  }

  /**
   * Stop any active fade
   */
  stopFade(): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
      this.fadeInterval = null
    }
    this.activeFade = null
  }

  /**
   * Interpolate between two fixture states
   */
  private interpolateState(
    from: DMXFixtureState,
    to: DMXFixtureState,
    progress: number
  ): DMXFixtureState {
    const result: DMXFixtureState = {}

    // Get all keys from both states
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)])

    for (const key of allKeys) {
      const fromValue = from[key] ?? 0
      const toValue = to[key] ?? 0

      if (fromValue !== undefined && toValue !== undefined) {
        result[key] = Math.round(fromValue + (toValue - fromValue) * progress)
      }
    }

    return result
  }

  /**
   * Ease-in-out cubic function for smooth transitions
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  /**
   * Apply a fixture state to the DMX output
   */
  private applyFixtureState(fixtureId: string, state: DMXFixtureState): void {
    const config = this.fixtureConfigs.get(fixtureId)
    if (!config) {
      dmxLogger.warn('No fixture config found for fixture', { fixtureId })
      return
    }

    const { universe, startChannel, channelMap } = config

    // Map state properties to DMX channels
    for (const [property, value] of Object.entries(state)) {
      if (value === undefined) continue

      const channelOffset = channelMap[property]
      if (channelOffset !== undefined) {
        const channel = startChannel + channelOffset
        const clampedValue = Math.min(255, Math.max(0, Math.round(value)))
        dmxConnectionManager.setChannel(universe, channel, clampedValue)
      }
    }
  }

  /**
   * Set fixture state directly (without scene)
   */
  setFixtureState(
    fixtureId: string,
    universe: number,
    startChannel: number,
    channelMap: DMXChannelMap,
    state: DMXFixtureState,
    fadeTimeMs: number = 0
  ): Promise<void> {
    // Store fixture config
    this.fixtureConfigs.set(fixtureId, { universe, startChannel, channelMap })

    const targetState = new Map<string, DMXFixtureState>()
    targetState.set(fixtureId, state)

    if (fadeTimeMs <= 0) {
      return Promise.resolve(this.applyStateInstantly(targetState))
    } else {
      return this.fadeToState(targetState, fadeTimeMs)
    }
  }

  /**
   * Blackout all fixtures with optional fade
   */
  async blackout(fadeTimeMs: number = 0): Promise<void> {
    dmxLogger.info('Scene engine blackout', { fadeTimeMs })

    const blackoutState = new Map<string, DMXFixtureState>()

    // Set all current fixtures to zero
    for (const [fixtureId, state] of this.currentState) {
      const zeroState: DMXFixtureState = {}
      for (const key of Object.keys(state)) {
        zeroState[key] = 0
      }
      blackoutState.set(fixtureId, zeroState)
    }

    if (fadeTimeMs <= 0) {
      await this.applyStateInstantly(blackoutState)
      dmxConnectionManager.blackoutAll()
    } else {
      await this.fadeToState(blackoutState, fadeTimeMs)
    }

    this.currentSceneId = null
    this.emit('blackout')
  }

  /**
   * Get the current DMX channel values for all fixtures
   */
  getCurrentChannelValues(): CurrentChannelState[] {
    const values: CurrentChannelState[] = []

    for (const [fixtureId, state] of this.currentState) {
      const config = this.fixtureConfigs.get(fixtureId)
      if (!config) continue

      const { universe, startChannel, channelMap } = config

      for (const [property, value] of Object.entries(state)) {
        if (value === undefined) continue

        const channelOffset = channelMap[property]
        if (channelOffset !== undefined) {
          values.push({
            universe,
            channel: startChannel + channelOffset,
            value: Math.round(value),
          })
        }
      }
    }

    return values
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopFade()
    this.currentState.clear()
    this.fixtureConfigs.clear()
    this.removeAllListeners()
    dmxLogger.info('Scene engine destroyed')
  }
}

// Export singleton instance
let sceneEngineInstance: SceneEngine | null = null

export function getSceneEngine(): SceneEngine {
  if (!sceneEngineInstance) {
    sceneEngineInstance = new SceneEngine()
  }
  return sceneEngineInstance
}

export { SceneEngine as default }
