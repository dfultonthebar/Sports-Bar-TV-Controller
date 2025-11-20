/**
 * Distribution Engine
 *
 * Intelligently distributes games across TVs with:
 * - Overlap detection (no duplicate games)
 * - Channel reuse optimization (use already-tuned channels)
 * - Zone preference respect (main, bar, viewing-area)
 * - Minimum TV allocation (ensure priority games get enough screens)
 * - Default content handling (ESPN channels, Atmosphere TV)
 * - Provider diversity (Cable, DirecTV, Fire TV)
 */

import { getStateReader, SystemState, OutputState, AvailableInput } from './state-reader'
import { getPriorityCalculator, GameInfo, PriorityScore } from './priority-calculator'
import { getFireTVContentDetector, StreamingGame } from './firetv-content-detector'
import { logger } from '@/lib/logger'

export interface DistributionPlan {
  timestamp: string
  games: GameAssignment[]
  defaults: DefaultAssignment[]
  summary: {
    totalGames: number
    totalTVs: number
    assignedTVs: number
    idleTVs: number
    gamesWithMinTVs: number
  }
  reasoning: string[]
}

export interface GameAssignment {
  game: GameInfo
  priority: PriorityScore
  assignments: TVAssignment[]
  minTVsRequired: number
  minTVsMet: boolean
}

export interface TVAssignment {
  outputNumber: number
  zoneName?: string
  zoneType?: string
  inputNumber: number
  inputLabel: string
  channelNumber?: string
  requiresChannelChange: boolean
  alreadyTuned: boolean
}

export interface DefaultAssignment {
  outputNumber: number
  zoneName?: string
  contentType: 'espn' | 'atmosphere'
  inputNumber: number
  inputLabel: string
  channelNumber?: string
  requiresChannelChange: boolean
}

export class DistributionEngine {
  private stateReader = getStateReader()
  private priorityCalc = getPriorityCalculator()

  /**
   * Create distribution plan for games
   */
  async createDistributionPlan(games: GameInfo[]): Promise<DistributionPlan> {
    const timestamp = new Date().toISOString()
    const reasoning: string[] = []

    logger.info(`[DISTRIBUTION] Creating plan for ${games.length} games...`)
    reasoning.push(`Starting distribution for ${games.length} games`)

    // Get current system state
    const systemState = await this.stateReader.getSystemState()
    reasoning.push(
      `System: ${systemState.totalInputs} inputs, ${systemState.totalOutputs} outputs, ` +
      `${systemState.summary.activeGames} active games`
    )

    // Calculate priorities for all games
    const priorityScores = await this.priorityCalc.calculateMultipleGames(games)
    reasoning.push(`Priority scores calculated (range: ${priorityScores[0]?.finalScore || 0} - ${priorityScores[priorityScores.length - 1]?.finalScore || 0})`)

    // Track assigned outputs to prevent overlap
    const assignedOutputs = new Set<number>()
    const assignedGames = new Set<string>() // Track game IDs to prevent duplicates
    const assignedInputs = new Map<number, number>() // Track input usage: inputNumber -> game count

    // Game assignments
    const gameAssignments: GameAssignment[] = []

    // Distribute high-priority games first
    for (const score of priorityScores) {
      // Skip games with score of 0 (shouldn't happen anymore, but safety check)
      if (score.finalScore === 0) continue

      const game = games.find(g => g.id === score.gameId) || games[0]

      // For non-home-team games, use defaults: 1 TV, main/bar zones
      const minTVs = score.matchedTeam?.minTVsWhenActive || 1
      const preferredZones = score.matchedTeam
        ? this.priorityCalc.getPreferredZones(score)
        : ['main', 'bar']

      logger.debug(
        `[DISTRIBUTION] Assigning: ${game.homeTeam} vs ${game.awayTeam} ` +
        `(priority ${score.finalScore}, needs ${minTVs} TVs)`
      )

      // Find best input/channel for this game
      const assignments = await this.assignGameToTVs(
        game,
        score,
        systemState,
        assignedOutputs,
        assignedInputs,
        preferredZones,
        minTVs
      )

      const minTVsMet = assignments.length >= minTVs

      gameAssignments.push({
        game,
        priority: score,
        assignments,
        minTVsRequired: minTVs,
        minTVsMet
      })

      // Mark outputs as assigned and track input usage
      assignments.forEach(a => {
        assignedOutputs.add(a.outputNumber)
        // Track input usage for distribution (only count each input once per game)
      })

      // Track which input(s) were used for this game
      const inputsUsedForGame = new Set(assignments.map(a => a.inputNumber))
      inputsUsedForGame.forEach(inputNum => {
        assignedInputs.set(inputNum, (assignedInputs.get(inputNum) || 0) + 1)
      })

      if (!minTVsMet) {
        reasoning.push(
          `⚠️ ${game.homeTeam} vs ${game.awayTeam}: Only ${assignments.length}/${minTVs} TVs assigned`
        )
      } else {
        reasoning.push(
          `✅ ${game.homeTeam} vs ${game.awayTeam}: ${assignments.length} TVs in ${preferredZones.join(', ')}`
        )
      }
    }

    // Assign default content to idle TVs
    const defaults = await this.assignDefaultContent(systemState, assignedOutputs)
    reasoning.push(`Default content assigned to ${defaults.length} idle TVs`)

    const summary = {
      totalGames: gameAssignments.length,
      totalTVs: systemState.totalOutputs,
      assignedTVs: assignedOutputs.size,
      idleTVs: systemState.totalOutputs - assignedOutputs.size,
      gamesWithMinTVs: gameAssignments.filter(g => g.minTVsMet).length
    }

    logger.info(
      `[DISTRIBUTION] Plan complete: ${summary.totalGames} games, ` +
      `${summary.assignedTVs}/${summary.totalTVs} TVs assigned`
    )

    return {
      timestamp,
      games: gameAssignments,
      defaults,
      summary,
      reasoning
    }
  }

