
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db'
import { findMany, inArray } from '@/lib/db-helpers'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'


import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
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
    const { scheduleId } = bodyValidation.data;
    
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

    // Execute the schedule
    const result = await executeSchedule(schedule);

    // Update schedule execution stats
    await db.update(schema.schedules).set({
        lastExecuted: new Date().toISOString(),
        executionCount: schedule.executionCount + 1,
        lastResult: JSON.stringify(result)
      }).where(eq(schema.schedules.id, scheduleId as string)).returning().get();

    // Log the execution
    await db.insert(schema.scheduleLogs).values({
        scheduleId: schedule.id,
        success: result.success,
        error: result.message || (result.errors ? JSON.stringify(result.errors) : null),
        channelName: schedule.channelName || 'Unknown',
        deviceName: schedule.deviceId || 'Unknown'
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

async function executeSchedule(schedule: any) {
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

    // Step 1: Power on/off TVs if requested
    if (schedule.powerOnTVs || schedule.powerOffTVs) {
      for (const output of outputs) {
        try {
          const command = schedule.powerOnTVs ? 'on' : 'standby';
          const cecResponse = await fetch(`http://localhost:3001/api/cec/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outputChannel: output.channelNumber,
              command
            })
          });

          if (cecResponse.ok) {
            result.tvsControlled++;
          } else {
            result.errors.push(`Failed to power ${command} TV: ${output.label}`);
          }
        } catch (error: any) {
          result.errors.push(`Error controlling TV ${output.label}: ${error.message}`);
        }

        // Delay between commands
        await new Promise(resolve => setTimeout(resolve, schedule.delayBetweenCommands));
      }
    }

    // Step 2: Find games if enabled
    let gameAssignments: any = {};
    if (schedule.autoFindGames && schedule.monitorHomeTeams) {
      const homeTeamIds = JSON.parse(schedule.homeTeamIds || '[]');
      
      if (homeTeamIds.length > 0) {
        const gamesResult = await findHomeTeamGames(homeTeamIds, schedule);
        gameAssignments = gamesResult.assignments;
        result.gamesFound = gamesResult.gamesFound;
        result.details.games = gamesResult.games;
      }
    }

    // Step 3: Set channels
    if (schedule.setDefaultChannels || Object.keys(gameAssignments).length > 0) {
      const defaultChannelMap = schedule.defaultChannelMap 
        ? JSON.parse(schedule.defaultChannelMap) 
        : {};

      for (const output of outputs) {
        let inputId: string | null = null;
        let channel: string | null = null;

        // Priority: Game assignment > Default channel
        if (gameAssignments[output.id]) {
          inputId = gameAssignments[output.id].inputId;
          channel = gameAssignments[output.id].channel;
        } else if (defaultChannelMap[output.id]) {
          const mapping = defaultChannelMap[output.id];
          inputId = mapping.inputId;
          channel = mapping.channel;
        }

        if (inputId && channel) {
          try {
            // Route the matrix
            const routeResponse = await fetch(`http://localhost:3001/api/matrix/route`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: parseInt(inputId),
                output: output.channelNumber
              })
            });

            if (routeResponse.ok) {
              result.channelsSet++;
              
              // Send channel change command to input device
              // This would need the input device control API
              await changeChannel(inputId, channel);
            } else {
              result.errors.push(`Failed to route ${output.label}`);
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

async function findHomeTeamGames(homeTeamIds: string[], schedule: any) {
  const result = {
    gamesFound: 0,
    assignments: {} as any,
    games: [] as any[]
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

    // Search for games in channel guide data
    // This would integrate with your existing TV guide APIs
    const games = await searchForGames(homeTeamsList, now, endOfDay);
    
    result.games = games;
    result.gamesFound = games.length;

    // TODO: Assign games to outputs based on preferred providers
    // This would be more complex logic based on your needs

  } catch (error) {
    logger.error('Error finding games:', error);
  }

  return result;
}

async function searchForGames(homeTeams: any[], startTime: Date, endTime: Date) {
  const games: any[] = [];

  try {
    logger.info(`Searching for games for ${homeTeams.length} home teams between ${startTime.toISOString()} and ${endTime.toISOString()}`);

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
    const allGames = guideData.data.games || [];

    logger.info(`Found ${allGames.length} total games in sports guide`);

    // Filter games by home teams
    for (const homeTeam of homeTeams) {
      const teamGames = allGames.filter((game: any) => {
        // Check if this game involves the home team
        const homeTeamMatch =
          game.homeTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase()) ||
          game.awayTeam?.toLowerCase().includes(homeTeam.teamName.toLowerCase());

        if (!homeTeamMatch) return false;

        // Check if game is within our time window
        const gameTime = new Date(game.startTime || game.time);
        return gameTime >= startTime && gameTime <= endTime;
      });

      if (teamGames.length > 0) {
        logger.info(`Found ${teamGames.length} games for ${homeTeam.teamName}`);
        games.push(...teamGames.map((game: any) => ({
          ...game,
          homeTeamId: homeTeam.id,
          homeTeamName: homeTeam.teamName
        })));
      }
    }

    logger.info(`Total games found: ${games.length}`);
  } catch (error: any) {
    logger.error('Error searching for games:', error);
  }

  return games;
}

async function changeChannel(inputId: string, channel: string) {
  try {
    // Get the matrix input to determine device type
    const input = await db.select()
      .from(schema.matrixInputs)
      .where(eq(schema.matrixInputs.id, inputId))
      .limit(1)
      .get();

    if (!input) {
      logger.error(`Matrix input not found: ${inputId}`);
      return { success: false, error: 'Matrix input not found' };
    }

    logger.info(`Changing ${input.label} (${input.deviceType}) to channel ${channel}`);

    // Route based on device type
    switch (input.deviceType) {
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
    // Find the DirecTV device by matching the input label
    const direcTVDevice = await db.select()
      .from(schema.direcTVDevices)
      .where(eq(schema.direcTVDevices.name, input.label))
      .limit(1)
      .get();

    if (!direcTVDevice) {
      logger.error(`No DirecTV device found for: ${input.label}`);
      return { success: false, error: 'DirecTV device not configured' };
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
