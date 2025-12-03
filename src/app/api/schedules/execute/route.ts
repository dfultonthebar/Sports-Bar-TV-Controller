
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db'
import { findMany, inArray } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq, and, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { getTeamMatcher } from '@/lib/scheduler/team-name-matcher'
import { getPriorityCalculator } from '@/lib/scheduler/priority-calculator'
import { getDistributionEngine } from '@/lib/scheduler/distribution-engine'
import { getStateReader } from '@/lib/scheduler/state-reader'
import type { GameInfo } from '@/lib/scheduler/priority-calculator'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'
// POST - Execute a schedule immediately
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { scheduleId, allowedOutputs } = bodyValidation.data as { scheduleId?: string; allowedOutputs?: number[] };

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = await db.select().from(schema.schedules).where(eq(schema.schedules.id, scheduleId)).limit(1).get();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Log allowed outputs if specified
    if (allowedOutputs && allowedOutputs.length > 0) {
      logger.info(`[SCHEDULE_EXECUTE] Allowed outputs filter: ${allowedOutputs.join(', ')}`);
    }

    // Execute the schedule with optional allowed outputs filter
    const result = await executeSchedule(schedule, allowedOutputs);

    // Update schedule execution stats
    await db.update(schema.schedules).set({
        lastExecuted: new Date().toISOString(),
        executionCount: schedule.executionCount + 1,
        lastResult: JSON.stringify(result)
      }).where(eq(schema.schedules.id, scheduleId as string)).returning().get();

    // Log the execution - determine meaningful device/channel names
    let logDeviceName = 'Unknown';
    let logChannelName = 'Unknown';

    // Check if this is a matrix-based schedule (new system)
    if (schedule.selectedOutputs && Array.isArray(JSON.parse(schedule.selectedOutputs || '[]')) && JSON.parse(schedule.selectedOutputs || '[]').length > 0) {
      const outputCount = JSON.parse(schedule.selectedOutputs).length;
      logDeviceName = `Matrix Schedule (${outputCount} outputs)`;
      logChannelName = schedule.name || 'Multi-Channel';
    } else if (schedule.deviceId) {
      // Old single-device schedule
      logDeviceName = schedule.deviceId;
      logChannelName = schedule.channelName || 'Unknown';
    } else {
      // Fallback - use schedule name
      logDeviceName = schedule.name || 'Unknown';
      logChannelName = 'Auto';
    }

    await db.insert(schema.scheduleLogs).values({
        scheduleId: schedule.id,
        success: result.success,
        error: result.message || (result.errors ? JSON.stringify(result.errors) : null),
        channelName: logChannelName,
        deviceName: logDeviceName
      }).returning().get();

    return NextResponse.json({ result });
  } catch (error: any) {
    logger.error('Error executing schedule:', error);
    return NextResponse.json(
      { error: 'Failed to execute schedule', details: error.message },
      { status: 500 }
    );
  }
}

