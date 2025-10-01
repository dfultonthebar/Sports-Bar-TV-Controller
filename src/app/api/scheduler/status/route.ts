
import { NextResponse } from 'next/server';
import { schedulerService } from '@/lib/scheduler-service';

// GET - Get scheduler service status
export async function GET() {
  return NextResponse.json({
    status: 'running',
    message: 'Scheduler service is active'
  });
}

// POST - Start/stop scheduler service
export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start') {
    schedulerService.start();
    return NextResponse.json({ message: 'Scheduler service started' });
  } else if (action === 'stop') {
    schedulerService.stop();
    return NextResponse.json({ message: 'Scheduler service stopped' });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
