
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST - Execute a schedule immediately
export async function POST(request: NextRequest) {
  try {
    const { scheduleId } = await request.json();
    
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Execute the schedule
    const result = await executeSchedule(schedule);
    
    // Update schedule execution stats
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        lastExecuted: new Date(),
        executionCount: schedule.executionCount + 1,
        lastResult: JSON.stringify(result)
      }
    });

    // Log the execution
    await prisma.scheduleLog.create({
      data: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        success: result.success,
        message: result.message,
        details: JSON.stringify(result.details),
        gamesFound: result.gamesFound || 0,
        tvsControlled: result.tvsControlled || 0,
        channelsSet: result.channelsSet || 0,
        errors: result.errors ? JSON.stringify(result.errors) : null
      }
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Error executing schedule:', error);
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
    const outputs = await prisma.matrixOutput.findMany({
      where: { id: { in: selectedOutputs } }
    });

    // Step 1: Power on/off TVs if requested
    if (schedule.powerOnTVs || schedule.powerOffTVs) {
      for (const output of outputs) {
        try {
          const command = schedule.powerOnTVs ? 'on' : 'standby';
          const cecResponse = await fetch(`http://localhost:3000/api/cec/power`, {
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
            const routeResponse = await fetch(`http://localhost:3000/api/matrix/route`, {
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
    const homeTeams = await prisma.homeTeam.findMany({
      where: { id: { in: homeTeamIds }, isActive: true }
    });

    // Get today's date range
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Search for games in channel guide data
    // This would integrate with your existing TV guide APIs
    const games = await searchForGames(homeTeams, now, endOfDay);
    
    result.games = games;
    result.gamesFound = games.length;

    // TODO: Assign games to outputs based on preferred providers
    // This would be more complex logic based on your needs

  } catch (error) {
    console.error('Error finding games:', error);
  }

  return result;
}

async function searchForGames(homeTeams: any[], startTime: Date, endTime: Date) {
  const games: any[] = [];

  // TODO: Integrate with your TV guide APIs
  // - Check DirecTV guide
  // - Check Cable guide (Spectrum)
  // - Check streaming services
  
  return games;
}

async function changeChannel(inputId: string, channel: string) {
  // TODO: Implement channel changing based on input device type
  // This would send IR commands via Global Cache or control DirecTV, Fire TV, etc.
  console.log(`Changing input ${inputId} to channel ${channel}`);
}
