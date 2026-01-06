/**
 * Smart Input Allocator
 * Intelligently allocates games to input sources (cable boxes, Fire TVs, etc.)
 * to avoid interrupting priority games and maximize viewer satisfaction
 */

import { db, schema, eq, and, gte, lte, isNull } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export interface InputSource {
  id: string;
  name: string;
  type: 'cable' | 'directv' | 'firetv';
  deviceId?: string;
  matrixInputId?: string;
  availableNetworks: string[];
  installedApps?: string[];
  isActive: boolean;
  currentlyAllocated: boolean;
  priorityRank: number;
}

export interface GameSchedule {
  id: string;
  espnEventId: string;
  sport: string;
  league: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledStart: Date;
  estimatedEnd: Date;
  status: string;
  primaryNetwork?: string;
  broadcastNetworks: string[];
  calculatedPriority: number;
  isPriorityGame: boolean;
}

export interface AllocationRequest {
  gameId: string;
  tvOutputIds: string[]; // Which TVs should show this game
  preferredNetwork?: string;
  forceAllocation?: boolean; // Override conflicts
}

export interface AllocationResult {
  success: boolean;
  allocationId?: string;
  inputSourceId?: string;
  channelNumber?: string;
  appName?: string;
  message: string;
  conflicts?: Array<{
    inputSourceId: string;
    currentGameId: string;
    currentGameName: string;
    preemptionRequired: boolean;
  }>;
}

class SmartInputAllocator {
  /**
   * Allocate a game to the best available input source
   */
  async allocateGame(request: AllocationRequest): Promise<AllocationResult> {
    try {
      logger.info(`[ALLOCATOR] Allocating game ${request.gameId} to ${request.tvOutputIds.length} TVs`);

      // Get game details
      const game = await this.getGame(request.gameId);
      if (!game) {
        return {
          success: false,
          message: 'Game not found',
        };
      }

      // Get all input sources
      const inputSources = await this.getInputSources();
      if (inputSources.length === 0) {
        return {
          success: false,
          message: 'No input sources available',
        };
      }

      // Step 1: Find inputs that can show this game's network
      const capableInputs = this.findCapableInputs(game, inputSources, request.preferredNetwork);
      if (capableInputs.length === 0) {
        return {
          success: false,
          message: `No input sources can show ${request.preferredNetwork || game.primaryNetwork || 'this game'}`,
        };
      }

      logger.debug(`[ALLOCATOR] Found ${capableInputs.length} capable inputs`);

      // Step 2: Check for idle inputs (best case - no interruption)
      const idleInputs = await this.findIdleInputs(capableInputs, game.scheduledStart, game.estimatedEnd);
      if (idleInputs.length > 0) {
        // Allocate to best idle input
        const bestInput = this.selectBestInput(idleInputs);
        return await this.createAllocation(game, bestInput, request);
      }

      logger.debug('[ALLOCATOR] No idle inputs available, checking for conflicts');

      // Step 3: Check for inputs that will be free soon
      const soonFreeInputs = await this.findSoonFreeInputs(
        capableInputs,
        game.scheduledStart,
        game.estimatedEnd
      );

      if (soonFreeInputs.length > 0) {
        const bestInput = this.selectBestInput(soonFreeInputs);
        return await this.createAllocation(game, bestInput, request, {
          waitForFree: true,
          expectedFreeAt: game.scheduledStart,
        });
      }

      // Step 4: Handle conflicts - need to preempt a lower priority game
      const conflicts = await this.detectConflicts(capableInputs, game.scheduledStart, game.estimatedEnd);

      if (conflicts.length === 0) {
        return {
          success: false,
          message: 'All inputs are busy with higher priority games',
        };
      }

      // Check if this game has higher priority than conflicts
      const canPreempt = conflicts.some(c => c.gamePriority < game.calculatedPriority);

      if (!canPreempt && !request.forceAllocation) {
        return {
          success: false,
          message: 'Cannot preempt higher priority games',
          conflicts: conflicts.map(c => ({
            inputSourceId: c.inputSourceId,
            currentGameId: c.gameId,
            currentGameName: c.gameName,
            preemptionRequired: true,
          })),
        };
      }

      // Preempt the lowest priority conflict
      const lowestPriorityConflict = conflicts.sort((a, b) => a.gamePriority - b.gamePriority)[0];
      return await this.createAllocation(game, lowestPriorityConflict.inputSource, request, {
        preempts: lowestPriorityConflict.allocationId,
      });

    } catch (error: any) {
      logger.error('[ALLOCATOR] Error allocating game:', { error });
      return {
        success: false,
        message: `Allocation failed: ${error.message}`,
      };
    }
  }