  /**
   * Assign a game to TVs
   */
  private async assignGameToTVs(
    game: GameInfo,
    score: PriorityScore,
    state: SystemState,
    assignedOutputs: Set<number>,
    assignedInputs: Map<number, number>,
    preferredZones: string[],
    minTVs: number
  ): Promise<TVAssignment[]> {
    const assignments: TVAssignment[] = []

    // Step 1: Check if game is already playing on any input (reuse)
    const existingInput = state.inputs.find(input => {
      if (!input.channelNumber) return false

      // Match channel number if available
      if (game.channelNumber && input.channelNumber === game.channelNumber) {
        return true
      }

      // Match by show name
      if (input.showName) {
        const showLower = input.showName.toLowerCase()
        return (
          showLower.includes(game.homeTeam.toLowerCase()) ||
          showLower.includes(game.awayTeam.toLowerCase())
        )
      }

      return false
    })

    if (existingInput) {
      logger.debug(`[DISTRIBUTION] Found existing input ${existingInput.inputNumber} for game`)

      // Assign all available outputs showing this input
      const outputsOnThisInput = state.outputs.filter(
        output =>
          output.currentInput === existingInput.inputNumber &&
          !assignedOutputs.has(output.outputNumber)
      )

      for (const output of outputsOnThisInput) {
        assignments.push({
          outputNumber: output.outputNumber,
          zoneName: output.zoneName,
          zoneType: output.zoneType,
          inputNumber: existingInput.inputNumber,
          inputLabel: existingInput.inputLabel,
          channelNumber: existingInput.channelNumber,
          requiresChannelChange: false,
          alreadyTuned: true
        })

        if (assignments.length >= minTVs) break
      }
    }

    // Step 2: If not enough TVs yet, find available inputs and assign more
    if (assignments.length < minTVs) {
      const availableOutputs = state.outputs.filter(
        output => !assignedOutputs.has(output.outputNumber)
      )

      // Sort by zone preference
      const sortedOutputs = this.sortOutputsByZonePreference(
        availableOutputs,
        preferredZones
      )

      // Get all available sports inputs (prefer Cable > DirecTV > Fire TV)
      const sportsInputs = await this.stateReader.getSportsInputs()
      const availableInputs = sportsInputs
        .filter(input => input.capabilities.canChangechannel)
        .sort((a, b) => {
          // Sort by usage count (least used first) to distribute games evenly
          const aUsage = assignedInputs.get(a.inputNumber) || 0
          const bUsage = assignedInputs.get(b.inputNumber) || 0
          if (aUsage !== bUsage) return aUsage - bUsage

          // If usage is equal, prioritize by device type: cable > directv > firetv
          const deviceTypeOrder = { cable: 1, directv: 2, firetv: 3, atmosphere: 4 }
          return (deviceTypeOrder[a.deviceType] || 999) - (deviceTypeOrder[b.deviceType] || 999)
        })

      // Use round-robin distribution across available inputs
      let inputIndex = 0
      if (availableInputs.length > 0 && game.channelNumber) {
        for (const output of sortedOutputs) {
          if (assignments.length >= minTVs) break

          // Check if output is already on a different input showing a game
          if (output.currentChannel?.isLiveEvent) continue

          // Select input using round-robin
          const selectedInput = availableInputs[inputIndex % availableInputs.length]
          inputIndex++

          assignments.push({
            outputNumber: output.outputNumber,
            zoneName: output.zoneName,
            zoneType: output.zoneType,
            inputNumber: selectedInput.inputNumber,
            inputLabel: selectedInput.label,
            channelNumber: game.channelNumber,
            requiresChannelChange: true,
            alreadyTuned: false
          })
        }
      }
    }

    return assignments
  }

