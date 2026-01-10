/**
 * DMX Game Event Reactor
 * Listens for game events and triggers DMX lighting effects
 * Supports multiple sports and team-specific celebrations
 */

import { EventEmitter } from 'events'
import { dmxLogger } from './dmx-logger'
import { EffectEngine, EffectFixture, getEffectEngine, StrobeConfig, ChaseConfig, ColorBurstConfig, RainbowConfig, PulseConfig } from './effect-engine'
import { SceneEngine, SceneData, getSceneEngine } from './scene-engine'
import { GAME_EVENT_TYPES, GameEventType } from './config'

export type SportType = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaaf' | 'ncaab' | 'mls' | 'all'

export interface GameEvent {
  eventType: GameEventType
  sport: SportType
  team: string           // Team ID or abbreviation
  isHomeTeam: boolean
  gameId: string
  timestamp: Date
  metadata?: {
    player?: string
    score?: { home: number; away: number }
    period?: string | number
    [key: string]: unknown
  }
}

export type TriggerEffectType = 'strobe' | 'chase' | 'colorBurst' | 'rainbow' | 'pulse' | 'scene'

export interface TriggerConfig {
  id: string
  name: string
  enabled: boolean
  eventTypes: GameEventType[]
  sports: SportType[]
  teamFilter?: {
    teams?: string[]           // Team IDs to trigger for (empty = all teams)
    homeOnly?: boolean         // Only trigger for home team
    awayOnly?: boolean         // Only trigger for away team
  }
  effectType: TriggerEffectType
  effectConfig: StrobeConfig | ChaseConfig | ColorBurstConfig | RainbowConfig | PulseConfig | { sceneId: string; fadeTimeMs?: number }
  fixtureIds: string[]         // Fixture IDs to apply effect to
  cooldownMs: number           // Minimum time between triggers
  priority: number             // Higher priority triggers can override lower ones
}

export interface FixtureRegistry {
  fixtureId: string
  universe: number
  startChannel: number
  channelMap: Record<string, number>
}

interface TriggerState {
  lastTriggeredAt: Date | null
  activeEffectId: string | null
  triggerCount: number
}

/**
 * Game Event Reactor for DMX lighting
 * Automatically triggers lighting effects based on game events
 */
export class GameEventReactor extends EventEmitter {
  private triggers: Map<string, TriggerConfig> = new Map()
  private triggerStates: Map<string, TriggerState> = new Map()
  private fixtureRegistry: Map<string, FixtureRegistry> = new Map()
  private effectEngine: EffectEngine
  private sceneEngine: SceneEngine
  private enabled: boolean = true
  private globalCooldownMs: number = 2000 // Global cooldown between any triggers
  private lastGlobalTrigger: Date | null = null

  constructor(effectEngine?: EffectEngine, sceneEngine?: SceneEngine) {
    super()
    this.effectEngine = effectEngine ?? getEffectEngine()
    this.sceneEngine = sceneEngine ?? getSceneEngine()
  }

  /**
   * Enable or disable the reactor
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    dmxLogger.info('Game event reactor ' + (enabled ? 'enabled' : 'disabled'))
    this.emit('enabledChanged', enabled)
  }

  /**
   * Check if reactor is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Set global cooldown between any triggers
   */
  setGlobalCooldown(cooldownMs: number): void {
    this.globalCooldownMs = cooldownMs
  }

  /**
   * Register a fixture for use in triggers
   */
  registerFixture(fixture: FixtureRegistry): void {
    this.fixtureRegistry.set(fixture.fixtureId, fixture)
    dmxLogger.debug('Registered fixture for game events', { fixtureId: fixture.fixtureId })
  }

  /**
   * Unregister a fixture
   */
  unregisterFixture(fixtureId: string): void {
    this.fixtureRegistry.delete(fixtureId)
  }