  /**
   * Find input sources capable of showing a game's network
   */
  private findCapableInputs(
    game: GameSchedule,
    inputSources: InputSource[],
    preferredNetwork?: string
  ): InputSource[] {
    const targetNetwork = preferredNetwork || game.primaryNetwork;
    if (!targetNetwork) {
      // No network specified, all inputs capable
      return inputSources.filter(i => i.isActive);
    }

    return inputSources.filter(i => {
      if (!i.isActive) return false;

      // Check if network is available on this input
      const hasNetwork = i.availableNetworks.includes(targetNetwork);

      // For streaming-only networks (ESPN+, Peacock), check if app is installed on Fire TV
      if (i.type === 'firetv' && i.installedApps) {
        const streamingApps = ['ESPN', 'Peacock', 'Paramount+', 'Apple TV'];
        return streamingApps.some(app =>
          targetNetwork.includes(app) && i.installedApps!.includes(app)
        );
      }

      return hasNetwork;
    });
  }

  /**
   * Find inputs that are completely free during the game window
   */
  private async findIdleInputs(
    inputSources: InputSource[],
    startTime: Date,
    endTime: Date
  ): Promise<InputSource[]> {
    const idle: InputSource[] = [];
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.floor(endTime.getTime() / 1000);

    for (const input of inputSources) {
      const allocations = await db
        .select()
        .from(schema.inputSourceAllocations)
        .where(
          and(
            eq(schema.inputSourceAllocations.inputSourceId, input.id),
            eq(schema.inputSourceAllocations.status, 'active'),
            // Check for time overlap
            lte(schema.inputSourceAllocations.allocatedAt, endTimestamp),
            gte(schema.inputSourceAllocations.expectedFreeAt, startTimestamp)
          )
        );

      if (allocations.length === 0) {
        idle.push(input);
      }
    }

    return idle;
  }

  /**
   * Find inputs that will be free before the game starts
   */
  private async findSoonFreeInputs(
    inputSources: InputSource[],
    gameStartTime: Date,
    gameEndTime: Date
  ): Promise<InputSource[]> {
    const soonFree: InputSource[] = [];
    const startTimestamp = Math.floor(gameStartTime.getTime() / 1000);

    for (const input of inputSources) {
      const allocations = await db
        .select()
        .from(schema.inputSourceAllocations)
        .where(
          and(
            eq(schema.inputSourceAllocations.inputSourceId, input.id),
            eq(schema.inputSourceAllocations.status, 'active'),
            lte(schema.inputSourceAllocations.expectedFreeAt, startTimestamp)
          )
        );

      if (allocations.length > 0) {
        soonFree.push(input);
      }
    }

    return soonFree;
  }