  /**
   * Assign default content (ESPN, Atmosphere TV) to idle TVs
   */
  private async assignDefaultContent(
    state: SystemState,
    assignedOutputs: Set<number>
  ): Promise<DefaultAssignment[]> {
    const defaults: DefaultAssignment[] = []

    // Get idle outputs
    const idleOutputs = state.outputs.filter(
      output => !assignedOutputs.has(output.outputNumber)
    )

    if (idleOutputs.length === 0) return defaults

    logger.debug(`[DISTRIBUTION] Assigning default content to ${idleOutputs.length} idle TVs`)

    // Find ESPN inputs
    const espnInputs = state.inputs.filter(input => {
      const label = input.inputLabel?.toLowerCase() || ''
      const channel = input.channelName?.toLowerCase() || ''
      return label.includes('espn') || channel.includes('espn')
    })

    // Find Atmosphere TV input
    const atmosphereInput = state.availableInputs.find(
      input => input.deviceType === 'atmosphere'
    )

    let espnIndex = 0

    for (const output of idleOutputs) {
      // Determine zone type for content selection
      const isMainOrBar = ['main', 'bar', 'viewing-area'].includes(output.zoneType || '')

      if (isMainOrBar && espnInputs.length > 0) {
        // Main areas get ESPN channels
        const espnInput = espnInputs[espnIndex % espnInputs.length]
        espnIndex++

        defaults.push({
          outputNumber: output.outputNumber,
          zoneName: output.zoneName,
          contentType: 'espn',
          inputNumber: espnInput.inputNumber,
          inputLabel: espnInput.inputLabel,
          channelNumber: espnInput.channelNumber,
          requiresChannelChange: output.currentInput !== espnInput.inputNumber
        })
      } else if (atmosphereInput) {
        // Side areas get Atmosphere TV
        defaults.push({
          outputNumber: output.outputNumber,
          zoneName: output.zoneName,
          contentType: 'atmosphere',
          inputNumber: atmosphereInput.inputNumber,
          inputLabel: atmosphereInput.label,
          requiresChannelChange: output.currentInput !== atmosphereInput.inputNumber
        })
      } else if (espnInputs.length > 0) {
        // Fallback to ESPN if no Atmosphere
        const espnInput = espnInputs[0]

        defaults.push({
          outputNumber: output.outputNumber,
          zoneName: output.zoneName,
          contentType: 'espn',
          inputNumber: espnInput.inputNumber,
          inputLabel: espnInput.inputLabel,
          channelNumber: espnInput.channelNumber,
          requiresChannelChange: output.currentInput !== espnInput.inputNumber
        })
      }
    }

    return defaults
  }