async function executeSchedule(schedule: any, allowedOutputs?: number[]) {
  const result: any = {
    success: false,
    message: '',
    details: {},
    gamesFound: 0,
    tvsControlled: 0,
    channelsSet: 0,
    errors: [] as any[]
  };

  try {
    // Step 0: Check if this is a midnight schedule - clear cache and pre-fetch next day
    const isMidnightSchedule = schedule.executionTime === '00:00' || schedule.name?.toLowerCase().includes('closing');
    if (isMidnightSchedule) {
      logger.info('[MIDNIGHT] Detected midnight schedule - clearing sports guide cache');

      try {
        // Clear sports guide cache to remove old games
        const clearCacheResponse = await fetch('http://localhost:3001/api/sports-guide/clear-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (clearCacheResponse.ok) {
          logger.info('[MIDNIGHT] Cache cleared successfully');
        }

        // Pre-fetch next 7 days of games to warm up cache for tomorrow
        logger.info('[MIDNIGHT] Pre-fetching next 7 days of games');
        const preFetchResponse = await fetch('http://localhost:3001/api/sports-guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: 7 })
        });

        if (preFetchResponse.ok) {
          const data = await preFetchResponse.json();
          logger.info(`[MIDNIGHT] Pre-fetched ${data.data?.games?.length || 0} games for next 7 days`);
        }
      } catch (error: any) {
        logger.warn('[MIDNIGHT] Cache clear/pre-fetch failed (non-critical):', error.message);
        // Don't fail the entire schedule if cache operations fail
      }
    }

    const selectedOutputs = JSON.parse(schedule.selectedOutputs || '[]');
    
    if (selectedOutputs.length === 0) {
      result.errors.push('No outputs selected');
      result.message = 'No TVs to control';
      return result;
    }

    // Get output details
    const outputs = await findMany('matrixOutputs', {
      where: inArray(schema.matrixOutputs.id, selectedOutputs)
    });

    // Load allowed outputs from database (set by bartender in AI Game Plan modal)
    // This allows bartenders to dynamically control which TVs the AI scheduler can use
    let allowedOutputChannels: number[] = [];
    try {
      const allowedOutputsResponse = await fetch('http://localhost:3001/api/schedules/ai-allowed-outputs');
      const allowedOutputsResult = await allowedOutputsResponse.json();
      if (allowedOutputsResult.success && allowedOutputsResult.allowedOutputs?.length > 0) {
        allowedOutputChannels = allowedOutputsResult.allowedOutputs;
        logger.info(`[SCHEDULE] Allowed output channels from bartender settings: [${allowedOutputChannels.join(', ')}]`);
      } else {
        // Fall back to schedule's selectedOutputs if no bartender setting
        allowedOutputChannels = outputs.map(o => o.channelNumber).filter(n => n != null);
        logger.info(`[SCHEDULE] Allowed output channels from schedule (fallback): [${allowedOutputChannels.join(', ')}]`);
      }
    } catch (err: any) {
      logger.warn(`[SCHEDULE] Could not load bartender allowed outputs: ${err.message}`);
      // Fall back to schedule's selectedOutputs
      allowedOutputChannels = outputs.map(o => o.channelNumber).filter(n => n != null);
      logger.info(`[SCHEDULE] Allowed output channels from schedule (fallback): [${allowedOutputChannels.join(', ')}]`);
    }

    // Load allowed inputs from database (set by bartender in AI Game Plan modal)
    // This allows bartenders to control which input sources (Cable boxes, DirecTV, etc.) the AI can use
    let allowedInputChannels: number[] = [];
    try {
      const allowedInputsResponse = await fetch('http://localhost:3001/api/schedules/ai-allowed-inputs');
      const allowedInputsResult = await allowedInputsResponse.json();
      if (allowedInputsResult.success && allowedInputsResult.allowedInputs?.length > 0) {
        allowedInputChannels = allowedInputsResult.allowedInputs;
        logger.info(`[SCHEDULE] Allowed input channels from bartender settings: [${allowedInputChannels.join(', ')}]`);
      } else {
        // No input restriction - allow all inputs
        logger.info(`[SCHEDULE] No input restriction set - all inputs allowed`);
      }
    } catch (err: any) {
      logger.warn(`[SCHEDULE] Could not load bartender allowed inputs: ${err.message}`);
      // No restriction - allow all inputs
      logger.info(`[SCHEDULE] Allowed inputs load failed - all inputs allowed`);
    }

    // Step 1: Power on/off TVs if requested
    // TODO: Implement IR-based TV power control (CEC removed)
    if (schedule.powerOnTVs || schedule.powerOffTVs) {
      logger.info('[SCHEDULE] TV power control not yet implemented (CEC removed, awaiting IR implementation)')
      // for (const output of outputs) {
      //   // Future: Add IR-based TV power control here
      //   await new Promise(resolve => setTimeout(resolve, schedule.delayBetweenCommands));
      // }
    }

    // Step 2: Apply audio settings if enabled
    if (schedule.audioSettings) {
      try {
        const audioSettings = typeof schedule.audioSettings === 'string'
          ? JSON.parse(schedule.audioSettings)
          : schedule.audioSettings;

        if (audioSettings.enabled && audioSettings.zones && audioSettings.zones.length > 0) {
          logger.info(`[SCHEDULE] Applying audio settings for ${audioSettings.zones.length} zones`);

          // Get the first active processor
          const processor = await db.select().from(schema.audioProcessors).where(eq(schema.audioProcessors.status, 'online')).limit(1).get();

          if (!processor) {
            logger.warn('[SCHEDULE] No active audio processor found - skipping audio settings');
            result.errors.push('No active audio processor found');
          } else {
            for (const zone of audioSettings.zones) {
              try {
                // Extract zone number from zoneId (e.g., "zone-0" → 0)
                const zoneNumber = parseInt(zone.zoneId.split('-')[1]);

                // Update zone settings in database
                await db.update(schema.audioZones)
                  .set({
                    volume: zone.volume,
                    muted: zone.muted === true ? 1 : 0,
                    currentSource: zone.source,
                    updatedAt: new Date().toISOString()
                  })
                  .where(and(
                    eq(schema.audioZones.processorId, processor.id),
                    eq(schema.audioZones.zoneNumber, zoneNumber)
                  ))
                  .returning().get();

                logger.info(`[SCHEDULE] Updated database for zone ${zone.zoneName}: volume=${zone.volume}, source=${zone.source}`);

                // Send commands to Atlas hardware
                try {
                  // Set volume
                  const volumeResponse = await fetch('http://localhost:3001/api/audio-processor/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      processorId: processor.id,
                      command: {
                        action: 'volume',
                        zone: zoneNumber + 1,  // Convert 0-based to 1-based
                        value: zone.volume
                      }
                    })
                  });

                  if (!volumeResponse.ok) {
                    const errorData = await volumeResponse.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(`Volume command failed: ${errorData.error || 'Unknown error'}`);
                  }

                  // Set source
                  const sourceResponse = await fetch('http://localhost:3001/api/audio-processor/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      processorId: processor.id,
                      command: {
                        action: 'source',
                        zone: zoneNumber + 1,  // Convert 0-based to 1-based
                        value: String(zone.source)
                      }
                    })
                  });

                  if (!sourceResponse.ok) {
                    const errorData = await sourceResponse.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(`Source command failed: ${errorData.error || 'Unknown error'}`);
                  }

                  // Set mute state if needed
                  if (zone.muted !== undefined) {
                    const muteResponse = await fetch('http://localhost:3001/api/audio-processor/control', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        processorId: processor.id,
                        command: {
                          action: 'mute',
                          zone: zoneNumber + 1,
                          value: zone.muted
                        }
                      })
                    });

                    if (!muteResponse.ok) {
                      const errorData = await muteResponse.json().catch(() => ({ error: 'Unknown error' }));
                      throw new Error(`Mute command failed: ${errorData.error || 'Unknown error'}`);
                    }
                  }

                  logger.info(`[SCHEDULE] Applied audio hardware commands to zone ${zone.zoneName}: volume=${zone.volume}, source=${zone.source}, muted=${zone.muted || false}`);
                } catch (hardwareError: any) {
                  logger.error(`[SCHEDULE] Error sending commands to Atlas hardware for ${zone.zoneName}:`, hardwareError);
                  result.errors.push(`Hardware control error for ${zone.zoneName}: ${hardwareError.message}`);
                }
              } catch (error: any) {
                logger.error(`[SCHEDULE] Error applying audio to ${zone.zoneName}:`, error);
                result.errors.push(`Error applying audio to ${zone.zoneName}: ${error.message}`);
              }

              // Delay between audio commands
              await new Promise(resolve => setTimeout(resolve, schedule.delayBetweenCommands || 500));
            }
          }
        }
      } catch (error: any) {
        logger.error('[SCHEDULE] Error parsing/applying audio settings:', error);
        result.errors.push(`Audio settings error: ${error.message}`);
      }
    }

    // Step 3: Find games if enabled
    let gameAssignments: any = {};
    let aiSchedulerExecuted = false; // Track if AI scheduler handled everything
    if (schedule.autoFindGames && schedule.monitorHomeTeams) {
      const homeTeamIds = JSON.parse(schedule.homeTeamIds || '[]');

      if (homeTeamIds.length > 0) {
        // Use allowedOutputChannels from schedule's selectedOutputs, or fall back to parameter
        const effectiveAllowedOutputs = allowedOutputChannels.length > 0 ? allowedOutputChannels : allowedOutputs;
        const effectiveAllowedInputs = allowedInputChannels.length > 0 ? allowedInputChannels : undefined;
        const gamesResult = await findHomeTeamGames(homeTeamIds, schedule, effectiveAllowedOutputs, effectiveAllowedInputs);
        gameAssignments = gamesResult.assignments;
        result.gamesFound = gamesResult.gamesFound;
        result.details.games = gamesResult.games;
        result.channelsSet = gamesResult.channelsSet || 0;
        result.tvsControlled = gamesResult.tvsControlled || 0;  // Copy TVs controlled count
        aiSchedulerExecuted = gamesResult.aiSchedulerExecuted || false; // Check if AI handled execution
      }
    }

    // Step 4: Set channels
    const defaultChannelMap = schedule.defaultChannelMap
      ? JSON.parse(schedule.defaultChannelMap)
      : {};

    const inputDefaultChannels = schedule.inputDefaultChannels
      ? JSON.parse(schedule.inputDefaultChannels)
      : {};

    // Process channels if any of these are configured
    // Skip manual channel setting if AI scheduler already executed the distribution plan
    if (!aiSchedulerExecuted && (schedule.setDefaultChannels || Object.keys(gameAssignments).length > 0 || Object.keys(inputDefaultChannels).length > 0)) {

      for (const output of outputs) {
        let inputId: string | null = null;
        let channel: string | null = null;

        // Priority: Game assignment > Per-output default > Per-input default
        if (gameAssignments[output.id]) {
          inputId = gameAssignments[output.id].inputId;
          channel = gameAssignments[output.id].channel;
        } else if (defaultChannelMap[output.id]) {
          const mapping = defaultChannelMap[output.id];
          inputId = mapping.inputId;
          channel = mapping.channel;
        } else if (Object.keys(inputDefaultChannels).length > 0) {
          // Simplified approach - distribute outputs across inputs with default channels
          // Get all inputs with default channels configured
          const inputsWithDefaults = Object.keys(inputDefaultChannels);

          if (inputsWithDefaults.length > 0) {
            // Distribute outputs round-robin across inputs with defaults
            const outputIndex = outputs.findIndex(o => o.id === output.id);
            const inputIndex = outputIndex % inputsWithDefaults.length;
            const assignedInputId = inputsWithDefaults[inputIndex];

            inputId = assignedInputId;
            channel = inputDefaultChannels[assignedInputId];
            logger.info(`[SCHEDULE] Distributing ${output.label} to input with default channel ${channel}`);
          }
        }

        if (inputId && channel) {
          try {
            // Look up the input to get its channel number
            const input = await db.select().from(schema.matrixInputs).where(eq(schema.matrixInputs.id, inputId)).limit(1).get();

            if (!input) {
              result.errors.push(`Input not found for ${output.label}`);
              continue;
            }

            logger.info(`[SCHEDULE] Routing ${output.label} to ${input.label} (input ${input.channelNumber}) channel ${channel}`);

            // Route the matrix
            const routeResponse = await fetch(`http://localhost:3001/api/matrix/route`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: input.channelNumber,
                output: output.channelNumber
              })
            });

            if (routeResponse.ok) {
              result.channelsSet++;

              // Send channel change command to input device
              await changeChannel(input, channel);
            } else {
              const errorData = await routeResponse.json().catch(() => ({ error: 'Unknown error' }));
              result.errors.push(`Failed to route ${output.label}: ${errorData.error || 'Unknown error'}`);
            }
          } catch (error: any) {
            result.errors.push(`Error setting channel for ${output.label}: ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, schedule.delayBetweenCommands));
        }
      }
    }

    result.success = result.errors.length === 0;
    result.message = result.success 
      ? `Successfully controlled ${result.tvsControlled} TVs and set ${result.channelsSet} channels`
      : `Completed with ${result.errors.length} errors`;

  } catch (error: any) {
    result.errors.push(`Execution error: ${error.message}`);
    result.message = 'Execution failed';
  }

  return result;
}

async function findHomeTeamGames(homeTeamIds: string[], schedule: any, allowedOutputs?: number[], allowedInputs?: number[]) {
  const result: {
    gamesFound: number;
    assignments: any;
    games: any[];
    tvsControlled?: number;
    channelsSet?: number;
    aiSchedulerExecuted?: boolean;
    errors?: string[];
  } = {
    gamesFound: 0,
    assignments: {} as any,
    games: [] as any[],
    tvsControlled: 0,
    channelsSet: 0,
    aiSchedulerExecuted: false,
    errors: []
  };

  try {
    // Get home teams
    const homeTeamsList = await findMany('homeTeams', {
      where: inArray(schema.homeTeams.id, homeTeamIds)
    });

    // Get today's date range
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Start time should include currently live games (games that started up to 4 hours ago)
    const startOfWindow = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // 4 hours ago

    // Search for games in channel guide data
    // This would integrate with your existing TV guide APIs
    const fillWithSports = schedule.fillWithSports !== false; // Default true if not set
    const games = await searchForGames(homeTeamsList, startOfWindow, endOfDay, fillWithSports);

    result.games = games;
    result.gamesFound = games.length;

    // ENRICH GAMES WITH ESPN LIVE DATA
    logger.info('[AI_SCHEDULER] Enriching games with ESPN live data...')
    const espnDataByLeague = new Map<string, any[]>()

    // Group games by league and fetch ESPN data
    const leaguesInUse = new Set<string>()
    for (const game of games) {
      if (game.league) {
        leaguesInUse.add(game.league)
      }
    }

    // Fetch ESPN data for each league
    for (const league of leaguesInUse) {
      const espnMapping = mapLeagueToESPN(league)
      if (espnMapping) {
        try {
          const espnGames = await espnScoreboardAPI.getTodaysGames(espnMapping.sport, espnMapping.league)
          logger.info(`[AI_SCHEDULER] Fetched ${espnGames.length} ESPN games for ${league}`)
          espnDataByLeague.set(league, espnGames)
        } catch (error: any) {
          logger.error(`[AI_SCHEDULER] Failed to fetch ESPN data for ${league}:`, error.message)
        }
      }
    }

    // Enrich each game with ESPN live data
    for (const game of games) {
      if (game.league) {
        const espnGames = espnDataByLeague.get(game.league)
        if (espnGames) {
          const matchedGame = matchGameByTeams(espnGames, game.homeTeam, game.awayTeam)
          if (matchedGame) {
            game.espnData = {
              homeScore: matchedGame.homeTeam.score,
              awayScore: matchedGame.awayTeam.score,
              clock: matchedGame.status.displayClock,
              period: matchedGame.status.period,
              statusState: matchedGame.status.type.state, // 'pre', 'in', 'post'
              statusDetail: matchedGame.status.type.shortDetail,
              isLive: espnScoreboardAPI.isLive(matchedGame),
              isCompleted: espnScoreboardAPI.isCompleted(matchedGame),
            }
            logger.debug(`[AI_SCHEDULER] Enriched ${game.homeTeam} vs ${game.awayTeam} with ESPN data (${game.espnData.statusState})`)
          }
        }
      }
    }

    // Check if AI scheduler is enabled (default to true if table doesn't exist)
    let aiSchedulerEnabled = true;
    try {
      const schedulerSettings = await db.all(sql`SELECT enabled FROM SmartSchedulerSettings WHERE id = 'default' LIMIT 1`)
      aiSchedulerEnabled = schedulerSettings.length > 0 ? schedulerSettings[0].enabled === 1 : true
    } catch (settingsError: any) {
      logger.warn(`[SCHEDULER] Could not read SmartSchedulerSettings (table may not exist): ${settingsError?.message}`)
      // Default to enabled
      aiSchedulerEnabled = true
    }

    logger.info(`[SCHEDULER] AI scheduler enabled: ${aiSchedulerEnabled}, games found: ${games.length}`)

    if (!aiSchedulerEnabled) {
      logger.info('[SCHEDULER] AI Smart Scheduler is DISABLED - skipping intelligent distribution')
      return result
    }

    // AI-POWERED DISTRIBUTION: Assign games to outputs using intelligent distribution engine
    if (games.length > 0) {
      logger.info(`[AI_SCHEDULER] Starting intelligent distribution for ${games.length} games`);

      // Transform games into format for AI scheduler
      const gameInfos: GameInfo[] = games.map(game => ({
        id: game.id || `${game.homeTeam}-${game.awayTeam}`,
        homeTeam: game.homeTeam || game.home || '',
        awayTeam: game.awayTeam || game.away || '',
        sport: game.sport || undefined,
        league: game.league || undefined,
        startTime: game.startTime || game.time,
        description: game.description || game.title || '',
        channelNumber: game.channelNumber || game.channel || undefined,
        cableChannel: game.cableChannel || undefined,
        directvChannel: game.directvChannel || undefined,
        channelName: game.channelName || game.network || undefined
      }));

      // Create intelligent distribution plan with optional allowed outputs filter
      logger.info('[AI_SCHEDULER] Getting distribution engine...');
      const distributionEngine = getDistributionEngine();
      logger.info('[AI_SCHEDULER] Distribution engine obtained, creating plan...');
      let distributionPlan;
      try {
        logger.info('[AI_SCHEDULER] Calling createDistributionPlan...');
        distributionPlan = await distributionEngine.createDistributionPlan(gameInfos, { allowedOutputs, allowedInputs });
        logger.info('[AI_SCHEDULER] Distribution plan created successfully');
      } catch (distError: any) {
        logger.error('[AI_SCHEDULER] Distribution engine error:', distError);
        logger.error('[AI_SCHEDULER] Distribution error message:', distError?.message);
        logger.error('[AI_SCHEDULER] Distribution error stack:', distError?.stack);
        logger.error('[AI_SCHEDULER] Distribution error type:', typeof distError);
        if (distError === undefined) {
          logger.error('[AI_SCHEDULER] Error is undefined!');
        } else if (distError === null) {
          logger.error('[AI_SCHEDULER] Error is null!');
        }
        throw distError; // Re-throw to be caught by outer catch
      }

      logger.info(
        `[AI_SCHEDULER] Distribution plan created: ${distributionPlan.games.length} games, ` +
        `${distributionPlan.summary.assignedTVs}/${distributionPlan.summary.totalTVs} TVs assigned`
      );

      // Transform distribution plan into output assignments format
      for (const gameAssignment of distributionPlan.games) {
        for (const tvAssignment of gameAssignment.assignments) {
          // Find the matrix output ID from output number
          const output = await db.select()
            .from(schema.matrixOutputs)
            .where(eq(schema.matrixOutputs.channelNumber, tvAssignment.outputNumber))
            .limit(1)
            .get();

          if (output) {
            // Find the matrix input ID from input number
            const input = await db.select()
              .from(schema.matrixInputs)
              .where(eq(schema.matrixInputs.channelNumber, tvAssignment.inputNumber))
              .limit(1)
              .get();

            if (input) {
              result.assignments[output.id] = {
                inputId: input.id,
                channel: tvAssignment.channelNumber || gameAssignment.game.channelNumber,
                priority: gameAssignment.priority.finalScore,
                gameName: `${gameAssignment.game.homeTeam} vs ${gameAssignment.game.awayTeam}`,
                requiresChannelChange: tvAssignment.requiresChannelChange,
                alreadyTuned: tvAssignment.alreadyTuned
              };
            }
          }
        }
      }

      // Add default content assignments (ESPN, Atmosphere TV)
      for (const defaultAssignment of distributionPlan.defaults) {
        const output = await db.select()
          .from(schema.matrixOutputs)
          .where(eq(schema.matrixOutputs.channelNumber, defaultAssignment.outputNumber))
          .limit(1)
          .get();

        if (output && !result.assignments[output.id]) {
          const input = await db.select()
            .from(schema.matrixInputs)
            .where(eq(schema.matrixInputs.channelNumber, defaultAssignment.inputNumber))
            .limit(1)
            .get();

          if (input) {
            result.assignments[output.id] = {
              inputId: input.id,
              channel: defaultAssignment.channelNumber || '',
              priority: 0,
              gameName: defaultAssignment.contentType === 'espn' ? 'ESPN' : 'Atmosphere TV',
              requiresChannelChange: defaultAssignment.requiresChannelChange,
              alreadyTuned: false
            };
          }
        }
      }

      logger.info(`[AI_SCHEDULER] Final assignments created for ${Object.keys(result.assignments).length} outputs`);

      // Log distribution plan reasoning
      for (const reason of distributionPlan.reasoning) {
        logger.info(`[AI_SCHEDULER] ${reason}`);
      }

      // EXECUTE THE DISTRIBUTION PLAN - Send actual hardware commands
      logger.info(`[AI_SCHEDULER] Executing distribution plan...`);

      // Track which inputs have been tuned to avoid duplicate commands
      const tunedInputs = new Map<number, string>(); // inputNumber -> channelNumber

      // Execute game assignments
      // Track outputs that need routing (ONLY for successfully tuned inputs)
      const routingCommands: Array<{outputNumber: number, inputNumber: number, zoneName?: string}> = [];

      for (const gameAssignment of distributionPlan.games) {
        for (const tvAssignment of gameAssignment.assignments) {
          // Tune channel if we have a channel number
          if (tvAssignment.channelNumber) {
            // Only tune each input once
            if (!tunedInputs.has(tvAssignment.inputNumber)) {
              // Find the matrix input details
              const input = await db.select()
                .from(schema.matrixInputs)
                .where(eq(schema.matrixInputs.channelNumber, tvAssignment.inputNumber))
                .limit(1)
                .get();

              if (input) {
                logger.info(
                  `[AI_SCHEDULER] Tuning input ${tvAssignment.inputNumber} (${tvAssignment.inputLabel}) to channel ${tvAssignment.channelNumber} for ${gameAssignment.game.homeTeam} vs ${gameAssignment.game.awayTeam}`
                );

                try {
                  await changeChannel(input, tvAssignment.channelNumber);
                  tunedInputs.set(tvAssignment.inputNumber, tvAssignment.channelNumber);
                  result.channelsSet++;
                } catch (error: any) {
                  logger.error(`[AI_SCHEDULER] Failed to tune input ${tvAssignment.inputNumber}:`, error);
                  result.errors.push(`Failed to tune ${tvAssignment.inputLabel} to channel ${tvAssignment.channelNumber}: ${error.message}`);
                  continue; // Skip this assignment if tuning failed
                }

                // Delay between commands
                await new Promise(resolve => setTimeout(resolve, schedule.delayBetweenCommands || 500));
              } else {
                logger.warn(`[AI_SCHEDULER] Could not find matrix input ${tvAssignment.inputNumber} for tuning`);
                continue; // Skip if input not found
              }
            }
          } else {
            // No channel number - skip routing for this assignment
            logger.warn(`[AI_SCHEDULER] No channel number for ${tvAssignment.inputLabel} - skipping`);
            continue;
          }

          // ONLY add routing command if the input was successfully tuned
          if (tunedInputs.has(tvAssignment.inputNumber)) {
            routingCommands.push({
              outputNumber: tvAssignment.outputNumber,
              inputNumber: tvAssignment.inputNumber,
              zoneName: tvAssignment.zoneName
            });
          }
        }
      }

      // Execute matrix routing commands
      // IMPORTANT: Only route to inputs that have been tuned to games
      // Inputs without scheduled games are never added to routingCommands
      logger.info(`[AI_SCHEDULER] Routing ${routingCommands.length} outputs to ${tunedInputs.size} tuned inputs`);
      logger.info(`[AI_SCHEDULER] Tuned inputs: ${Array.from(tunedInputs.entries()).map(([input, ch]) => `Input ${input} → Ch ${ch}`).join(', ')}`);

      for (const routeCmd of routingCommands) {
        // SAFETY CHECK: Only route if input actually has a game tuned
        if (!tunedInputs.has(routeCmd.inputNumber)) {
          logger.warn(`[AI_SCHEDULER] SKIPPING route - Input ${routeCmd.inputNumber} has no game scheduled, not routing output ${routeCmd.outputNumber}`);
          continue;
        }

        try {
          const routeResponse = await fetch('http://localhost:3001/api/matrix/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: routeCmd.inputNumber,
              output: routeCmd.outputNumber,
              source: 'ai_scheduler' // Mark as AI scheduler to NOT set bartender override
            })
          });

          if (!routeResponse.ok) {
            logger.warn(`[AI_SCHEDULER] Failed to route output ${routeCmd.outputNumber} (${routeCmd.zoneName}) to input ${routeCmd.inputNumber}`);
          } else {
            logger.info(`[AI_SCHEDULER] Routed output ${routeCmd.outputNumber} (${routeCmd.zoneName}) to input ${routeCmd.inputNumber} (channel ${tunedInputs.get(routeCmd.inputNumber)})`);
            result.tvsControlled++;
          }
        } catch (error: any) {
          logger.error(`[AI_SCHEDULER] Matrix routing error:`, error);
        }

        // Small delay between routing commands
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`[AI_SCHEDULER] Distribution plan execution complete - ${tunedInputs.size} inputs tuned`);

      // Mark that AI scheduler handled execution so manual channel tuning is skipped
      result.aiSchedulerExecuted = true;
      result.channelsSet = tunedInputs.size;
    }

  } catch (error: any) {
    logger.error('[SCHEDULER] Error finding games:', error);
    logger.error('[SCHEDULER] Error stack:', error?.stack);
    logger.error('[SCHEDULER] Error message:', error?.message);
    logger.error('[SCHEDULER] Error type:', typeof error);
    logger.error('[SCHEDULER] Error toString:', String(error));
    if (error) {
      try {
        logger.error('[SCHEDULER] Error keys:', Object.keys(error));
        logger.error('[SCHEDULER] Error JSON:', JSON.stringify(error, null, 2));
      } catch (e) {
        logger.error('[SCHEDULER] Error is not serializable');
      }
    }
    // Store error in result
    result.errors = result.errors || [];
    result.errors.push(`Game finding error: ${error?.message || String(error)}`);
  }

  return result;
}

async function searchForGames(homeTeams: any[], startTime: Date, endTime: Date, fillWithSports: boolean = true) {
  const games: any[] = [];

  try {
    logger.info(`Searching for games for ${homeTeams.length} home teams between ${startTime.toISOString()} and ${endTime.toISOString()} (fillWithSports: ${fillWithSports})`);

    // Load channel presets to validate available channels
    const channelPresets = await db.select().from(schema.channelPresets).where(eq(schema.channelPresets.isActive, true));

    // Create lookup maps for quick channel validation
    const cableChannels = new Set(
      channelPresets
        .filter(p => p.deviceType === 'cable')
        .map(p => p.channelNumber.toLowerCase())
    );
    const directvChannels = new Set(
      channelPresets
        .filter(p => p.deviceType === 'directv')
        .map(p => p.channelNumber.toLowerCase())
    );

    logger.info(`[CHANNEL_PRESETS] Loaded ${cableChannels.size} cable channels and ${directvChannels.size} DirecTV channels from presets`);
    logger.info(`[CHANNEL_PRESETS] Cable channels sample: ${Array.from(cableChannels).slice(0, 10).join(', ')}`);
    logger.info(`[CHANNEL_PRESETS] DirecTV channels sample: ${Array.from(directvChannels).slice(0, 10).join(', ')}`);

    // Create cross-reference maps based on preset names
    // This allows games to be scheduled on either cable OR DirecTV inputs
    const cableChannelToName = new Map<string, string>();
    const directvChannelToName = new Map<string, string>();
    const nameToCableChannel = new Map<string, string>();
    const nameToDirectvChannel = new Map<string, string>();

    for (const preset of channelPresets) {
      const normalizedName = preset.name.toLowerCase().trim();
      const channelNum = preset.channelNumber.toLowerCase();

      if (preset.deviceType === 'cable') {
        cableChannelToName.set(channelNum, normalizedName);
        if (!nameToCableChannel.has(normalizedName)) {
          nameToCableChannel.set(normalizedName, preset.channelNumber);
        }
      } else if (preset.deviceType === 'directv') {
        directvChannelToName.set(channelNum, normalizedName);
        if (!nameToDirectvChannel.has(normalizedName)) {
          nameToDirectvChannel.set(normalizedName, preset.channelNumber);
        }
      }
    }

    logger.info(`[CHANNEL_PRESETS] Cross-reference maps: ${nameToCableChannel.size} cable names, ${nameToDirectvChannel.size} DirecTV names`);

    // Fetch sports guide data from The Rail Media API
    const guideResponse = await fetch('http://localhost:3001/api/sports-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 1 }) // Only fetch today's games
    });

    if (!guideResponse.ok) {
      logger.error('Failed to fetch sports guide data');
      return games;
    }

    const guideData = await guideResponse.json();

    if (!guideData.success || !guideData.data) {
      logger.error('Sports guide returned unsuccessful response');
      return games;
    }

    // Parse the guide data to find matching games
    const allGames: any[] = [];

    // Parse listing_groups from The Rail Media API
    for (const group of guideData.data.listing_groups || []) {
      for (const listing of group.listings || []) {
        // Parse the date properly
        let eventDate: Date;
        if (listing.date) {
          const currentYear = new Date().getFullYear();
          const dateWithYear = `${listing.date} ${currentYear} ${listing.time}`;
          eventDate = new Date(dateWithYear);

          // If date is in the past, try next year
          if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
            eventDate = new Date(`${listing.date} ${currentYear + 1} ${listing.time}`);
          }
        } else {
          eventDate = new Date(`${new Date().toDateString()} ${listing.time}`);
        }

        // Extract BOTH cable and DirecTV channel numbers and validate against presets
        let cableChannelNumber = '';
        let directvChannelNumber = '';

        // Extract cable channels and match against presets
        if (listing.channel_numbers?.CAB) {
          const cabChannels = listing.channel_numbers.CAB;
          for (const providerChannels of Object.values(cabChannels)) {
            const channels = providerChannels as any;
            const channelList = Array.isArray(channels) ? channels : [channels];

            // Find first channel that exists in our cable presets
            for (const ch of channelList) {
              if (ch) {
                const chStr = String(ch).toLowerCase();
                if (cableChannels.has(chStr)) {
                  cableChannelNumber = String(ch);
                  break;
                }
              }
            }
            if (cableChannelNumber) break;
          }
        }

        // Extract satellite/DirecTV channels and match against presets
        if (listing.channel_numbers?.SAT) {
          const satChannels = listing.channel_numbers.SAT;
          for (const providerChannels of Object.values(satChannels)) {
            const channels = providerChannels as any;
            const channelList = Array.isArray(channels) ? channels : [channels];

            // Find first channel that exists in our DirecTV presets
            for (const ch of channelList) {
              if (ch) {
                const chStr = String(ch).toLowerCase();
                if (directvChannels.has(chStr)) {
                  directvChannelNumber = String(ch);
                  break;
                }
              }
            }
            if (directvChannelNumber) break;
          }
        }

        // Cross-reference: If we only have one channel type, try to find the equivalent for the other
        // This allows games to be scheduled on either cable OR DirecTV inputs based on presets
        if (cableChannelNumber && !directvChannelNumber) {
          const presetName = cableChannelToName.get(cableChannelNumber.toLowerCase());
          if (presetName) {
            const matchingDirectv = nameToDirectvChannel.get(presetName);
            if (matchingDirectv) {
              directvChannelNumber = matchingDirectv;
              logger.debug(`[CHANNEL_CROSSREF] Cross-referenced cable ${cableChannelNumber} (${presetName}) to DirecTV ${directvChannelNumber}`);
            }
          }
        } else if (directvChannelNumber && !cableChannelNumber) {
          const presetName = directvChannelToName.get(directvChannelNumber.toLowerCase());
          if (presetName) {
            const matchingCable = nameToCableChannel.get(presetName);
            if (matchingCable) {
              cableChannelNumber = matchingCable;
              logger.debug(`[CHANNEL_CROSSREF] Cross-referenced DirecTV ${directvChannelNumber} (${presetName}) to cable ${cableChannelNumber}`);
            }
          }
        }

        // Log channel matching results for debugging
        if (!cableChannelNumber && !directvChannelNumber) {
          logger.debug(`[CHANNEL_MATCH] No matches for game: ${listing.data['home team'] || ''} vs ${listing.data['visiting team'] || ''}`);
        } else {
          logger.debug(`[CHANNEL_MATCH] Matched game: ${listing.data['home team'] || ''} vs ${listing.data['visiting team'] || ''} - Cable: ${cableChannelNumber || 'N/A'}, DirecTV: ${directvChannelNumber || 'N/A'}`);
        }

        // Only add game if we have at least one valid channel from our presets
        if (cableChannelNumber || directvChannelNumber) {
          // Extract team names from various data formats
          let homeTeam = listing.data['home team'] || listing.data['team'] || '';
          let awayTeam = listing.data['visiting team'] || listing.data['opponent'] || '';

          // Handle combined "teams" field (e.g., Soccer: "Pachuca v Pumas UNAM")
          // or "event" field (e.g., Other Sports: "(1)Nebraska v Iowa")
          const combinedField = listing.data['teams'] || listing.data['event'];
          if (!homeTeam && !awayTeam && combinedField) {
            // Try to split by common separators: " v ", " vs ", " vs. ", " @ ", " - "
            const separators = [' v ', ' vs ', ' vs. ', ' @ ', ' - '];
            for (const sep of separators) {
              if (combinedField.includes(sep)) {
                const parts = combinedField.split(sep);
                if (parts.length === 2) {
                  awayTeam = parts[0].trim();  // First team is typically away
                  homeTeam = parts[1].trim();  // Second team is typically home
                  break;
                }
              }
            }
          }

          const game = {
            league: group.group_title,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            gameTime: listing.time,
            startTime: eventDate.toISOString(),
            cableChannel: cableChannelNumber,
            directvChannel: directvChannelNumber,
            // Legacy field for backwards compatibility - prefer cable, fallback to DirecTV
            channelNumber: cableChannelNumber || directvChannelNumber,
            venue: listing.data['venue'] || listing.data['location'] || ''
          };

          allGames.push(game);
        }
      }
    }

    logger.info(`Found ${allGames.length} total games in sports guide`);

    // Filter out games that started more than 2 hours ago to keep the guide fresh
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
    const freshGames = allGames.filter(game => {
      const gameStart = new Date(game.startTime);
      return gameStart >= twoHoursAgo;
    });

    const removedCount = allGames.length - freshGames.length;
    if (removedCount > 0) {
      logger.info(`[CLEANUP] Filtered out ${removedCount} games that started more than 2 hours ago`);
    }

    // Return ALL fresh games in time window (not just home team games)
    // Tag games that involve home teams for priority boosting
    const gamesInWindow = freshGames.filter((game: any) => {
      const gameTime = new Date(game.startTime || game.time);
      return gameTime >= startTime && gameTime <= endTime;
    });

    // Tag each game with matching home team info (if any)
    for (const game of gamesInWindow) {
      let matchedHomeTeam = null;

      for (const homeTeam of homeTeams) {
        const homeTeamMatch =
          game.homeTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase()) ||
          game.awayTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase());

        if (homeTeamMatch) {
          matchedHomeTeam = homeTeam;
          break;
        }
      }

      // Add game with home team info (null if no match)
      games.push({
        ...game,
        homeTeamId: matchedHomeTeam?.id || null,
        homeTeamName: matchedHomeTeam?.teamName || null,
        isHomeTeamGame: !!matchedHomeTeam
      });
    }

    logger.info(`Total games found: ${games.length} (${games.filter(g => g.isHomeTeamGame).length} home team games, ${games.filter(g => !g.isHomeTeamGame).length} other games)`);

    // If fillWithSports is disabled, filter out non-home-team games
    if (!fillWithSports) {
      const filteredGames = games.filter(g => g.isHomeTeamGame);
      logger.info(`fillWithSports disabled - filtered to ${filteredGames.length} home team games only`);
      return filteredGames;
    }
  } catch (error: any) {
    logger.error('Error searching for games:', error);
  }

  return games;
}

async function changeChannel(input: any, channel: string) {
  try {
    logger.info(`[CHANNEL_CHANGE] Changing ${input.label} (${input.deviceType}) to channel ${channel}`);

    // Route based on device type (deviceType field contains the actual device, inputType is just "HDMI")
    const deviceType = input.deviceType || input.inputType;
    switch (deviceType) {
      case 'Cable Box':
        return await changeCableBoxChannel(input, channel);

      case 'DirecTV':
        return await changeDirectTVChannel(input, channel);

      case 'Fire TV':
        return await changeFireTVChannel(input, channel);

      default:
        logger.info(`Device type ${input.deviceType} doesn't support channel changing`);
        return { success: true, message: 'Device type does not support channel changing' };
    }
  } catch (error: any) {
    logger.error(`Error changing channel for input ${inputId}:`, error);
    return { success: false, error: error.message };
  }
}

