
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';


// GET - List all schedules
export async function GET(request: NextRequest) {
  try {
    const schedules = await prisma.schedule.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Calculate next execution for each schedule
    const schedulesWithNext = schedules.map(schedule => ({
      ...schedule,
      nextExecution: calculateNextExecution(schedule)
    }));

    return NextResponse.json({ schedules: schedulesWithNext });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const schedule = await prisma.schedule.create({
      data: {
        name: body.name,
        description: body.description || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        scheduleType: body.scheduleType || 'daily',
        executionTime: body.executionTime || null,
        daysOfWeek: body.daysOfWeek ? JSON.stringify(body.daysOfWeek) : null,
        powerOnTVs: body.powerOnTVs !== undefined ? body.powerOnTVs : true,
        powerOffTVs: body.powerOffTVs || false,
        selectedOutputs: JSON.stringify(body.selectedOutputs || []),
        setDefaultChannels: body.setDefaultChannels || false,
        defaultChannelMap: body.defaultChannelMap ? JSON.stringify(body.defaultChannelMap) : null,
        autoFindGames: body.autoFindGames || false,
        monitorHomeTeams: body.monitorHomeTeams || false,
        homeTeamIds: body.homeTeamIds ? JSON.stringify(body.homeTeamIds) : null,
        preferredProviders: body.preferredProviders ? JSON.stringify(body.preferredProviders) : JSON.stringify(['cable', 'streaming', 'satellite']),
        executionOrder: body.executionOrder || 'outputs_first',
        delayBetweenCommands: body.delayBetweenCommands || 2000,
        nextExecution: calculateNextExecution(body)
      }
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate next execution time
function calculateNextExecution(schedule: any): Date | null {
  if (!schedule.enabled || !schedule.executionTime) {
    return null;
  }

  const now = new Date();
  
  if (schedule.scheduleType === 'once') {
    const once = new Date(schedule.executionTime);
    return once > now ? once : null;
  }

  if (schedule.scheduleType === 'daily') {
    const [hours, minutes] = schedule.executionTime.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  if (schedule.scheduleType === 'weekly') {
    const daysOfWeek = schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [];
    if (daysOfWeek.length === 0) return null;
    
    const [hours, minutes] = schedule.executionTime.split(':').map(Number);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = now.getDay();
    
    // Find next matching day
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const dayName = dayNames[checkDay];
      
      if (daysOfWeek.includes(dayName)) {
        const next = new Date();
        next.setDate(next.getDate() + i);
        next.setHours(hours, minutes, 0, 0);
        
        if (next > now) {
          return next;
        }
      }
    }
  }

  return null;
}