  /**
   * Register a trigger configuration
   */
  registerTrigger(config: TriggerConfig): void {
    // Validate event types
    for (const eventType of config.eventTypes) {
      if (!GAME_EVENT_TYPES[eventType]) {
        throw new Error(`Invalid event type: ${eventType}`)
      }
    }

    this.triggers.set(config.id, config)
    this.triggerStates.set(config.id, {
      lastTriggeredAt: null,
      activeEffectId: null,
      triggerCount: 0,
    })

    dmxLogger.info('Registered game event trigger', {
      triggerId: config.id,
      name: config.name,
      eventTypes: config.eventTypes,
      sports: config.sports,
    })

    this.emit('triggerRegistered', config.id)
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(triggerId: string): void {
    const state = this.triggerStates.get(triggerId)
    if (state?.activeEffectId) {
      this.effectEngine.stopEffect(state.activeEffectId)
    }

    this.triggers.delete(triggerId)
    this.triggerStates.delete(triggerId)

    dmxLogger.info('Unregistered game event trigger', { triggerId })
    this.emit('triggerUnregistered', triggerId)
  }

  /**
   * Update an existing trigger
   */
  updateTrigger(triggerId: string, updates: Partial<TriggerConfig>): void {
    const existing = this.triggers.get(triggerId)
    if (!existing) {
      throw new Error(`Trigger not found: ${triggerId}`)
    }

    const updated = { ...existing, ...updates, id: triggerId }
    this.triggers.set(triggerId, updated)

    dmxLogger.info('Updated game event trigger', { triggerId, updates: Object.keys(updates) })
    this.emit('triggerUpdated', triggerId)
  }

  /**
   * Get all registered triggers
   */
  getActiveTriggers(): TriggerConfig[] {
    return Array.from(this.triggers.values()).filter(t => t.enabled)
  }

  /**
   * Get all triggers (including disabled)
   */
  getAllTriggers(): TriggerConfig[] {
    return Array.from(this.triggers.values())
  }

  /**
   * Get trigger by ID
   */
  getTrigger(triggerId: string): TriggerConfig | undefined {
    return this.triggers.get(triggerId)
  }

  /**
   * Get trigger state
   */
  getTriggerState(triggerId: string): TriggerState | undefined {
    return this.triggerStates.get(triggerId)
  }

  /**
   * Handle an incoming game event
   * This is the main entry point for processing game events
   */
  async handleGameEvent(event: GameEvent): Promise<{ triggered: boolean; triggerId?: string; effectId?: string }> {
    if (!this.enabled) {
      dmxLogger.debug('Game event reactor disabled, ignoring event', { eventType: event.eventType })
      return { triggered: false }
    }

    // Check global cooldown
    if (this.lastGlobalTrigger) {
      const elapsed = Date.now() - this.lastGlobalTrigger.getTime()
      if (elapsed < this.globalCooldownMs) {
        dmxLogger.debug('Global cooldown active, ignoring event', {
          eventType: event.eventType,
          remainingMs: this.globalCooldownMs - elapsed,
        })
        return { triggered: false }
      }
    }

    // Find matching triggers, sorted by priority
    const matchingTriggers = this.findMatchingTriggers(event)
      .sort((a, b) => b.priority - a.priority)

    if (matchingTriggers.length === 0) {
      dmxLogger.debug('No matching triggers for game event', {
        eventType: event.eventType,
        sport: event.sport,
        team: event.team,
      })
      return { triggered: false }
    }

    // Take the highest priority trigger that is not on cooldown
    for (const trigger of matchingTriggers) {
      const state = this.triggerStates.get(trigger.id)!

      // Check individual trigger cooldown
      if (state.lastTriggeredAt) {
        const elapsed = Date.now() - state.lastTriggeredAt.getTime()
        if (elapsed < trigger.cooldownMs) {
          dmxLogger.debug('Trigger on cooldown', {
            triggerId: trigger.id,
            remainingMs: trigger.cooldownMs - elapsed,
          })
          continue
        }
      }

      // Execute trigger
      const result = await this.executeTrigger(trigger, event)

      if (result.success) {
        // Update states
        state.lastTriggeredAt = new Date()
        state.activeEffectId = result.effectId ?? null
        state.triggerCount++
        this.lastGlobalTrigger = new Date()

        dmxLogger.gameEvent(event.eventType, true, {
          triggerId: trigger.id,
          triggerName: trigger.name,
          sport: event.sport,
          team: event.team,
          effectId: result.effectId,
        })

        this.emit('triggered', trigger.id, event, result.effectId)

        return {
          triggered: true,
          triggerId: trigger.id,
          effectId: result.effectId,
        }
      }
    }

    dmxLogger.gameEvent(event.eventType, false, {
      reason: 'all matching triggers on cooldown or failed',
      sport: event.sport,
      team: event.team,
    })

    return { triggered: false }
  }

  /**
   * Find all triggers that match an event
   */
  private findMatchingTriggers(event: GameEvent): TriggerConfig[] {
    const matching: TriggerConfig[] = []

    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) continue

      // Check event type
      if (!trigger.eventTypes.includes(event.eventType)) continue

      // Check sport
      if (!trigger.sports.includes('all') && !trigger.sports.includes(event.sport)) continue

      // Check team filter
      if (trigger.teamFilter) {
        const { teams, homeOnly, awayOnly } = trigger.teamFilter

        // Check specific teams
        if (teams && teams.length > 0 && !teams.includes(event.team)) continue

        // Check home/away filter
        if (homeOnly && !event.isHomeTeam) continue
        if (awayOnly && event.isHomeTeam) continue
      }

      matching.push(trigger)
    }