async function changeCableBoxChannel(input: any, channel: string) {
  try {
    // Find the IR device that matches this cable box by name
    const irDevice = await db.select()
      .from(schema.irDevices)
      .where(
        and(
          eq(schema.irDevices.deviceType, 'Cable Box'),
          eq(schema.irDevices.name, input.label)
        )
      )
      .limit(1)
      .get();

    if (!irDevice) {
      logger.error(`No IR device found for cable box: ${input.label}`);
      return { success: false, error: 'IR device not configured' };
    }

    // Update the database BEFORE sending IR command so channel guide reflects the intent
    // Find the cable box by matching the input label
    const cableBox = await db.select()
      .from(schema.cableBoxes)
      .where(eq(schema.cableBoxes.name, input.label))
      .limit(1)
      .get();

    if (cableBox) {
      // Look up what game/program is on this channel from sports guide
      let currentProgram = null;
      try {
        const guideResponse = await fetch('http://localhost:3001/api/sports-guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: 1 })
        });

        if (guideResponse.ok) {
          const guideData = await guideResponse.json();
          if (guideData.success && guideData.data?.listing_groups) {
            const now = new Date();

            // Search through all games to find what's on this channel right now
            for (const group of guideData.data.listing_groups) {
              for (const listing of group.listings || []) {
                // Get channel number for this listing
                let listingChannel = '';
                if (listing.channel_numbers?.CAB) {
                  const cableChannels = listing.channel_numbers.CAB;
                  const firstChannel = Object.values(cableChannels)[0] as any;
                  listingChannel = String(Array.isArray(firstChannel) ? firstChannel[0] : firstChannel);
                } else if (listing.channel_numbers?.SAT) {
                  const satChannels = listing.channel_numbers.SAT;
                  const firstChannel = Object.values(satChannels)[0] as any;
                  listingChannel = String(Array.isArray(firstChannel) ? firstChannel[0] : firstChannel);
                }

                // Check if this listing is on our channel
                if (listingChannel === channel) {
                  // Parse the time to check if game is on now or soon
                  const currentYear = new Date().getFullYear();
                  const dateWithYear = listing.date ? `${listing.date} ${currentYear} ${listing.time}` : `${now.toDateString()} ${listing.time}`;
                  const gameTime = new Date(dateWithYear);

                  // If game starts within next 6 hours, consider it current
                  const timeDiff = gameTime.getTime() - now.getTime();
                  if (timeDiff > -3 * 60 * 60 * 1000 && timeDiff < 6 * 60 * 60 * 1000) {
                    currentProgram = {
                      league: group.group_title,
                      homeTeam: listing.data['home team'] || listing.data['team'] || '',
                      awayTeam: listing.data['visiting team'] || listing.data['opponent'] || '',
                      venue: listing.data['venue'] || listing.data['location'] || '',
                      time: listing.time,
                      date: listing.date,
                      channel: listingChannel
                    };
                    break;
                  }
                }
              }
              if (currentProgram) break;
            }
          }
        }
      } catch (error: any) {
        logger.warn(`Could not fetch sports guide for ${input.label}:`, error.message);
      }

      await db.update(schema.cableBoxes)
        .set({
          lastChannel: channel,
          currentProgram: currentProgram ? JSON.stringify(currentProgram) : null,
          currentProgramUpdatedAt: currentProgram ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.cableBoxes.id, cableBox.id))
        .returning().get();

      if (currentProgram) {
        logger.info(`Updated ${input.label} to channel ${channel} - Now Playing: ${currentProgram.homeTeam} vs ${currentProgram.awayTeam} (${currentProgram.league})`);
      } else {
        logger.info(`Updated ${input.label} database to channel ${channel} - no game data found`);
      }
    }

    // Use the channel-presets tune API to send IR commands
    const response = await fetch('http://localhost:3001/api/channel-presets/tune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelNumber: channel,
        deviceType: 'cable',
        cableBoxId: irDevice.id
      })
    });

    const result = await response.json();

    if (result.success) {
      logger.info(`Successfully tuned ${input.label} to channel ${channel}`);
      return { success: true };
    } else {
      logger.error(`Failed to tune cable box: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    logger.error(`Error tuning cable box ${input.label}:`, error);
    return { success: false, error: error.message };
  }
}

async function changeDirectTVChannel(input: any, channel: string) {
  try {
    // Load DirecTV devices from JSON file
    const fs = await import('fs/promises');
    const path = await import('path');
    const devicesPath = path.join(process.cwd(), 'data', 'directv-devices.json');
    const devicesJson = await fs.readFile(devicesPath, 'utf-8');
    const devicesData = JSON.parse(devicesJson);

    // Find DirecTV device by matching input label
    const direcTVDevice = devicesData.devices.find((d: any) => d.name === input.label);

    if (!direcTVDevice) {
      logger.error(`No DirecTV device found for: ${input.label}`);
      return { success: false, error: 'DirecTV device not configured' };
    }

    logger.info(`[DIRECTV] Tuning ${input.label} (${direcTVDevice.ipAddress}) to channel ${channel}`);

    // Look up what game/program is on this channel from sports guide
    let currentProgram = null;
    try {
      const guideResponse = await fetch('http://localhost:3001/api/sports-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 1 })
      });

      if (guideResponse.ok) {
        const guideData = await guideResponse.json();
        if (guideData.success && guideData.data?.listing_groups) {
          const now = new Date();

          // Search through all games to find what's on this channel right now
          for (const group of guideData.data.listing_groups) {
            for (const listing of group.listings || []) {
              // Get DirecTV channel number for this listing
              let listingChannel = '';
              if (listing.channel_numbers?.SAT) {
                const satChannels = listing.channel_numbers.SAT;
                const firstChannel = Object.values(satChannels)[0] as any;
                listingChannel = String(Array.isArray(firstChannel) ? firstChannel[0] : firstChannel);
              }

              // Check if this listing is on our channel
              if (listingChannel === channel) {
                // Parse the time to check if game is on now or soon
                const currentYear = new Date().getFullYear();
                const dateWithYear = listing.date ? `${listing.date} ${currentYear} ${listing.time}` : `${now.toDateString()} ${listing.time}`;
                const gameTime = new Date(dateWithYear);

                // If game starts within next 6 hours, consider it current
                const timeDiff = gameTime.getTime() - now.getTime();
                if (timeDiff > -3 * 60 * 60 * 1000 && timeDiff < 6 * 60 * 60 * 1000) {
                  currentProgram = {
                    league: group.group_title,
                    homeTeam: listing.data['home team'] || listing.data['team'] || '',
                    awayTeam: listing.data['visiting team'] || listing.data['opponent'] || '',
                    venue: listing.data['venue'] || listing.data['location'] || '',
                    time: listing.time,
                    date: listing.date,
                    channel: listingChannel
                  };
                  break;
                }
              }
            }
            if (currentProgram) break;
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Could not fetch sports guide for ${input.label}:`, error.message);
    }

    // Update InputCurrentChannel table to track what's tuned
    try {
      // Check if record exists for this input
      const existingRecord = await db.select()
        .from(schema.inputCurrentChannels)
        .where(eq(schema.inputCurrentChannels.inputNum, input.channelNumber))
        .limit(1)
        .get();

      const channelData = {
        inputNum: input.channelNumber,
        inputLabel: input.label,
        deviceType: 'DirecTV',
        deviceId: direcTVDevice.id,
        channelNumber: channel,
        channelName: currentProgram ? `${currentProgram.homeTeam} vs ${currentProgram.awayTeam}` : null,
        showName: currentProgram ? currentProgram.league : null,
        lastTuned: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingRecord) {
        await db.update(schema.inputCurrentChannels)
          .set(channelData)
          .where(eq(schema.inputCurrentChannels.inputNum, input.channelNumber))
          .returning().get();
      } else {
        await db.insert(schema.inputCurrentChannels)
          .values({
            id: `input-${input.channelNumber}`,
            ...channelData
          })
          .returning().get();
      }

      if (currentProgram) {
        logger.info(`Updated ${input.label} tracking - Now Playing: ${currentProgram.homeTeam} vs ${currentProgram.awayTeam} (${currentProgram.league})`);
      } else {
        logger.info(`Updated ${input.label} tracking to channel ${channel}`);
      }
    } catch (dbError: any) {
      logger.warn(`Could not update InputCurrentChannel for ${input.label}:`, dbError.message);
    }

    // Use the DirecTV tune API
    const response = await fetch(`http://localhost:3001/api/directv/${direcTVDevice.id}/tune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: parseInt(channel) })
    });

    const result = await response.json();

    if (result.success) {
      logger.info(`Successfully tuned ${input.label} to channel ${channel}`);
      return { success: true };
    } else {
      logger.error(`Failed to tune DirecTV: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    logger.error(`Error tuning DirecTV ${input.label}:`, error);
    return { success: false, error: error.message };
  }
}

