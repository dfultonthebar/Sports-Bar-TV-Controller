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
import { logger } from '@sports-bar/logger'

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

export interface DistributionOptions {
  allowedOutputs?: number[] // Optional list of allowed output numbers (TV channels)
  allowedInputs?: number[] // Optional list of allowed input numbers (Cable boxes, DirecTV, etc.)
}

export class DistributionEngine {
  private stateReader = getStateReader()
  private priorityCalc = getPriorityCalculator()

  /**
   * Create distribution plan for games
   * @param games - List of games to distribute
   * @param options - Optional configuration including allowed outputs
   */
  async createDistributionPlan(games: GameInfo[], options: DistributionOptions = {}): Promise<DistributionPlan> {
    const timestamp = new Date().toISOString()
    const reasoning: string[] = []
    const { allowedOutputs, allowedInputs } = options

    logger.info(`[DISTRIBUTION] Creating plan for ${games.length} games...`)
    if (allowedOutputs && allowedOutputs.length > 0) {
      logger.info(`[DISTRIBUTION] Allowed outputs filter: ${allowedOutputs.join(', ')}`)
    }
    if (allowedInputs && allowedInputs.length > 0) {
      logger.info(`[DISTRIBUTION] Allowed inputs filter: ${allowedInputs.join(', ')}`)
    }

    // Create allowed inputs set for filtering
    const allowedInputsSet = allowedInputs && allowedInputs.length > 0 ? new Set(allowedInputs) : null
    reasoning.push(`Starting distribution for ${games.length} games`)

    // Get current system state
    const systemState = await this.stateReader.getSystemState()

    // Get available channels from presets
    const cableChannels = await this.stateReader.getAvailableChannels('cable')
    const directvChannels = await this.stateReader.getAvailableChannels('directv')
    logger.info(`[DISTRIBUTION] Available channels: ${cableChannels.size} cable, ${directvChannels.size} DirecTV`)

    // Count protected inputs (manual overrides)
    const protectedInputs = systemState.availableInputs.filter(input => !input.isAvailable)
    const protectedCount = protectedInputs.length

    reasoning.push(
      `System: ${systemState.totalInputs} inputs, ${systemState.totalOutputs} outputs, ` +
      `${systemState.summary.activeGames} active games`
    )

    if (protectedCount > 0) {
      const protectedLabels = protectedInputs.map(i => `#${i.inputNumber} (${i.label})`).join(', ')
      reasoning.push(`${protectedCount} input(s) protected from scheduling: ${protectedLabels}`)
      logger.info(`[DISTRIBUTION] ${protectedCount} inputs are protected by manual overrides or disabled`)
    }

    // Calculate priorities for all games
    let priorityScores;
    try {
      priorityScores = await this.priorityCalc.calculateMultipleGames(games)
      logger.info(`[DISTRIBUTION] Priority scores calculated for ${priorityScores.length} games`)
    } catch (priorityError: any) {
      logger.error('[DISTRIBUTION] Priority calculation error:', priorityError?.message || priorityError)
      logger.error('[DISTRIBUTION] Priority error stack:', priorityError?.stack)
      throw priorityError
    }
    reasoning.push(`Priority scores calculated (range: ${priorityScores[0]?.finalScore || 0} - ${priorityScores[priorityScores.length - 1]?.finalScore || 0})`)

    // Check if there are any home team games
    const hasHomeTeamGames = priorityScores.some(score => score.isHomeTeamGame)

    // Calculate available outputs (exclude audio-only outputs that have isSchedulingEnabled=false)
    // Also filter by allowedOutputs if provided
    let schedulableOutputs = systemState.outputs.filter(o => o.isSchedulingEnabled)

    if (allowedOutputs && allowedOutputs.length > 0) {
      const allowedSet = new Set(allowedOutputs)
      const beforeCount = schedulableOutputs.length
      schedulableOutputs = schedulableOutputs.filter(o => allowedSet.has(o.outputNumber))
      reasoning.push(`Filtered to ${schedulableOutputs.length} of ${beforeCount} outputs based on allowed TV selection`)
      logger.info(`[DISTRIBUTION] Filtered outputs from ${beforeCount} to ${schedulableOutputs.length} based on allowed outputs`)
    }

    const totalAvailableOutputs = schedulableOutputs.length

    logger.info(`[DISTRIBUTION] Total outputs: ${systemState.totalOutputs}, Schedulable outputs: ${totalAvailableOutputs}`)

    // Track assigned outputs to prevent overlap
    const assignedOutputs = new Set<number>()
    const assignedGames = new Set<string>() // Track game IDs to prevent duplicates
    const assignedInputs = new Map<number, number>() // Track input usage: inputNumber -> game count
    const inputGameMap = new Map<number, string>() // Track which game is on which input

    // Track which games are assigned to which TV groups
    const groupGameMap = new Map<string, Set<string>>()

    // Game assignments
    const gameAssignments: GameAssignment[] = []

    // Distribute high-priority games first
    for (const score of priorityScores) {
      // Skip games with score of 0
      if (score.finalScore === 0) continue

      const game = games.find(g => g.id === score.gameId) || games[0]

      // Calculate minimum TVs based on home team status
      let minTVs: number
      if (score.isHomeTeamGame) {
        // HOME TEAM GAMES → 50% MINIMUM
        minTVs = Math.ceil(totalAvailableOutputs * 0.5)
        reasoning.push(`Home team game detected: ${game.homeTeam} vs ${game.awayTeam} → enforcing ${minTVs}/${totalAvailableOutputs} TVs (50% minimum)`)
      } else if (!hasHomeTeamGames) {
        // NO HOME TEAM GAMES → FILL ALL TVs WITH BEST GAMES
        minTVs = Math.ceil(totalAvailableOutputs / Math.max(games.length, 1))
        reasoning.push(`No home team games active → distributing all games to all TVs (${minTVs} TVs per game)`)
      } else {
        // Regular priority-based allocation
        minTVs = score.matchedTeam?.minTVsWhenActive || 1
      }

      const preferredZones = score.matchedTeam
        ? this.priorityCalc.getPreferredZones(score)
        : ['main', 'bar']

      logger.debug(
        `[DISTRIBUTION] Assigning: ${game.homeTeam} vs ${game.awayTeam} ` +
        `(priority ${score.finalScore}, needs ${minTVs} TVs, isHomeTeam: ${score.isHomeTeamGame})`
      )

      // Find best input/channel for this game
      const assignments = await this.assignGameToTVs(
        game,
        score,
        systemState,
        assignedOutputs,
        assignedInputs,
        inputGameMap,
        cableChannels,
        directvChannels,
        preferredZones,
        minTVs,
        allowedInputsSet
      )

      const minTVsMet = assignments.length >= minTVs

      gameAssignments.push({
        game,
        priority: score,
        assignments,
        minTVsRequired: minTVs,
        minTVsMet
      })

      // Mark outputs as assigned
      const gameKey = `${game.homeTeam}-${game.awayTeam}`
      assignments.forEach(a => {
        assignedOutputs.add(a.outputNumber)

        const assignedOutput = systemState.outputs.find(o => o.outputNumber === a.outputNumber)
        if (assignedOutput?.tvGroupId) {
          if (!groupGameMap.has(assignedOutput.tvGroupId)) {
            groupGameMap.set(assignedOutput.tvGroupId, new Set())
          }
          groupGameMap.get(assignedOutput.tvGroupId)!.add(gameKey)
        }
      })

      // Track input usage
      const inputsUsedForGame = new Set(assignments.map(a => a.inputNumber))
      inputsUsedForGame.forEach(inputNum => {
        assignedInputs.set(inputNum, (assignedInputs.get(inputNum) || 0) + 1)
        inputGameMap.set(inputNum, gameKey)
      })

      if (!minTVsMet) {
        reasoning.push(
          `${game.homeTeam} vs ${game.awayTeam}: Only ${assignments.length}/${minTVs} TVs assigned`
        )
      } else {
        reasoning.push(
          `${game.homeTeam} vs ${game.awayTeam}: ${assignments.length} TVs in ${preferredZones.join(', ')}`
        )
      }
    }

    // Fill remaining TVs with round-robin distribution
    const remainingTVs = totalAvailableOutputs - assignedOutputs.size
    if (remainingTVs > 0 && gameAssignments.length > 0) {
      logger.info(`[DISTRIBUTION] Filling ${remainingTVs} remaining TVs with games (round-robin)...`)
      reasoning.push(`Filling ${remainingTVs} remaining TVs to maximize game coverage`)

      const allowedSet = allowedOutputs && allowedOutputs.length > 0 ? new Set(allowedOutputs) : null
      const unassignedOutputs = systemState.outputs.filter(output => {
        if (assignedOutputs.has(output.outputNumber)) return false
        if (!output.isSchedulingEnabled) return false
        if (output.hasManualOverride) return false
        if (allowedSet && !allowedSet.has(output.outputNumber)) return false
        return true
      })

      let gameIndex = 0
      for (const output of unassignedOutputs) {
        let selectedGameAssignment = null
        let selectedGame = null
        let selectedScore = null

        const outputGroupId = output.tvGroupId
        const gamesInGroup = outputGroupId ? (groupGameMap.get(outputGroupId) || new Set()) : new Set()

        for (let i = 0; i < gameAssignments.length; i++) {
          const candidateIndex = (gameIndex + i) % gameAssignments.length
          const candidateAssignment = gameAssignments[candidateIndex]
          const candidateGame = candidateAssignment.game
          const candidateGameKey = `${candidateGame.homeTeam}-${candidateGame.awayTeam}`

          if (outputGroupId && gamesInGroup.has(candidateGameKey) && !candidateAssignment.priority.isHomeTeamGame) {
            continue
          }

          selectedGameAssignment = candidateAssignment
          selectedGame = candidateGame
          selectedScore = candidateAssignment.priority
          gameIndex = candidateIndex + 1
          break
        }

        if (!selectedGameAssignment) {
          selectedGameAssignment = gameAssignments[gameIndex % gameAssignments.length]
          selectedGame = selectedGameAssignment.game
          selectedScore = selectedGameAssignment.priority
          gameIndex++
        }

        const game = selectedGame
        const score = selectedScore

        const sportsInputs = await this.stateReader.getSportsInputs()
        const availableInputs = sportsInputs
          .filter(input => {
            if (!input.isAvailable) return false
            if (allowedInputsSet && !allowedInputsSet.has(input.inputNumber)) return false
            if (!input.capabilities.canChangechannel) return false

            const existingGameKey = inputGameMap.get(input.inputNumber)
            const currentGameKey = `${game.homeTeam}-${game.awayTeam}`
            if (existingGameKey === currentGameKey) {
              if (score.isHomeTeamGame) return true
              return false
            }

            if (input.deviceType === 'directv' && game.directvChannel) {
              if (!directvChannels.has(game.directvChannel)) return false
              return true
            }
            if (input.deviceType === 'cable' && game.cableChannel) {
              if (!cableChannels.has(game.cableChannel)) return false
              return true
            }

            return false
          })
          .sort((a, b) => {
            const aUsage = assignedInputs.get(a.inputNumber) || 0
            const bUsage = assignedInputs.get(b.inputNumber) || 0
            if (aUsage !== bUsage) return aUsage - bUsage

            const deviceTypeOrder = { directv: 1, cable: 2, firetv: 3, atmosphere: 4 }
            return (deviceTypeOrder[a.deviceType] || 999) - (deviceTypeOrder[b.deviceType] || 999)
          })

        if (availableInputs.length > 0 && (game.cableChannel || game.directvChannel)) {
          const selectedInput = availableInputs[0]

          let channelToUse = ''
          if (selectedInput.deviceType === 'directv' && game.directvChannel) {
            channelToUse = game.directvChannel
          } else if (selectedInput.deviceType === 'cable' && game.cableChannel) {
            channelToUse = game.cableChannel
          } else {
            channelToUse = game.cableChannel || game.directvChannel || ''
          }

          if (channelToUse) {
            selectedGameAssignment!.assignments.push({
              outputNumber: output.outputNumber,
              zoneName: output.zoneName,
              zoneType: output.zoneType,
              inputNumber: selectedInput.inputNumber,
              inputLabel: selectedInput.label,
              channelNumber: channelToUse,
              requiresChannelChange: true,
              alreadyTuned: false
            })

            assignedOutputs.add(output.outputNumber)
            assignedInputs.set(selectedInput.inputNumber, (assignedInputs.get(selectedInput.inputNumber) || 0) + 1)
            const gameKey = `${game.homeTeam}-${game.awayTeam}`
            inputGameMap.set(selectedInput.inputNumber, gameKey)

            if (output.tvGroupId) {
              if (!groupGameMap.has(output.tvGroupId)) {
                groupGameMap.set(output.tvGroupId, new Set())
              }
              groupGameMap.get(output.tvGroupId)!.add(gameKey)
            }
          }
        }

        gameIndex++
      }

      const finalRemaining = totalAvailableOutputs - assignedOutputs.size
      if (finalRemaining === 0) {
        reasoning.push(`All ${totalAvailableOutputs} TVs assigned to games - 0 idle!`)
      } else {
        reasoning.push(`${finalRemaining} TVs could not be assigned to games (missing channel data)`)
      }
    }

    // Assign default content to remaining idle TVs
    const defaults = await this.assignDefaultContent(systemState, assignedOutputs, allowedOutputs)
    if (defaults.length > 0) {
      reasoning.push(`Default content assigned to ${defaults.length} idle TVs`)
    }

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
    inputGameMap: Map<number, string>,
    cableChannels: Set<string>,
    directvChannels: Set<string>,
    preferredZones: string[],
    minTVs: number,
    allowedInputsSet: Set<number> | null
  ): Promise<TVAssignment[]> {
    const assignments: TVAssignment[] = []

    // Check if game is already playing on any input
    const existingInput = state.inputs.find(input => {
      if (!input.channelNumber) return false
      if (input.channelNumber === game.cableChannel || input.channelNumber === game.directvChannel) {
        return true
      }
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

    // If not enough TVs yet, find available inputs
    if (assignments.length < minTVs) {
      const availableOutputs = state.outputs.filter(output => {
        if (assignedOutputs.has(output.outputNumber)) return false
        if (!output.isSchedulingEnabled) return false
        if (output.hasManualOverride) return false
        return true
      })

      const sortedOutputs = this.sortOutputsByZonePreference(availableOutputs, preferredZones)

      const sportsInputs = await this.stateReader.getSportsInputs()

      const availableInputs = sportsInputs
        .filter(input => {
          if (!input.isAvailable) return false
          if (allowedInputsSet && !allowedInputsSet.has(input.inputNumber)) return false
          if (!input.capabilities.canChangechannel) return false

          const existingGameKey = inputGameMap.get(input.inputNumber)
          const currentGameKey = `${game.homeTeam}-${game.awayTeam}`
          if (existingGameKey === currentGameKey) {
            if (score.isHomeTeamGame) return true
            return false
          }

          if (input.deviceType === 'directv' && game.directvChannel) {
            if (!directvChannels.has(game.directvChannel)) return false
            return true
          }
          if (input.deviceType === 'cable' && game.cableChannel) {
            if (!cableChannels.has(game.cableChannel)) return false
            return true
          }

          return false
        })
        .sort((a, b) => {
          const aUsage = assignedInputs.get(a.inputNumber) || 0
          const bUsage = assignedInputs.get(b.inputNumber) || 0
          if (aUsage !== bUsage) return aUsage - bUsage

          const deviceTypeOrder = { directv: 1, cable: 2, firetv: 3, atmosphere: 4 }
          return (deviceTypeOrder[a.deviceType] || 999) - (deviceTypeOrder[b.deviceType] || 999)
        })

      if (availableInputs.length > 0 && (game.cableChannel || game.directvChannel)) {
        const selectedInput = availableInputs[0]

        let channelToUse = ''
        if (selectedInput.deviceType === 'directv' && game.directvChannel) {
          channelToUse = game.directvChannel
        } else if (selectedInput.deviceType === 'cable' && game.cableChannel) {
          channelToUse = game.cableChannel
        } else {
          channelToUse = game.cableChannel || game.directvChannel || ''
        }

        if (channelToUse) {
          for (const output of sortedOutputs) {
            if (assignments.length >= minTVs) break
            if (output.currentChannel?.isLiveEvent) continue

            assignments.push({
              outputNumber: output.outputNumber,
              zoneName: output.zoneName,
              zoneType: output.zoneType,
              inputNumber: selectedInput.inputNumber,
              inputLabel: selectedInput.label,
              channelNumber: channelToUse,
              requiresChannelChange: true,
              alreadyTuned: false
            })
          }
        }
      }
    }

    return assignments
  }

  /**
   * Assign default content to idle TVs
   */
  private async assignDefaultContent(
    state: SystemState,
    assignedOutputs: Set<number>,
    allowedOutputs?: number[]
  ): Promise<DefaultAssignment[]> {
    const defaults: DefaultAssignment[] = []
    const allowedSet = allowedOutputs && allowedOutputs.length > 0 ? new Set(allowedOutputs) : null

    const idleOutputs = state.outputs.filter(output => {
      if (assignedOutputs.has(output.outputNumber)) return false
      if (!output.isSchedulingEnabled) return false
      if (allowedSet && !allowedSet.has(output.outputNumber)) return false
      return true
    })

    if (idleOutputs.length === 0) return defaults

    const espnInputs = state.inputs.filter(input => {
      const label = input.inputLabel?.toLowerCase() || ''
      const channel = input.channelName?.toLowerCase() || ''
      return label.includes('espn') || channel.includes('espn')
    })

    const atmosphereInput = state.availableInputs.find(
      input => input.deviceType === 'atmosphere'
    )

    let espnIndex = 0

    for (const output of idleOutputs) {
      const isMainOrBar = ['main', 'bar', 'viewing-area'].includes(output.zoneType || '')

      if (isMainOrBar && espnInputs.length > 0) {
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
        defaults.push({
          outputNumber: output.outputNumber,
          zoneName: output.zoneName,
          contentType: 'atmosphere',
          inputNumber: atmosphereInput.inputNumber,
          inputLabel: atmosphereInput.label,
          requiresChannelChange: output.currentInput !== atmosphereInput.inputNumber
        })
      } else if (espnInputs.length > 0) {
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

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }

      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1

      return 0
    })
  }

  /**
   * Execute distribution plan
   */
  async executePlan(plan: DistributionPlan): Promise<void> {
    logger.info(`[DISTRIBUTION] Executing plan for ${plan.games.length} games...`)

    for (const gameAssignment of plan.games) {
      for (const tv of gameAssignment.assignments) {
        if (tv.requiresChannelChange && tv.channelNumber) {
          logger.info(
            `[DISTRIBUTION] Tuning input ${tv.inputNumber} (${tv.inputLabel}) to channel ${tv.channelNumber}`
          )
        }

        if (tv.inputNumber) {
          logger.info(
            `[DISTRIBUTION] Routing output ${tv.outputNumber} (${tv.zoneName}) to input ${tv.inputNumber}`
          )
        }
      }
    }

    for (const defaultAssignment of plan.defaults) {
      if (defaultAssignment.requiresChannelChange) {
        logger.info(
          `[DISTRIBUTION] Setting output ${defaultAssignment.outputNumber} to ${defaultAssignment.contentType} ` +
          `(input ${defaultAssignment.inputNumber})`
        )
      }
    }

    logger.info('[DISTRIBUTION] Plan execution complete')
  }

  /**
   * Validate distribution plan
   */
  validatePlan(plan: DistributionPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    const assignedOutputs = new Set<number>()
    for (const game of plan.games) {
      for (const tv of game.assignments) {
        if (assignedOutputs.has(tv.outputNumber)) {
          errors.push(`Output ${tv.outputNumber} assigned multiple times`)
        }
        assignedOutputs.add(tv.outputNumber)
      }
    }

    for (const def of plan.defaults) {
      if (assignedOutputs.has(def.outputNumber)) {
        errors.push(`Output ${def.outputNumber} has both game and default assignment`)
      }
      assignedOutputs.add(def.outputNumber)
    }

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
