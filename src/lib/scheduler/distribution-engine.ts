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
      reasoning.push(`🔒 ${protectedCount} input(s) protected from scheduling: ${protectedLabels}`)
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
      reasoning.push(`🎯 Filtered to ${schedulableOutputs.length} of ${beforeCount} outputs based on allowed TV selection`)
      logger.info(`[DISTRIBUTION] Filtered outputs from ${beforeCount} to ${schedulableOutputs.length} based on allowed outputs`)
    }

    const totalAvailableOutputs = schedulableOutputs.length

    logger.info(`[DISTRIBUTION] Total outputs: ${systemState.totalOutputs}, Schedulable outputs: ${totalAvailableOutputs}`)

    // Track assigned outputs to prevent overlap
    const assignedOutputs = new Set<number>()
    const assignedGames = new Set<string>() // Track game IDs to prevent duplicates
    const assignedInputs = new Map<number, number>() // Track input usage: inputNumber -> game count
    const inputGameMap = new Map<number, string>() // Track which game is on which input: inputNumber -> unique game key (homeTeam-awayTeam)

    // Track which games are assigned to which TV groups (to avoid same game on adjacent TVs)
    const groupGameMap = new Map<string, Set<string>>() // groupId -> Set of gameKeys assigned to this group

    // Game assignments
    const gameAssignments: GameAssignment[] = []

    // Distribute high-priority games first
    for (const score of priorityScores) {
      // Skip games with score of 0 (shouldn't happen anymore, but safety check)
      if (score.finalScore === 0) continue

      const game = games.find(g => g.id === score.gameId) || games[0]

      // Calculate minimum TVs based on home team status
      let minTVs: number
      if (score.isHomeTeamGame) {
        // HOME TEAM GAMES → 50% MINIMUM
        minTVs = Math.ceil(totalAvailableOutputs * 0.5)
        reasoning.push(`🏠 Home team game detected: ${game.homeTeam} vs ${game.awayTeam} → enforcing ${minTVs}/${totalAvailableOutputs} TVs (50% minimum)`)
      } else if (!hasHomeTeamGames) {
        // NO HOME TEAM GAMES → FILL ALL TVs WITH BEST GAMES
        // Distribute all available games across all TVs aggressively
        minTVs = Math.ceil(totalAvailableOutputs / Math.max(games.length, 1))
        reasoning.push(`📺 No home team games active → distributing all games to all TVs (${minTVs} TVs per game)`)
      } else {
        // Regular priority-based allocation for non-home games when home games exist
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

      // Mark outputs as assigned and track input usage
      const gameKey = `${game.homeTeam}-${game.awayTeam}` // Unique identifier for this game
      assignments.forEach(a => {
        assignedOutputs.add(a.outputNumber)

        // Track which games are in each TV group (for group diversity)
        const assignedOutput = systemState.outputs.find(o => o.outputNumber === a.outputNumber)
        if (assignedOutput?.tvGroupId) {
          if (!groupGameMap.has(assignedOutput.tvGroupId)) {
            groupGameMap.set(assignedOutput.tvGroupId, new Set())
          }
          groupGameMap.get(assignedOutput.tvGroupId)!.add(gameKey)
        }
      })

      // Track which input(s) were used for this game
      const inputsUsedForGame = new Set(assignments.map(a => a.inputNumber))
      inputsUsedForGame.forEach(inputNum => {
        assignedInputs.set(inputNum, (assignedInputs.get(inputNum) || 0) + 1)
        // Track which game is on which input using team-based key
        inputGameMap.set(inputNum, gameKey)
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

    // TASK 1: FILL ALL REMAINING TVs WITH GAMES (round-robin distribution)
    const remainingTVs = totalAvailableOutputs - assignedOutputs.size
    if (remainingTVs > 0 && gameAssignments.length > 0) {
      logger.info(`[DISTRIBUTION] Filling ${remainingTVs} remaining TVs with games (round-robin)...`)
      reasoning.push(`📺 Filling ${remainingTVs} remaining TVs to maximize game coverage`)

      // Get all unassigned outputs (excluding bartender-protected TVs, audio-only outputs, and non-allowed outputs)
      const allowedSet = allowedOutputs && allowedOutputs.length > 0 ? new Set(allowedOutputs) : null
      const unassignedOutputs = systemState.outputs.filter(output => {
        if (assignedOutputs.has(output.outputNumber)) return false

        // Skip outputs not enabled for scheduling (audio-only outputs)
        if (!output.isSchedulingEnabled) {
          logger.debug(`[DISTRIBUTION] Round-robin: Skipping output ${output.outputNumber} (${output.zoneName}) - audio-only output`)
          return false
        }

        // Skip outputs protected by bartender manual override
        if (output.hasManualOverride) {
          logger.debug(`[DISTRIBUTION] Round-robin: Skipping output ${output.outputNumber} (${output.zoneName}) - bartender override active`)
          return false
        }

        // Skip outputs not in allowed list (if filter is active)
        if (allowedSet && !allowedSet.has(output.outputNumber)) {
          logger.debug(`[DISTRIBUTION] Round-robin: Skipping output ${output.outputNumber} (${output.zoneName}) - not in allowed outputs`)
          return false
        }

        return true
      })

      // Round-robin through games in priority order
      let gameIndex = 0
      for (const output of unassignedOutputs) {
        // Check TV group diversity - find a game that's NOT already in this output's group
        let selectedGameAssignment = null
        let selectedGame = null
        let selectedScore = null

        const outputGroupId = output.tvGroupId
        const gamesInGroup = outputGroupId ? (groupGameMap.get(outputGroupId) || new Set()) : new Set()

        // Try each game starting from round-robin position
        for (let i = 0; i < gameAssignments.length; i++) {
          const candidateIndex = (gameIndex + i) % gameAssignments.length
          const candidateAssignment = gameAssignments[candidateIndex]
          const candidateGame = candidateAssignment.game
          const candidateGameKey = `${candidateGame.homeTeam}-${candidateGame.awayTeam}`

          // Check if this game is already in the same TV group
          if (outputGroupId && gamesInGroup.has(candidateGameKey) && !candidateAssignment.priority.isHomeTeamGame) {
            logger.debug(`[DISTRIBUTION] Round-robin: Skipping ${candidateGame.homeTeam} vs ${candidateGame.awayTeam} for output ${output.outputNumber} - already in TV group ${outputGroupId}`)
            continue // Try next game
          }

          // Found a suitable game
          selectedGameAssignment = candidateAssignment
          selectedGame = candidateGame
          selectedScore = candidateAssignment.priority
          gameIndex = candidateIndex + 1 // Advance to next game for round-robin
          break
        }

        // If no suitable game found (all games in group), just use the round-robin selection
        if (!selectedGameAssignment) {
          selectedGameAssignment = gameAssignments[gameIndex % gameAssignments.length]
          selectedGame = selectedGameAssignment.game
          selectedScore = selectedGameAssignment.priority
          gameIndex++
        }

        const game = selectedGame
        const score = selectedScore

        // Find best input for this game
        const sportsInputs = await this.stateReader.getSportsInputs()
        const availableInputs = sportsInputs
          .filter(input => {
            // Must be available (not protected by manual override or disabled)
            if (!input.isAvailable) {
              logger.debug(`[DISTRIBUTION] Skipping input ${input.inputNumber} (${input.label}) - protected by manual override or disabled`)
              return false
            }

            // Must be in allowed inputs list (if filter is active)
            if (allowedInputsSet && !allowedInputsSet.has(input.inputNumber)) {
              logger.debug(`[DISTRIBUTION] Skipping input ${input.inputNumber} (${input.label}) - not in allowed inputs`)
              return false
            }

            // Must be able to change channels
            if (!input.capabilities.canChangechannel) return false

            // Check if this input is already showing this game (avoid duplicate in round-robin)
            const existingGameKey = inputGameMap.get(input.inputNumber)
            const currentGameKey = `${game.homeTeam}-${game.awayTeam}`
            if (existingGameKey === currentGameKey) {
              // For home team games, allow reusing the same input on multiple outputs
              if (score.isHomeTeamGame) {
                logger.debug(`[DISTRIBUTION] Round-robin: Input ${input.inputNumber} already has home team game - allowing reuse`)
                return true
              } else {
                // For regular games, skip this input to avoid unnecessary duplication
                logger.debug(`[DISTRIBUTION] Round-robin: Input ${input.inputNumber} already showing ${game.homeTeam} vs ${game.awayTeam} - skipping to avoid duplication`)
                return false
              }
            }

            // Filter by device type matching available channels (deviceType is normalized to lowercase)
            // CRITICAL: Also verify channel exists in presets
            if (input.deviceType === 'directv' && game.directvChannel) {
              if (!directvChannels.has(game.directvChannel)) {
                logger.debug(`[DISTRIBUTION] Skipping DirecTV input ${input.inputNumber}: channel ${game.directvChannel} not in presets`)
                return false
              }
              return true
            }
            if (input.deviceType === 'cable' && game.cableChannel) {
              if (!cableChannels.has(game.cableChannel)) {
                logger.debug(`[DISTRIBUTION] Skipping cable input ${input.inputNumber}: channel ${game.cableChannel} not in presets`)
                return false
              }
              return true
            }

            // Don't include if no matching channel for this device type
            return false
          })
          .sort((a, b) => {
            const aUsage = assignedInputs.get(a.inputNumber) || 0
            const bUsage = assignedInputs.get(b.inputNumber) || 0
            if (aUsage !== bUsage) return aUsage - bUsage

            // Match device preference: directv > cable > firetv
            const deviceTypeOrder = { directv: 1, cable: 2, firetv: 3, atmosphere: 4 }
            return (deviceTypeOrder[a.deviceType] || 999) - (deviceTypeOrder[b.deviceType] || 999)
          })

        if (availableInputs.length > 0 && (game.cableChannel || game.directvChannel)) {
          // Select input (prefer least used)
          const selectedInput = availableInputs[0]

          // Determine correct channel based on input device type (normalized to lowercase)
          let channelToUse = ''
          if (selectedInput.deviceType === 'directv' && game.directvChannel) {
            channelToUse = game.directvChannel
            logger.info(`[DISTRIBUTION] DirecTV input ${selectedInput.label} assigned DirecTV channel ${channelToUse} for ${game.homeTeam} vs ${game.awayTeam}`)
          } else if (selectedInput.deviceType === 'cable' && game.cableChannel) {
            channelToUse = game.cableChannel
            logger.info(`[DISTRIBUTION] Cable input ${selectedInput.label} assigned cable channel ${channelToUse} for ${game.homeTeam} vs ${game.awayTeam}`)
          } else {
            channelToUse = game.cableChannel || game.directvChannel || ''
            logger.warn(`[DISTRIBUTION] Fallback channel selection for ${selectedInput.label} (${selectedInput.deviceType}): ${channelToUse}`)
          }

          if (channelToUse) {
            // Add assignment to existing game
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

            // Track assignment
            assignedOutputs.add(output.outputNumber)
            assignedInputs.set(selectedInput.inputNumber, (assignedInputs.get(selectedInput.inputNumber) || 0) + 1)
            const gameKey = `${game.homeTeam}-${game.awayTeam}`
            inputGameMap.set(selectedInput.inputNumber, gameKey)

            // Track TV group assignment for group diversity
            if (output.tvGroupId) {
              if (!groupGameMap.has(output.tvGroupId)) {
                groupGameMap.set(output.tvGroupId, new Set())
              }
              groupGameMap.get(output.tvGroupId)!.add(gameKey)
            }

            logger.debug(
              `[DISTRIBUTION] Added TV ${output.outputNumber} to ${game.homeTeam} vs ${game.awayTeam} ` +
              `(total: ${selectedGameAssignment!.assignments.length} TVs${output.tvGroupId ? `, group: ${output.tvGroupId}` : ''})`
            )
          }
        }

        // Move to next game for next TV
        gameIndex++
      }

      const finalRemaining = totalAvailableOutputs - assignedOutputs.size
      if (finalRemaining === 0) {
        reasoning.push(`✅ All ${totalAvailableOutputs} TVs assigned to games - 0 idle!`)
        logger.info(`[DISTRIBUTION] Successfully assigned all ${totalAvailableOutputs} TVs to games`)
      } else {
        reasoning.push(`⚠️ ${finalRemaining} TVs could not be assigned to games (missing channel data)`)
      }
    }

    // Assign default content to any remaining idle TVs (fallback only)
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

    // Step 1: Check if game is already playing on any input (reuse)
    const existingInput = state.inputs.find(input => {
      if (!input.channelNumber) return false

      // Match channel number if available (check both cable and DirecTV channels)
      if (input.channelNumber === game.cableChannel || input.channelNumber === game.directvChannel) {
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
      const availableOutputs = state.outputs.filter(output => {
        // Skip already assigned outputs
        if (assignedOutputs.has(output.outputNumber)) return false

        // Skip outputs not enabled for scheduling (audio-only outputs)
        if (!output.isSchedulingEnabled) {
          logger.debug(`[DISTRIBUTION] Skipping output ${output.outputNumber} (${output.zoneName}) - audio-only output`)
          return false
        }

        // Skip outputs protected by bartender manual override
        if (output.hasManualOverride) {
          logger.debug(`[DISTRIBUTION] Skipping output ${output.outputNumber} (${output.zoneName}) - protected by bartender override until ${output.manualOverrideUntil}`)
          return false
        }

        return true
      })

      // Sort by zone preference
      const sortedOutputs = this.sortOutputsByZonePreference(
        availableOutputs,
        preferredZones
      )

      // Get all available sports inputs (prefer Cable > DirecTV > Fire TV)
      const sportsInputs = await this.stateReader.getSportsInputs()
      logger.debug(`[DISTRIBUTION] Found ${sportsInputs.length} sports inputs for ${game.homeTeam} vs ${game.awayTeam}`)

      const availableInputs = sportsInputs
        .filter(input => {
          // Must be available (not protected by manual override or disabled)
          if (!input.isAvailable) {
            logger.debug(`[DISTRIBUTION] Skipping input ${input.inputNumber} (${input.label}) - protected by manual override or disabled`)
            return false
          }

          // Must be in allowed inputs list (if filter is active)
          if (allowedInputsSet && !allowedInputsSet.has(input.inputNumber)) {
            logger.debug(`[DISTRIBUTION] Skipping input ${input.inputNumber} (${input.label}) - not in allowed inputs`)
            return false
          }

          // Must be able to change channels
          if (!input.capabilities.canChangechannel) return false

          // Check if this input is already showing this game (avoid duplicate)
          const existingGameKey = inputGameMap.get(input.inputNumber)
          const currentGameKey = `${game.homeTeam}-${game.awayTeam}`
          if (existingGameKey === currentGameKey) {
            // For home team games, allow reusing the same input on multiple outputs
            if (score.isHomeTeamGame) {
              logger.debug(`[DISTRIBUTION] Input ${input.inputNumber} already has home team game - allowing reuse`)
              return true
            } else {
              // For regular games, skip this input to avoid unnecessary duplication
              logger.debug(`[DISTRIBUTION] Input ${input.inputNumber} already showing ${game.homeTeam} vs ${game.awayTeam} - skipping to avoid duplication`)
              return false
            }
          }

          // Filter by device type matching available channels (deviceType is normalized to lowercase)
          // CRITICAL: Also verify channel exists in presets
          if (input.deviceType === 'directv' && game.directvChannel) {
            if (!directvChannels.has(game.directvChannel)) {
              logger.debug(`[DISTRIBUTION] Skipping DirecTV input ${input.inputNumber}: channel ${game.directvChannel} not in presets`)
              return false
            }
            return true
          }
          if (input.deviceType === 'cable' && game.cableChannel) {
            if (!cableChannels.has(game.cableChannel)) {
              logger.debug(`[DISTRIBUTION] Skipping cable input ${input.inputNumber}: channel ${game.cableChannel} not in presets`)
              return false
            }
            return true
          }

          // Don't include if no matching channel for this device type
          return false
        })
        .sort((a, b) => {
          // Sort by usage count (least used first) to distribute games evenly
          const aUsage = assignedInputs.get(a.inputNumber) || 0
          const bUsage = assignedInputs.get(b.inputNumber) || 0
          if (aUsage !== bUsage) return aUsage - bUsage

          // If usage is equal, prioritize by device type: directv > cable > firetv
          const deviceTypeOrder = { directv: 1, cable: 2, firetv: 3, atmosphere: 4 }
          return (deviceTypeOrder[a.deviceType] || 999) - (deviceTypeOrder[b.deviceType] || 999)
        })

      logger.debug(`[DISTRIBUTION] ${availableInputs.length} inputs can change channels and have game in presets`)
      logger.debug(`[DISTRIBUTION] Game channel number: ${game.channelNumber || 'MISSING'}`)
      logger.debug(`[DISTRIBUTION] Available outputs: ${availableOutputs.length}`)

      // Select ONE input for this game, then route multiple outputs to it if needed
      if (availableInputs.length > 0 && (game.cableChannel || game.directvChannel)) {
        // Pick the best available input (least used, preferred device type)
        const selectedInput = availableInputs[0] // Already sorted by usage and device type preference

        // Determine correct channel based on input device type (normalized to lowercase)
        let channelToUse = ''
        if (selectedInput.deviceType === 'directv' && game.directvChannel) {
          channelToUse = game.directvChannel
        } else if (selectedInput.deviceType === 'cable' && game.cableChannel) {
          channelToUse = game.cableChannel
        } else {
          // Fallback: try to match any available channel
          channelToUse = game.cableChannel || game.directvChannel || ''
        }

        if (channelToUse) {
          // Assign multiple outputs to the SAME input
          for (const output of sortedOutputs) {
            if (assignments.length >= minTVs) break

            // Check if output is already on a different input showing a game
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
        } else {
          logger.warn(
            `[DISTRIBUTION] Skipping ${selectedInput.label} (${selectedInput.deviceType}): ` +
            `Game channel not available (cable: ${game.cableChannel || 'N/A'}, directv: ${game.directvChannel || 'N/A'})`
          )
        }
      } else {
        // Log why assignment was skipped
        if (availableInputs.length === 0) {
          logger.warn(`[DISTRIBUTION] Cannot assign ${game.homeTeam} vs ${game.awayTeam}: No inputs with channel change capability`)
        } else if (!game.cableChannel && !game.directvChannel) {
          logger.warn(`[DISTRIBUTION] Cannot assign ${game.homeTeam} vs ${game.awayTeam}: Missing channel number in both cable and DirecTV presets`)
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
    assignedOutputs: Set<number>,
    allowedOutputs?: number[]
  ): Promise<DefaultAssignment[]> {
    const defaults: DefaultAssignment[] = []
    const allowedSet = allowedOutputs && allowedOutputs.length > 0 ? new Set(allowedOutputs) : null

    // Get idle outputs (also filter by allowed outputs if specified)
    const idleOutputs = state.outputs.filter(output => {
      if (assignedOutputs.has(output.outputNumber)) return false
      if (!output.isSchedulingEnabled) return false
      if (allowedSet && !allowedSet.has(output.outputNumber)) return false
      return true
    })

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