async function changeFireTVChannel(input: any, channel: string) {
  try {
    // Find the Fire TV device by matching the input label
    const fireTVDevice = await db.select()
      .from(schema.fireTVDevices)
      .where(eq(schema.fireTVDevices.name, input.label))
      .limit(1)
      .get();

    if (!fireTVDevice) {
      logger.error(`No Fire TV device found for: ${input.label}`);
      return { success: false, error: 'Fire TV device not configured' };
    }

    // Look up what game/program is on this channel from sports guide
    let currentProgram = null;
    try {
      const guideResponse = await fetch('http://localhost:3001/api/sports-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 1 })
      });

      if (guideResponse.ok) {
        const guideData = await guideResponse.json();
        if (guideData.success && guideData.data?.listing_groups) {
          const now = new Date();

          // Search through all games to find what's on this channel right now
          // Fire TV uses streaming services, so check both cable and satellite channels
          for (const group of guideData.data.listing_groups) {
            for (const listing of group.listings || []) {
              let listingChannel = '';

              // Try cable first, then satellite
              if (listing.channel_numbers?.CAB) {
                const cableChannels = listing.channel_numbers.CAB;
                const firstChannel = Object.values(cableChannels)[0] as any;
                listingChannel = String(Array.isArray(firstChannel) ? firstChannel[0] : firstChannel);
              } else if (listing.channel_numbers?.SAT) {
                const satChannels = listing.channel_numbers.SAT;
                const firstChannel = Object.values(satChannels)[0] as any;
                listingChannel = String(Array.isArray(firstChannel) ? firstChannel[0] : firstChannel);
              }

              // Check if this listing is on our channel
              if (listingChannel === channel) {
                // Parse the time to check if game is on now or soon
                const currentYear = new Date().getFullYear();
                const dateWithYear = listing.date ? `${listing.date} ${currentYear} ${listing.time}` : `${now.toDateString()} ${listing.time}`;
                const gameTime = new Date(dateWithYear);

                // If game starts within next 6 hours, consider it current
                const timeDiff = gameTime.getTime() - now.getTime();
                if (timeDiff > -3 * 60 * 60 * 1000 && timeDiff < 6 * 60 * 60 * 1000) {
                  currentProgram = {
                    league: group.group_title,
                    homeTeam: listing.data['home team'] || listing.data['team'] || '',
                    awayTeam: listing.data['visiting team'] || listing.data['opponent'] || '',
                    venue: listing.data['venue'] || listing.data['location'] || '',
                    time: listing.time,
                    date: listing.date,
                    channel: listingChannel
                  };
                  break;
                }
              }
            }
            if (currentProgram) break;
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Could not fetch sports guide for ${input.label}:`, error.message);
    }

    // Update InputCurrentChannel table to track what's tuned
    try {
      // Check if record exists for this input
      const existingRecord = await db.select()
        .from(schema.inputCurrentChannels)
        .where(eq(schema.inputCurrentChannels.inputNum, input.channelNumber))
        .limit(1)
        .get();

      const channelData = {
        inputNum: input.channelNumber,
        inputLabel: input.label,
        deviceType: 'Fire TV',
        deviceId: fireTVDevice.id,
        channelNumber: channel,
        channelName: currentProgram ? `${currentProgram.homeTeam} vs ${currentProgram.awayTeam}` : null,
        showName: currentProgram ? currentProgram.league : null,
        lastTuned: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingRecord) {
        await db.update(schema.inputCurrentChannels)
          .set(channelData)
          .where(eq(schema.inputCurrentChannels.inputNum, input.channelNumber))
          .returning().get();
      } else {
        await db.insert(schema.inputCurrentChannels)
          .values({
            id: `input-${input.channelNumber}`,
            ...channelData
          })
          .returning().get();
      }

      if (currentProgram) {
        logger.info(`Updated ${input.label} tracking - Now Playing: ${currentProgram.homeTeam} vs ${currentProgram.awayTeam} (${currentProgram.league})`);
      } else {
        logger.info(`Updated ${input.label} tracking to channel ${channel}`);
      }
    } catch (dbError: any) {
      logger.warn(`Could not update InputCurrentChannel for ${input.label}:`, dbError.message);
    }

    // Fire TV doesn't have traditional channel numbers - this would launch apps
    // For sports bars, you might want to launch YouTube TV, Hulu Live, etc. and tune to a channel
    logger.info(`Fire TV channel changing not fully implemented - would launch streaming app for ${channel}`);

    // TODO: Implement streaming app launching and channel tuning
    // This would use the Fire TV ADB API to launch apps and navigate

    return { success: true, message: 'Fire TV streaming not yet implemented' };
  } catch (error: any) {
    logger.error(`Error with Fire TV ${input.label}:`, error);
    return { success: false, error: error.message };
  }
}

// Helper function: Map league names to ESPN API parameters
function mapLeagueToESPN(league: string): { sport: string; league: string } | null {
  const leagueLower = league.toLowerCase()

  if (leagueLower.includes('nfl')) return { sport: 'football', league: 'nfl' }
  if (leagueLower.includes('ncaa football') || leagueLower.includes('college football'))
    return { sport: 'football', league: 'college-football' }

  if (leagueLower.includes('nba')) return { sport: 'basketball', league: 'nba' }
  if (leagueLower.includes('ncaa basketball') || leagueLower.includes('college basketball')) {
    if (leagueLower.includes("women")) return { sport: 'basketball', league: 'womens-college-basketball' }
    return { sport: 'basketball', league: 'mens-college-basketball' }
  }

  if (leagueLower.includes('nhl')) return { sport: 'hockey', league: 'nhl' }
  if (leagueLower.includes('mlb') || leagueLower.includes('baseball')) return { sport: 'baseball', league: 'mlb' }
  if (leagueLower.includes('mls') || leagueLower.includes('soccer')) return { sport: 'soccer', league: 'usa.1' }

  return null
}

// Helper function: Match game by team names (fuzzy matching)
function matchGameByTeams(espnGames: any[], homeTeam: string, awayTeam: string): any | null {
  const cleanTeam = (name: string) => {
    // Remove common prefixes like "NCAA:", "NFL:", "NBA:", etc.
    let cleaned = name.replace(/^(NCAA|NFL|NBA|NHL|MLB|MLS):\\s*/i, '')
    // Convert to lowercase and remove all non-alphanumeric characters
    return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '')
  }
  const homeClean = cleanTeam(homeTeam)
  const awayClean = cleanTeam(awayTeam)

  for (const espnGame of espnGames) {
    const espnHomeClean = cleanTeam(espnGame.homeTeam.displayName)
    const espnAwayClean = cleanTeam(espnGame.awayTeam.displayName)

    // Check if teams match (in either order since sometimes home/away can be swapped)
    const exactMatch = (
      (espnHomeClean.includes(homeClean) || homeClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(awayClean) || awayClean.includes(espnAwayClean))
    ) || (
      (espnHomeClean.includes(awayClean) || awayClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(homeClean) || homeClean.includes(espnAwayClean))
    )

    if (exactMatch) {
      return espnGame
    }
  }

  return null
}