  /**
   * Sort outputs by zone preference
   */
  private sortOutputsByZonePreference(
    outputs: OutputState[],
    preferredZones: string[]
  ): OutputState[] {
    return [...outputs].sort((a, b) => {
      const aZone = a.zoneType || 'other'
      const bZone = b.zoneType || 'other'

      const aIndex = preferredZones.indexOf(aZone)
      const bIndex = preferredZones.indexOf(bZone)

      // If both in preferred zones, compare by index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }

      // Preferred zones come first
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1

      return 0
    })
  }

  /**
   * Execute distribution plan (send commands to hardware)
   */
  async executePlan(plan: DistributionPlan): Promise<void> {
    logger.info(`[DISTRIBUTION] Executing plan for ${plan.games.length} games...`)

    // Execute game assignments
    for (const gameAssignment of plan.games) {
      for (const tv of gameAssignment.assignments) {
        if (tv.requiresChannelChange && tv.channelNumber) {
          logger.info(
            `[DISTRIBUTION] Tuning input ${tv.inputNumber} (${tv.inputLabel}) to channel ${tv.channelNumber}`
          )
          // TODO: Call channel tuning API
          // await tuneChannel(tv.inputNumber, tv.channelNumber)
        }

        if (tv.inputNumber) {
          logger.info(
            `[DISTRIBUTION] Routing output ${tv.outputNumber} (${tv.zoneName}) to input ${tv.inputNumber}`
          )
          // TODO: Call matrix routing API
          // await routeOutput(tv.outputNumber, tv.inputNumber)
        }
      }
    }

    // Execute default content assignments
    for (const defaultAssignment of plan.defaults) {
      if (defaultAssignment.requiresChannelChange) {
        logger.info(
          `[DISTRIBUTION] Setting output ${defaultAssignment.outputNumber} to ${defaultAssignment.contentType} ` +
          `(input ${defaultAssignment.inputNumber})`
        )
        // TODO: Call matrix routing API
        // await routeOutput(defaultAssignment.outputNumber, defaultAssignment.inputNumber)
      }
    }

    logger.info('[DISTRIBUTION] Plan execution complete')
  }

  /**
   * Validate distribution plan
   */
  validatePlan(plan: DistributionPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for duplicate output assignments
    const assignedOutputs = new Set<number>()
    for (const game of plan.games) {
      for (const tv of game.assignments) {
        if (assignedOutputs.has(tv.outputNumber)) {
          errors.push(`Output ${tv.outputNumber} assigned multiple times`)
        }
        assignedOutputs.add(tv.outputNumber)
      }
    }

    // Check for duplicate default assignments
    for (const def of plan.defaults) {
      if (assignedOutputs.has(def.outputNumber)) {
        errors.push(`Output ${def.outputNumber} has both game and default assignment`)
      }
      assignedOutputs.add(def.outputNumber)
    }

    // Check if high-priority games meet minimum TV requirements
    const criticalGames = plan.games.filter(
      g => g.priority.finalScore >= 90 && !g.minTVsMet
    )
    if (criticalGames.length > 0) {
      errors.push(
        `${criticalGames.length} critical games don't meet minimum TV requirements`
      )
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Singleton instance
let engineInstance: DistributionEngine | null = null

export function getDistributionEngine(): DistributionEngine {
  if (!engineInstance) {
    engineInstance = new DistributionEngine()
  }
  return engineInstance
}

export function resetDistributionEngine(): void {
  engineInstance = null
}