  /**
   * Detect conflicts with existing allocations
   */
  private async detectConflicts(
    inputSources: InputSource[],
    startTime: Date,
    endTime: Date
  ): Promise<Array<{
    inputSourceId: string;
    inputSource: InputSource;
    allocationId: string;
    gameId: string;
    gameName: string;
    gamePriority: number;
  }>> {
    const conflicts: Array<any> = [];
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.floor(endTime.getTime() / 1000);

    for (const input of inputSources) {
      const allocations = await db
        .select({
          allocation: schema.inputSourceAllocations,
          game: schema.gameSchedules,
        })
        .from(schema.inputSourceAllocations)
        .innerJoin(
          schema.gameSchedules,
          eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id)
        )
        .where(
          and(
            eq(schema.inputSourceAllocations.inputSourceId, input.id),
            eq(schema.inputSourceAllocations.status, 'active'),
            // Time overlap check
            lte(schema.inputSourceAllocations.allocatedAt, endTimestamp),
            gte(schema.inputSourceAllocations.expectedFreeAt, startTimestamp)
          )
        );

      allocations.forEach(({ allocation, game }) => {
        conflicts.push({
          inputSourceId: input.id,
          inputSource: input,
          allocationId: allocation.id,
          gameId: game.id,
          gameName: `${game.awayTeamName} @ ${game.homeTeamName}`,
          gamePriority: game.calculatedPriority,
        });
      });
    }