    return matching
  }

  /**
   * Execute a trigger's effect
   */
  private async executeTrigger(
    trigger: TriggerConfig,
    event: GameEvent
  ): Promise<{ success: boolean; effectId?: string }> {
    try {
      // Get fixtures for the trigger
      const fixtures = this.getFixturesForTrigger(trigger)

      if (fixtures.length === 0) {
        dmxLogger.warn('No fixtures available for trigger', { triggerId: trigger.id })
        return { success: false }
      }

      // Stop any currently active effect for this trigger
      const state = this.triggerStates.get(trigger.id)
      if (state?.activeEffectId) {
        this.effectEngine.stopEffect(state.activeEffectId)
      }

      if (trigger.effectType === 'scene') {
        // Handle scene recall
        const sceneConfig = trigger.effectConfig as { sceneId: string; fadeTimeMs?: number }
        // For scene triggers, we need to look up the scene data
        // This assumes the scene data would be provided elsewhere
        dmxLogger.info('Scene trigger executed', {
          triggerId: trigger.id,
          sceneId: sceneConfig.sceneId,
        })
        // Scene recall would be handled by the calling code
        this.emit('sceneTriggered', trigger.id, sceneConfig.sceneId, event)
        return { success: true }
      }

      // Handle effect triggers
      const effectId = this.effectEngine.startEffect(
        trigger.effectType as 'strobe' | 'chase' | 'colorBurst' | 'rainbow' | 'pulse',
        fixtures,
        trigger.effectConfig as StrobeConfig | ChaseConfig | ColorBurstConfig | RainbowConfig | PulseConfig
      )

      return { success: true, effectId }
    } catch (error) {
      dmxLogger.error('Failed to execute trigger', error, { triggerId: trigger.id })
      return { success: false }
    }
  }

  /**
   * Get effect fixtures for a trigger
   */
  private getFixturesForTrigger(trigger: TriggerConfig): EffectFixture[] {
    const fixtures: EffectFixture[] = []

    for (const fixtureId of trigger.fixtureIds) {
      const registry = this.fixtureRegistry.get(fixtureId)
      if (registry) {
        fixtures.push({
          fixtureId: registry.fixtureId,
          universe: registry.universe,
          startChannel: registry.startChannel,
          channelMap: registry.channelMap,
        })
      }
    }

    return fixtures
  }

  /**
   * Stop all active effects from triggers
   */
  stopAllTriggerEffects(): void {
    for (const state of this.triggerStates.values()) {
      if (state.activeEffectId) {
        this.effectEngine.stopEffect(state.activeEffectId)
        state.activeEffectId = null
      }
    }

    dmxLogger.info('Stopped all trigger effects')
    this.emit('allTriggerEffectsStopped')
  }

  /**
   * Reset all trigger cooldowns
   */
  resetCooldowns(): void {
    for (const state of this.triggerStates.values()) {
      state.lastTriggeredAt = null
    }
    this.lastGlobalTrigger = null

    dmxLogger.info('Reset all trigger cooldowns')
    this.emit('cooldownsReset')
  }

  /**
   * Get statistics for all triggers
   */
  getStats(): { triggerId: string; name: string; triggerCount: number; lastTriggered: Date | null }[] {
    const stats: { triggerId: string; name: string; triggerCount: number; lastTriggered: Date | null }[] = []

    for (const [triggerId, trigger] of this.triggers) {
      const state = this.triggerStates.get(triggerId)
      stats.push({
        triggerId,
        name: trigger.name,
        triggerCount: state?.triggerCount ?? 0,
        lastTriggered: state?.lastTriggeredAt ?? null,
      })
    }

    return stats
  }

  /**
   * Create preset triggers for common game events
   */
  createPresetTriggers(fixtures: string[], teamColors?: { primary: string; secondary: string }): void {
    const primaryColor = teamColors?.primary ?? '#ff0000'
    const secondaryColor = teamColors?.secondary ?? '#ffffff'

    // Goal celebration (hockey)
    this.registerTrigger({
      id: 'preset-goal',
      name: 'Goal Celebration',
      enabled: true,
      eventTypes: ['goal'],
      sports: ['nhl'],
      effectType: 'strobe',
      effectConfig: {
        rate: 10,
        duration: 5000,
        color: primaryColor,
      } as StrobeConfig,
      fixtureIds: fixtures,
      cooldownMs: 30000,
      priority: 100,
    })

    // Touchdown celebration
    this.registerTrigger({
      id: 'preset-touchdown',
      name: 'Touchdown Celebration',
      enabled: true,
      eventTypes: ['touchdown'],
      sports: ['nfl', 'ncaaf'],
      effectType: 'chase',
      effectConfig: {
        speed: 120,
        direction: 'bounce',
        duration: 6000,
        color: primaryColor,
      } as ChaseConfig,
      fixtureIds: fixtures,
      cooldownMs: 30000,
      priority: 100,
    })

    // Score change color burst
    this.registerTrigger({
      id: 'preset-score',
      name: 'Score Change',
      enabled: true,
      eventTypes: ['score-change'],
      sports: ['all'],
      effectType: 'colorBurst',
      effectConfig: {
        color: primaryColor,
        duration: 3000,
        fadeOutMs: 1500,
      } as ColorBurstConfig,
      fixtureIds: fixtures,
      cooldownMs: 15000,
      priority: 50,
    })

    // Game start rainbow
    this.registerTrigger({
      id: 'preset-game-start',
      name: 'Game Start',
      enabled: true,
      eventTypes: ['game-start'],
      sports: ['all'],
      effectType: 'rainbow',
      effectConfig: {
        speed: 30,
        duration: 10000,
      } as RainbowConfig,
      fixtureIds: fixtures,
      cooldownMs: 60000,
      priority: 30,
    })

    dmxLogger.info('Created preset triggers', { count: 4, fixtures: fixtures.length })
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAllTriggerEffects()
    this.triggers.clear()
    this.triggerStates.clear()
    this.fixtureRegistry.clear()
    this.removeAllListeners()
    dmxLogger.info('Game event reactor destroyed')
  }
}

// Export singleton instance
let gameEventReactorInstance: GameEventReactor | null = null

export function getGameEventReactor(): GameEventReactor {
  if (!gameEventReactorInstance) {
    gameEventReactorInstance = new GameEventReactor()
  }
  return gameEventReactorInstance
}

export { GameEventReactor as default }