    return conflicts;
  }

  /**
   * Select the best input from available options
   */
  private selectBestInput(inputs: InputSource[]): InputSource {
    // Sort by priority rank (lower is better)
    return inputs.sort((a, b) => a.priorityRank - b.priorityRank)[0];
  }

  /**
   * Create an allocation record
   */
  private async createAllocation(
    game: GameSchedule,
    inputSource: InputSource,
    request: AllocationRequest,
    options?: {
      waitForFree?: boolean;
      expectedFreeAt?: Date;
      preempts?: string;
    }
  ): Promise<AllocationResult> {
    try {
      const allocationId = crypto.randomUUID();

      // Determine channel/app based on input type
      let channelNumber: string | null = null;
      let appName: string | null = null;

      if (inputSource.type === 'cable' || inputSource.type === 'directv') {
        // For cable/DirecTV, we'll need to map network to channel
        channelNumber = request.preferredNetwork || game.primaryNetwork || null;
      } else if (inputSource.type === 'firetv') {
        // For Fire TV, use the app name
        appName = this.mapNetworkToApp(game.primaryNetwork || '');
      }

      const allocationData = {
        id: allocationId,
        inputSourceId: inputSource.id,
        inputSourceType: inputSource.type, // Required: 'cable', 'directv', or 'firetv'
        gameScheduleId: game.id,
        channelNumber,
        appName,
        tvOutputIds: JSON.stringify(request.tvOutputIds),
        tvCount: request.tvOutputIds.length,
        allocatedAt: Math.floor(Date.now() / 1000), // Unix timestamp
        expectedFreeAt: Math.floor(game.estimatedEnd.getTime() / 1000), // Unix timestamp
        status: options?.waitForFree ? 'pending' : 'active',
        preemptedByAllocationId: options?.preempts || null,
        allocationQuality: this.calculateAllocationQuality(inputSource, game),
      };

      // Wrap the allocation insert in a retry loop to handle race conditions
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await db.insert(schema.inputSourceAllocations).values(allocationData);
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.code === 'SQLITE_CONSTRAINT' && attempt < maxRetries - 1) {
            // Race condition - another request allocated this input, retry with different input
            logger.warn(`[ALLOCATOR] Allocation race detected on attempt ${attempt + 1}, retrying...`);
            // Re-check for idle inputs and update inputSource if needed
            const game = await this.getGame(request.gameId);
            if (!game) throw new Error('Game not found during retry');

            const inputSources = await this.getInputSources();
            const capableInputs = this.findCapableInputs(game, inputSources, request.preferredNetwork);
            const idleInputs = await this.findIdleInputs(capableInputs, game.scheduledStart, game.estimatedEnd);

            if (idleInputs.length === 0) {
              throw new Error('No idle inputs available after race condition');
            }

            // Select a different input source
            const newInput = this.selectBestInput(idleInputs);
            allocationData.inputSourceId = newInput.id;
            continue;
          }
          throw error;
        }
      }

      // If preempting, mark old allocation as preempted
      if (options?.preempts) {
        await db
          .update(schema.inputSourceAllocations)
          .set({
            status: 'preempted',
            actuallyFreedAt: Math.floor(Date.now() / 1000), // Unix timestamp
          })
          .where(eq(schema.inputSourceAllocations.id, options.preempts));

        logger.info(`[ALLOCATOR] Preempted allocation ${options.preempts} for higher priority game`);
      }

      logger.info(
        `[ALLOCATOR] Created allocation ${allocationId}: ${game.awayTeamName} @ ${game.homeTeamName} on ${inputSource.name}`
      );

      return {
        success: true,
        allocationId,
        inputSourceId: inputSource.id,
        channelNumber: channelNumber || undefined,
        appName: appName || undefined,
        message: `Allocated to ${inputSource.name}${options?.waitForFree ? ' (waiting for current game to finish)' : ''}`,
      };
    } catch (error: any) {
      logger.error('[ALLOCATOR] Error creating allocation:', { error });
      throw error;
    }
  }

  /**
   * Calculate allocation quality score
   */
  private calculateAllocationQuality(inputSource: InputSource, game: GameSchedule): string {
    // Prefer native broadcasts (cable/satellite) over streaming
    if ((inputSource.type === 'cable' || inputSource.type === 'directv') && game.primaryNetwork) {
      return 'excellent';
    }

    if (inputSource.type === 'firetv' && game.primaryNetwork) {
      return 'good';
    }

    return 'fair';
  }

  /**
   * Map broadcast network to streaming app
   */
  private mapNetworkToApp(network: string): string | null {
    const networkAppMap: Record<string, string> = {
      'ESPN': 'ESPN',
      'ESPN2': 'ESPN',
      'ESPNU': 'ESPN',
      'ESPN+': 'ESPN',
      'NBC': 'Peacock',
      'Peacock': 'Peacock',
      'CBS': 'Paramount+',
      'Paramount+': 'Paramount+',
      'FOX': 'Fox Sports',
      'FS1': 'Fox Sports',
      'FS2': 'Fox Sports',
    };

    return networkAppMap[network] || null;
  }

  /**
   * Free an allocation when game ends
   */
  async freeAllocation(allocationId: string): Promise<void> {
    try {
      await db
        .update(schema.inputSourceAllocations)
        .set({
          status: 'completed',
          actuallyFreedAt: new Date(),
        })
        .where(eq(schema.inputSourceAllocations.id, allocationId));

      logger.info(`[ALLOCATOR] Freed allocation ${allocationId}`);
    } catch (error: any) {
      logger.error('[ALLOCATOR] Error freeing allocation:', { error });
    }
  }

  /**
   * Get game details
   */
  private async getGame(gameId: string): Promise<GameSchedule | null> {
    const games = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.id, gameId))
      .limit(1);

    if (games.length === 0) {
      return null;
    }

    const game = games[0];
    return {
      id: game.id,
      espnEventId: game.espnEventId,
      sport: game.sport,
      league: game.league,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      scheduledStart: new Date(game.scheduledStart),
      estimatedEnd: new Date(game.estimatedEnd),
      status: game.status,
      primaryNetwork: game.primaryNetwork || undefined,
      broadcastNetworks: JSON.parse(game.broadcastNetworks || '[]'),
      calculatedPriority: game.calculatedPriority,
      isPriorityGame: game.isPriorityGame,
    };
  }

  /**
   * Get all input sources
   */
  private async getInputSources(): Promise<InputSource[]> {
    const sources = await db.select().from(schema.inputSources);

    return sources.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type as 'cable' | 'directv' | 'firetv',
      deviceId: s.deviceId || undefined,
      matrixInputId: s.matrixInputId || undefined,
      availableNetworks: JSON.parse(s.availableNetworks),
      installedApps: s.installedApps ? JSON.parse(s.installedApps) : undefined,
      isActive: s.isActive,
      currentlyAllocated: s.currentlyAllocated,
      priorityRank: s.priorityRank,
    }));
  }
}

export const smartInputAllocator = new SmartInputAllocator()
